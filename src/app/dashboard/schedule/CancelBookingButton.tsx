'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const REASONS = [
  { id: 'schedule', label: "Schedule doesn't work", icon: '📅' },
  { id: 'expensive', label: 'Too expensive', icon: '💰' },
  { id: 'child_stopped', label: 'Child lost interest', icon: '😕' },
  { id: 'switching', label: 'Switching class', icon: '🔄' },
  { id: 'other', label: 'Other reason', icon: '💬' },
]

type Step = 'idle' | 'reason' | 'offer' | 'confirm' | 'cancelled' | 'retained'

/**
 * Class-cancel button. P1+P2 alignment:
 *   - Retention offer now READS the academy's settings (retention_offer_enabled,
 *     _percent, _months) instead of hardcoded 50/2.
 *   - If retention is disabled, the offer step is skipped entirely.
 *   - On accept, calls /api/stripe/retain so the discount actually applies to
 *     billing (Stripe coupon at duration='once'/'forever'/'repeating' per
 *     retention_offer_months). One source of truth with the subscription flow.
 *   - On confirm-cancel, calls /api/enrolments/cancel so the reason persists
 *     to the cancellations table (cancellation_type='class') for academy
 *     analytics. Pre-P2 the reason was discarded on cancel.
 *
 * Does NOT change the subscription cancellation flow.
 */
export default function CancelBookingButton({
  enrolmentId,
  playerId,
  className,
  retentionEnabled = true,
  retentionPercent = 50,
  retentionMonths = 1,
}: {
  enrolmentId: string
  playerId?: string
  className?: string
  retentionEnabled?: boolean
  retentionPercent?: number
  retentionMonths?: number | null
}) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('idle')
  const [loading, setLoading] = useState(false)
  const [reason, setReason] = useState('')
  const [reasonDetail, setReasonDetail] = useState('')
  // After successful class cancel — if this was their last enrolment, prompt
  // them to consider cancelling the subscription so they don't keep paying for nothing.
  const [showSubPrompt, setShowSubPrompt] = useState(false)
  const [parentSubscriptionId, setParentSubscriptionId] = useState<string | null>(null)
  // Honest duration label matching what /api/stripe/retain will actually do.
  // months===1 → 'once' (Stripe coupon next-charge-only),
  // null → 'forever', else 'repeating' N months.
  const durationLabel = retentionMonths === null
    ? 'every month for as long as you stay'
    : retentionMonths === 1
      ? 'on your next charge'
      : `for the next ${retentionMonths} months`
  const durationShort = retentionMonths === null
    ? 'every month'
    : retentionMonths === 1
      ? 'next month'
      : `for ${retentionMonths} months`

  async function handleCancel() {
    setLoading(true)

    // P2: route through the API so the reason persists into cancellations
    // (alongside subscription cancellations — single retention analytics).
    let cancelSucceeded = false
    try {
      const res = await fetch('/api/enrolments/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enrolmentId,
          reason,
          reasonDetail: reasonDetail || null,
          offerWasShown: retentionEnabled,
        }),
      })
      const data = await res.json().catch(() => ({}))
      cancelSucceeded = !!data?.ok
      if (!cancelSucceeded) {
        alert(data?.error || 'Failed to cancel — please try again')
        setLoading(false)
        return
      }
    } catch (e) {
      alert('Failed to cancel — please try again')
      setLoading(false)
      return
    }

    // Check if this was their last active enrolment — if so, offer to cancel sub too.
    // This lookup remains client-side (RLS-safe, parent's own data).
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: myKids } = await supabase
        .from('players')
        .select('id')
        .eq('parent_id', user.id)
      const kidIds = (myKids || []).map((p) => p.id)

      let otherActiveCount = 0
      if (kidIds.length > 0) {
        const { count } = await supabase
          .from('enrolments')
          .select('id', { count: 'exact', head: true })
          .in('player_id', kidIds)
          .eq('status', 'active')
        otherActiveCount = count || 0
      }

      const { data: activeSub } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('parent_id', user.id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle()

      setParentSubscriptionId((activeSub?.id as string | undefined) || null)
      setShowSubPrompt(otherActiveCount === 0 && !!activeSub)
    }

    setStep('cancelled')
    setLoading(false)
    if (!showSubPrompt) {
      setTimeout(() => router.refresh(), 4000)
    }
  }

  async function handleStayWithDiscount() {
    setLoading(true)
    const supabase = createClient()

    // Resolve the parent's active subscription so we can apply the Stripe
    // coupon at the SUBSCRIPTION level (Stripe coupons attach to subs, not
    // enrolments — same model as the subscription-cancel retention path).
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      alert('Something went wrong — please try again')
      setLoading(false)
      return
    }
    const { data: activeSub } = await supabase
      .from('subscriptions')
      .select('stripe_subscription_id')
      .eq('parent_id', user.id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()
    const stripeSubId = (activeSub as { stripe_subscription_id?: string } | null)?.stripe_subscription_id
    if (!stripeSubId) {
      alert("We couldn't find an active subscription to apply the discount to. Please contact your academy.")
      setLoading(false)
      return
    }

    // P1: call the same Stripe retain endpoint the subscription-cancel flow
    // uses. Reads org config, creates/reuses the appropriate Stripe coupon,
    // applies to the subscription. Connect math untouched.
    try {
      const res = await fetch('/api/stripe/retain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionId: stripeSubId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data?.error) {
        alert(data?.error || 'Could not apply the discount. Please try again.')
        setLoading(false)
        return
      }
    } catch (e) {
      alert('Failed to apply discount — please try again')
      setLoading(false)
      return
    }

    setStep('retained')
    setLoading(false)
  }

  // Idle: small unobtrusive cancel pill
  if (step === 'idle') {
    return (
      <button
        onClick={() => setStep('reason')}
        className="px-2.5 py-1 text-[11px] font-semibold rounded-lg border border-rose-500/30 text-rose-300 bg-rose-500/5 hover:bg-rose-500/10 hover:border-rose-500/50 transition-colors"
      >
        Cancel
      </button>
    )
  }

  // Cancelled inline confirmation — if showSubPrompt, render a modal with subscription action
  if (step === 'cancelled') {
    if (showSubPrompt && parentSubscriptionId) {
      return (
        <>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 animate-fade-in">
            ✓ Cancelled
          </span>
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => { setShowSubPrompt(false); router.refresh() }}
          >
            <div
              className="bg-gradient-to-br from-[#141414] via-[#0f1416] to-[#0a0a0a] border border-amber-500/30 rounded-3xl shadow-2xl max-w-md w-full p-6 sm:p-8 animate-scale-in"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-5">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 mb-3 text-3xl">
                  ⚠️
                </div>
                <h3 className="text-xl font-bold text-white">That was your last class</h3>
                <p className="text-sm text-white/60 mt-2">
                  But your monthly subscription is <strong className="text-white">still active</strong>.
                  You&apos;ll keep being charged until you cancel it too.
                </p>
              </div>

              <div className="rounded-2xl p-4 mb-5 bg-white/[0.03] border border-white/[0.08]">
                <p className="text-sm text-white/70">
                  💡 Two options:
                </p>
                <ul className="mt-2 space-y-1.5 text-sm text-white/80">
                  <li className="flex items-start gap-2">
                    <span className="text-[#4ecde6] mt-0.5">•</span>
                    <span><strong className="text-white">Book another class</strong> — your subscription stays useful</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-300 mt-0.5">•</span>
                    <span><strong className="text-white">Cancel the subscription</strong> — stops billing too</span>
                  </li>
                </ul>
              </div>

              <div className="flex flex-col-reverse sm:flex-row gap-2">
                <button
                  onClick={() => { setShowSubPrompt(false); router.refresh() }}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold text-white/70 hover:text-white bg-white/[0.04] border border-white/[0.08] hover:border-white/20 transition-all"
                >
                  Browse other classes
                </button>
                <a
                  href="/dashboard/payments/cancel"
                  className="flex-1 py-3 rounded-xl text-sm font-extrabold transition-all hover:scale-[1.02] active:scale-[0.98] text-center"
                  style={{
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    color: '#0a0a0a',
                    boxShadow: '0 8px 28px rgba(245, 158, 11, 0.4), 0 0 0 2px rgba(245, 158, 11, 0.4)',
                  }}
                >
                  Cancel subscription too →
                </a>
              </div>
            </div>
          </div>
        </>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 animate-fade-in">
        ✓ Cancelled
      </span>
    )
  }

  // Retained inline confirmation
  if (step === 'retained') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 animate-fade-in">
        🎉 {retentionPercent}% off {durationShort}!
      </span>
    )
  }

  return (
    <>
      <button
        className="px-2.5 py-1 text-[11px] font-semibold rounded-lg border border-rose-500/30 text-rose-300 bg-rose-500/5 opacity-40"
        disabled
      >
        Cancel
      </button>

      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        onClick={() => !loading && setStep('idle')}
      >
        <div
          className="bg-gradient-to-br from-[#141414] via-[#0f1416] to-[#0a0a0a] border border-[#1e1e1e] rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-scale-in"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Step 1: Why are you cancelling ── */}
          {step === 'reason' && (
            <div className="p-6 sm:p-8">
              <div className="text-center mb-5">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.08] mb-3 text-3xl">
                  😔
                </div>
                <h3 className="text-xl font-bold text-white">We&apos;re sorry to see you go</h3>
                <p className="text-sm text-white/50 mt-1">Help us understand why — we read every answer.</p>
              </div>

              <div className="space-y-2 mb-5">
                {REASONS.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setReason(r.id)}
                    className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm text-left transition-all ${
                      reason === r.id
                        ? 'bg-[#4ecde6]/10 border-2 border-[#4ecde6] text-white font-semibold shadow-[0_0_20px_rgba(78,205,230,0.15)]'
                        : 'bg-white/[0.02] border-2 border-[#1e1e1e] hover:border-[#4ecde6]/30 hover:bg-white/[0.04] text-white/80'
                    }`}
                  >
                    <span className="text-lg">{r.icon}</span>
                    <span>{r.label}</span>
                    {reason === r.id && (
                      <svg className="ml-auto w-4 h-4 text-[#4ecde6]" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>

              {reason && (
                <div className="mb-4">
                  <label className="block text-xs text-white/50 mb-2">
                    {reason === 'other' ? 'Tell us more (required for "Other")' : 'Anything else you’d like to share? (optional)'}
                  </label>
                  <textarea
                    value={reasonDetail}
                    onChange={(e) => setReasonDetail(e.target.value)}
                    placeholder={reason === 'other' ? 'Help us understand — we read every response.' : 'Optional. Helps your academy improve.'}
                    className="w-full p-3 rounded-xl bg-[#0a0a0a] border border-[#1e1e1e] text-sm text-white resize-none h-16 focus:outline-none focus:border-[#4ecde6]/50 placeholder:text-white/30"
                  />
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => { setStep('idle'); setReason(''); setReasonDetail('') }}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold text-white/70 hover:text-white bg-white/[0.04] border border-white/[0.08] hover:border-white/20 transition-all"
                >
                  Never mind
                </button>
                <button
                  onClick={() => {
                    if (!reason) return
                    if (reason === 'other' && !reasonDetail.trim()) return
                    // Skip the offer step when the academy has retention disabled.
                    setStep(retentionEnabled ? 'offer' : 'confirm')
                  }}
                  disabled={!reason || (reason === 'other' && !reasonDetail.trim())}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold bg-white/[0.06] text-white/70 border border-white/[0.1] hover:bg-white/[0.1] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  Continue →
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: Retention offer — reads academy config; only shown when retention_offer_enabled ── */}
          {step === 'offer' && (
            <div className="relative overflow-hidden p-6 sm:p-8">
              <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-[#4ecde6]/10 blur-[60px] pointer-events-none" />
              <div className="absolute -bottom-16 -left-16 w-40 h-40 rounded-full bg-emerald-500/8 blur-[60px] pointer-events-none" />

              <div className="relative text-center">
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-bold uppercase tracking-wider mb-4">
                  <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
                  Exclusive Offer
                </div>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-white mb-2">Wait — before you go</h3>
                <p className="text-sm text-white/60 mb-5">
                  Stay subscribed and get <strong className="text-[#4ecde6]">{retentionPercent}% off</strong> {durationLabel}.
                </p>

                <div className="relative rounded-3xl p-6 mb-5 bg-gradient-to-br from-[#4ecde6]/15 via-[#4ecde6]/5 to-transparent border-2 border-[#4ecde6]/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(78,205,230,0.2)]">
                  <p className="text-5xl sm:text-6xl font-extrabold text-[#4ecde6] tabular-nums mb-1">{retentionPercent}% OFF</p>
                  <p className="text-xs font-bold uppercase tracking-wider text-[#4ecde6]/70">{durationShort} · applied automatically</p>
                </div>

                <div className="space-y-2 text-left mb-5">
                  {[
                    `Keep your child’s place in ${className || 'class'}`,
                    `${retentionPercent}% off applied automatically — no code needed`,
                    retentionMonths === 1
                      ? 'Discount applies to your next charge only'
                      : retentionMonths === null
                        ? 'Discount applies every month for as long as you stay'
                        : `Discount applies for ${retentionMonths} months`,
                  ].map((line) => (
                    <div key={line} className="flex items-center gap-2.5 text-sm text-white/85">
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 shrink-0">
                        <svg className="w-3 h-3 text-emerald-300" fill="none" stroke="currentColor" strokeWidth={4} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                      {line}
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleStayWithDiscount}
                  disabled={loading}
                  className="relative w-full py-5 rounded-2xl font-extrabold text-base sm:text-lg transition-all hover:scale-[1.02] active:scale-[0.98] hover:brightness-110 disabled:opacity-60"
                  style={{
                    background: 'linear-gradient(135deg, #ffffff 0%, #e8f9fc 100%)',
                    color: '#0a0a0a',
                    boxShadow: '0 12px 48px rgba(78, 205, 230, 0.4), 0 0 0 3px rgba(78, 205, 230, 0.5), inset 0 -3px 0 rgba(0,0,0,0.06)',
                  }}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-[#0a0a0a]/30 border-t-[#0a0a0a] rounded-full animate-spin" />
                      Applying discount...
                    </span>
                  ) : (
                    <>🎁 Stay &amp; Get {retentionPercent}% Off →</>
                  )}
                </button>

                <button
                  onClick={() => setStep('confirm')}
                  disabled={loading}
                  className="block w-full mt-3 py-2.5 text-xs text-white/40 hover:text-white/60 transition-colors text-center"
                >
                  No thanks, cancel anyway
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Final cancel confirmation ── */}
          {step === 'confirm' && (
            <div className="p-6 sm:p-8">
              <div className="text-center mb-5">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 mb-3 text-2xl">
                  ⚠️
                </div>
                <h3 className="text-xl font-bold text-white">Are you sure?</h3>
                <p className="text-sm text-white/50 mt-1">
                  Your child will lose their place in {className ? <strong className="text-white">{className}</strong> : 'this class'}.
                </p>
              </div>

              <div className="rounded-2xl p-4 mb-3 bg-rose-500/5 border border-rose-500/20">
                <p className="text-[10px] font-bold uppercase tracking-wider text-rose-300 mb-2">What you&apos;ll lose</p>
                <ul className="space-y-2 text-sm text-white/80">
                  {[
                    'Place in class',
                    'May need to rejoin waitlist',
                    ...(retentionEnabled ? [`The ${retentionPercent}% off deal`] : []),
                  ].map((line) => (
                    <li key={line} className="flex items-center gap-2.5">
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-rose-500/20 border border-rose-500/30 shrink-0">
                        <svg className="w-3 h-3 text-rose-300" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </span>
                      {line}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Critical: explicitly tell parents subscription stays active — avoids "I was still charged?!" shock */}
              <div className="rounded-2xl p-3.5 mb-4 bg-amber-500/8 border border-amber-500/30">
                <p className="text-xs text-amber-200/90">
                  ⚠️ <strong className="text-amber-100">Heads up:</strong> Cancelling this class doesn&apos;t cancel your subscription. You&apos;ll still be charged monthly until you also cancel that.
                </p>
              </div>

              {retentionEnabled && (
                <div className="rounded-2xl p-3.5 mb-5 bg-[#4ecde6]/8 border border-[#4ecde6]/30">
                  <p className="text-sm text-white/90">
                    💡 <strong className="text-white">Last chance:</strong> Get{' '}
                    <button onClick={() => setStep('offer')} className="text-[#4ecde6] font-bold underline underline-offset-2 hover:text-[#7adeeb] transition-colors">
                      {retentionPercent}% off {durationShort}
                    </button>{' '}
                    instead.
                  </p>
                </div>
              )}

              <div className="flex flex-col-reverse sm:flex-row gap-2">
                <button
                  onClick={handleCancel}
                  disabled={loading}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/20 disabled:opacity-50 transition-all"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-rose-300/30 border-t-rose-300 rounded-full animate-spin" />
                      Cancelling...
                    </span>
                  ) : (
                    'Yes, cancel class'
                  )}
                </button>
                {retentionEnabled && (
                  <button
                    onClick={() => setStep('offer')}
                    className="flex-1 py-3 rounded-xl text-sm font-extrabold transition-all hover:scale-[1.02] active:scale-[0.98]"
                    style={{
                      background: 'linear-gradient(135deg, #ffffff 0%, #e8f9fc 100%)',
                      color: '#0a0a0a',
                      boxShadow: '0 8px 32px rgba(78, 205, 230, 0.3), 0 0 0 2px rgba(78, 205, 230, 0.5)',
                    }}
                  >
                    Get {retentionPercent}% Off →
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
