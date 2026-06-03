'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const REASONS = [
  { id: 'too_expensive', label: 'Too expensive', icon: '💰' },
  { id: 'not_using', label: 'Not using it enough', icon: '📉' },
  { id: 'switching', label: 'Switching to another academy', icon: '🔄' },
  { id: 'child_stopped', label: 'My child has stopped playing', icon: '⚽' },
  { id: 'unhappy', label: 'Not happy with the service', icon: '😞' },
  { id: 'other', label: 'Other reason', icon: '💬' },
]

type Step = 'reason' | 'policy' | 'offer' | 'confirm' | 'retained' | 'cancelled'

export default function CancelFlow({
  subscriptionId,
  planName,
  monthlyAmount,
  retentionEnabled = true,
  retentionPercent = 50,
  retentionMonths = 1,
  cancellationPolicy = null,
  cancellationNoticeDays = 0,
  academyName = 'your academy',
  currentPeriodEnd = null,
}: {
  subscriptionId: string
  planName: string
  monthlyAmount: number
  retentionEnabled?: boolean
  retentionPercent?: number
  retentionMonths?: number | null
  cancellationPolicy?: string | null
  cancellationNoticeDays?: number
  academyName?: string
  /** ISO string of the parent's current Stripe billing-period end. Used to
   *  compute the effective cancellation date when notice_days === 0. */
  currentPeriodEnd?: string | null
}) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('reason')
  const [reason, setReason] = useState('')
  const [reasonDetail, setReasonDetail] = useState('')
  const [loading, setLoading] = useState(false)
  const [endDate, setEndDate] = useState('')
  const [discountedAmount, setDiscountedAmount] = useState('')
  const [saving, setSaving] = useState('')

  const discountFraction = Math.max(1, Math.min(90, retentionPercent)) / 100
  const discountPrice = (monthlyAmount * (1 - discountFraction)).toFixed(2)
  const savingAmount = (monthlyAmount * discountFraction).toFixed(2)
  // Total saving only makes sense for a finite repeating discount (months > 1).
  // For 'once' (months === 1) the saving IS the saving — no need to multiply.
  // For 'forever' (months === null) we can't compute a total.
  const totalSavingOverDuration = retentionMonths && retentionMonths > 1
    ? (monthlyAmount * discountFraction * retentionMonths).toFixed(2)
    : null
  // Duration label that MATCHES the Stripe coupon configuration applied by
  // /api/stripe/retain (months===1 → duration='once'; null → 'forever'; N>1 → repeating).
  // months===1 wording avoids "for 1 month" which reads ambiguously vs "your next month
  // at X% off" — which is exactly what Stripe's 'once' coupon does.
  const durationText =
    retentionMonths === null
      ? 'forever'
      : retentionMonths === 1
        ? 'on your next month'
        : `for ${retentionMonths} months`
  // Short-form noun-phrase variants for headings + buttons.
  const durationTextShort =
    retentionMonths === null
      ? 'every month'
      : retentionMonths === 1
        ? 'next month'
        : `for ${retentionMonths} months`

  // ─── Effective cancellation date math (matches /api/stripe/cancel logic) ───
  //   notice_days > 0  → today + notice_days
  //   notice_days = 0  → current_period_end (Stripe's cancel_at_period_end default)
  //   unknown          → fall back to a generic sentence
  function fmtDate(d: Date): string {
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  }
  let computedEndDate: string | null = null
  if (cancellationNoticeDays > 0) {
    const d = new Date(Date.now() + cancellationNoticeDays * 86400_000)
    computedEndDate = fmtDate(d)
  } else if (currentPeriodEnd) {
    const d = new Date(currentPeriodEnd)
    if (!Number.isNaN(d.getTime())) computedEndDate = fmtDate(d)
  }

  // Steps shown in the progress dots — dynamic based on whether the academy
  // offers a retention discount.
  const flowSteps: Step[] = retentionEnabled
    ? ['reason', 'policy', 'offer', 'confirm']
    : ['reason', 'policy', 'confirm']

  async function handleAcceptOffer() {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/retain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionId }),
      })
      const data = await res.json()
      if (data.success) {
        setDiscountedAmount(data.discountedAmount)
        setSaving(data.saving)
        setStep('retained')
      } else {
        alert(data.error || 'Something went wrong')
      }
    } catch {
      alert('Failed to apply discount')
    }
    setLoading(false)
  }

  async function handleConfirmCancel() {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriptionId,
          reason,
          reasonDetail,
          // Tell the server whether the save-offer was shown but declined.
          // Drives the cancellations.offered_discount column + the admin-notify
          // email's "Declined" vs "Not shown" copy.
          offerWasShown: retentionEnabled,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setEndDate(data.endDate)
        setStep('cancelled')
      } else {
        alert(data.error || 'Something went wrong')
      }
    } catch {
      alert('Failed to cancel subscription')
    }
    setLoading(false)
  }

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Progress dots — dynamic 3- or 4-dot depending on whether the offer step is in the flow */}
      <div className="flex justify-center items-center gap-2 mb-8" data-testid="cancel-flow-progress">
        {flowSteps.map((s, i) => {
          const currentIdx = flowSteps.indexOf(step as Step)
          const isCurrent = step === s
          // Past = a step we've already navigated through. End-states ('retained', 'cancelled')
          // mean all flow steps are conceptually behind us.
          const inFlow = (flowSteps as Step[]).includes(step as Step)
          const isPast = inFlow ? currentIdx > i : true
          return (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`transition-all duration-300 rounded-full ${
                  isCurrent
                    ? 'w-3 h-3 bg-[#4ecde6] shadow-[0_0_12px_rgba(78,205,230,0.6)]'
                    : isPast
                    ? 'w-2 h-2 bg-[#4ecde6]/60'
                    : 'w-2 h-2 bg-white/15'
                }`}
              />
              {i < flowSteps.length - 1 && <div className={`w-6 h-px ${isPast ? 'bg-[#4ecde6]/40' : 'bg-white/10'}`} />}
            </div>
          )
        })}
      </div>

      {/* ═══ STEP 1: Reason ═══ */}
      {step === 'reason' && (
        <div className="bg-gradient-to-br from-[#141414] via-[#0f1416] to-[#0a0a0a] rounded-3xl border border-[#1e1e1e] p-6 sm:p-8 shadow-2xl">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.08] mb-3 text-3xl">
              😔
            </div>
            <h1 className="text-2xl font-bold text-white">We&apos;re sorry to see you go</h1>
            <p className="text-white/50 text-sm mt-2 max-w-sm mx-auto">
              Before you cancel, help us understand why so we can do better.
            </p>
          </div>

          <div className="space-y-2 mb-6">
            {REASONS.map((r) => (
              <button
                key={r.id}
                onClick={() => setReason(r.id)}
                className={`w-full flex items-center gap-3 p-3.5 rounded-xl text-left text-sm transition-all ${
                  reason === r.id
                    ? 'bg-[#4ecde6]/10 border-2 border-[#4ecde6] text-white font-semibold shadow-[0_0_24px_rgba(78,205,230,0.15)]'
                    : 'border-2 border-[#1e1e1e] bg-white/[0.02] hover:border-[#4ecde6]/30 hover:bg-white/[0.04] text-white/80'
                }`}
              >
                <span className="text-xl">{r.icon}</span>
                <span>{r.label}</span>
                {reason === r.id && (
                  <svg className="ml-auto w-5 h-5 text-[#4ecde6]" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>

          {reason && (
            <div className="mb-4" data-testid="reason-detail-block">
              <label className="block text-xs text-white/50 mb-2">
                {reason === 'other'
                  ? 'Tell us more (required for "Other")'
                  : 'Anything else you’d like to share? (optional)'}
              </label>
              <textarea
                value={reasonDetail}
                onChange={(e) => setReasonDetail(e.target.value)}
                placeholder={reason === 'other'
                  ? 'Help us understand — we read every response.'
                  : 'Optional. Helps your academy improve.'}
                className="w-full p-3 rounded-xl bg-[#0a0a0a] border border-[#1e1e1e] text-sm text-white resize-none h-20 focus:outline-none focus:border-[#4ecde6]/50 placeholder:text-white/30"
                data-testid="reason-detail-textarea"
              />
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => router.push('/dashboard/payments')}
              className="flex-1 py-3.5 rounded-xl text-sm font-semibold text-white/70 hover:text-white bg-white/[0.04] border border-white/[0.08] hover:border-white/20 transition-all"
            >
              Never mind
            </button>
            <button
              onClick={() => {
                // Reason MUST be selected before continuing.
                // For 'other', also require some detail.
                if (!reason) return
                if (reason === 'other' && !reasonDetail.trim()) return
                setStep('policy')
              }}
              disabled={!reason || (reason === 'other' && !reasonDetail.trim())}
              className="flex-1 py-3.5 rounded-xl text-sm font-semibold bg-white/[0.06] text-white/70 border border-white/[0.1] hover:bg-white/[0.1] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* ═══ STEP 2: Cancellation Policy ═══ */}
      {step === 'policy' && (
        <div className="bg-gradient-to-br from-[#141414] via-[#0f1416] to-[#0a0a0a] rounded-3xl border border-[#1e1e1e] p-6 sm:p-8 shadow-2xl" data-testid="policy-step">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.08] mb-3 text-3xl">
              📄
            </div>
            <h1 className="text-2xl font-bold text-white">Cancellation policy</h1>
            <p className="text-white/50 text-sm mt-2 max-w-sm mx-auto">
              Here&apos;s what happens after you confirm.
            </p>
          </div>

          {/* Three bullets that match the brief: notice period, end date, what happens during */}
          <div className="rounded-2xl p-5 mb-5 bg-white/[0.03] border border-white/[0.08] space-y-4" data-testid="policy-bullets">
            <div className="flex gap-3">
              <span className="text-xl shrink-0">⏱️</span>
              <div className="text-sm text-white/85 leading-relaxed">
                {cancellationNoticeDays > 0 ? (
                  <><strong className="text-white">{academyName}</strong> requires <strong className="text-white">{cancellationNoticeDays} day{cancellationNoticeDays === 1 ? '' : 's'}</strong> notice.</>
                ) : (
                  <><strong className="text-white">{academyName}</strong> has no minimum notice period — your cancellation takes effect at the end of your current billing month.</>
                )}
              </div>
            </div>
            <div className="flex gap-3">
              <span className="text-xl shrink-0">📅</span>
              <div className="text-sm text-white/85 leading-relaxed">
                {computedEndDate ? (
                  <>Your membership will remain active until <strong className="text-white">{computedEndDate}</strong>.</>
                ) : (
                  <>Your membership will remain active until the end of your current billing period.</>
                )}
              </div>
            </div>
            <div className="flex gap-3">
              <span className="text-xl shrink-0">⚽</span>
              <div className="text-sm text-white/85 leading-relaxed">
                You&apos;ll continue to have full access to all booked sessions during this period
                {cancellationNoticeDays > 0 ? ', and will be billed for any sessions inside the notice window' : ''}.
              </div>
            </div>
          </div>

          {/* Optional academy-authored policy text */}
          {cancellationPolicy && (
            <div className="rounded-2xl p-4 mb-5 bg-white/[0.02] border border-white/[0.06]" data-testid="cancellation-policy-text">
              <p className="text-xs font-bold uppercase tracking-wider text-white/50 mb-2">
                {academyName}&apos;s policy
              </p>
              <p className="text-sm text-white/75 leading-relaxed whitespace-pre-wrap">
                {cancellationPolicy}
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setStep('reason')}
              className="flex-1 py-3.5 rounded-xl text-sm font-semibold text-white/70 hover:text-white bg-white/[0.04] border border-white/[0.08] hover:border-white/20 transition-all"
            >
              ← Back
            </button>
            <button
              onClick={() => setStep(retentionEnabled ? 'offer' : 'confirm')}
              className="flex-1 py-3.5 rounded-xl text-sm font-semibold bg-white/[0.06] text-white border border-white/[0.1] hover:bg-white/[0.1] transition-all"
              data-testid="policy-continue"
            >
              I understand — continue →
            </button>
          </div>
        </div>
      )}

      {/* ═══ STEP 2: Retention Offer (the showstopper) ═══ */}
      {step === 'offer' && (
        <div className="relative overflow-hidden bg-gradient-to-br from-[#0a1c1e] via-[#0a1416] to-[#0a0a0a] rounded-3xl border-2 border-[#4ecde6]/30 p-6 sm:p-8 shadow-[0_20px_60px_rgba(78,205,230,0.15)]">
          {/* Decorative glows */}
          <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-[#4ecde6]/10 blur-[80px] pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-56 h-56 rounded-full bg-emerald-500/8 blur-[80px] pointer-events-none" />

          <div className="relative">
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-bold uppercase tracking-wider mb-4">
                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
                Exclusive Offer
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-2">
                Wait — before you go
              </h1>
              <p className="text-white/60 text-sm sm:text-base" data-testid="offer-headline">
                {retentionMonths === 1
                  ? <>Stay and get <strong className="text-[#4ecde6]">{retentionPercent}% off your next month</strong>.</>
                  : retentionMonths === null
                    ? <>Stay and get <strong className="text-[#4ecde6]">{retentionPercent}% off</strong> for every month you keep your subscription.</>
                    : <>Stay and get <strong className="text-[#4ecde6]">{retentionPercent}% off</strong> for the next <strong className="text-[#4ecde6]">{retentionMonths} months</strong>.</>
                }
              </p>
            </div>

            {/* Big pricing card — the hero */}
            <div className="relative rounded-3xl p-6 mb-6 bg-gradient-to-br from-[#4ecde6]/15 via-[#4ecde6]/5 to-transparent border-2 border-[#4ecde6]/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(78,205,230,0.2)]">
              <div className="text-center">
                <p className="text-white/40 text-xs font-medium uppercase tracking-wider mb-1">Your current price</p>
                <p className="text-base text-white/50 line-through font-medium mb-3">
                  £{monthlyAmount.toFixed(2)}/month
                </p>
                <p className="text-white/60 text-xs font-medium uppercase tracking-wider mb-1">
                  {retentionMonths === 1 ? 'Your price next month' : retentionMonths === null ? 'Your new monthly price' : 'Your price for the next ' + retentionMonths + ' months'}
                </p>
                <div className="flex items-baseline justify-center gap-1 mb-3">
                  <span className="text-5xl sm:text-6xl font-extrabold text-[#4ecde6] tabular-nums">
                    £{discountPrice}
                  </span>
                  <span className="text-base text-[#4ecde6]/70 font-semibold">/mo</span>
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 17l5-5-5-5M6 17l5-5-5-5" />
                  </svg>
                  {retentionMonths === 1
                    ? `Save £${savingAmount} on your next charge`
                    : retentionMonths === null
                      ? `Save £${savingAmount} every month, forever`
                      : `Save £${savingAmount}/month · £${totalSavingOverDuration} total`}
                </div>
                {retentionMonths === 1 && (
                  <p className="text-[10px] text-white/40 mt-2.5">After your next month, your subscription returns to £{monthlyAmount.toFixed(2)}/month.</p>
                )}
              </div>
            </div>

            <div className="space-y-2.5 mb-6">
              {[
                'Keep your child’s spot in class',
                `${retentionPercent}% off applied automatically — no code needed`,
                retentionMonths === 1
                  ? 'Discount applies to your next charge only'
                  : retentionMonths === null
                    ? 'Discount applies every month for as long as you stay'
                    : `Discount applies for ${retentionMonths} months, then your subscription returns to its normal price`,
                'Cancel any time after — no strings',
              ].map((line) => (
                <div key={line} className="flex items-center gap-2.5 text-sm text-white/80">
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
              onClick={handleAcceptOffer}
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
              className="block w-full mt-3 py-2.5 text-xs text-white/40 hover:text-white/60 transition-colors text-center"
            >
              No thanks, cancel anyway
            </button>
          </div>
        </div>
      )}

      {/* ═══ STEP 3: Final Confirmation ═══ */}
      {step === 'confirm' && (
        <div className="bg-gradient-to-br from-[#141414] via-[#161010] to-[#0a0a0a] rounded-3xl border border-[#1e1e1e] p-6 sm:p-8 shadow-2xl">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 mb-3 text-2xl">
              ⚠️
            </div>
            <h1 className="text-2xl font-bold text-white">Are you sure?</h1>
            <p className="text-white/50 text-sm mt-2">
              Your subscription stays active until your current billing period ends.
            </p>
          </div>

          {/* ─── Policy summary on confirm step — every fact, no surprises ─── */}
          <div className="rounded-2xl p-4 mb-4 bg-white/[0.03] border border-white/[0.08] space-y-2.5" data-testid="cancellation-policy">
            <p className="text-xs font-bold uppercase tracking-wider text-white/60">
              What happens after you confirm
            </p>
            <ul className="space-y-2 text-sm text-white/85">
              <li className="flex gap-2">
                <span className="text-white/40 shrink-0">→</span>
                <span data-testid="confirm-effective-date">
                  Cancellation takes effect on <strong className="text-white">{computedEndDate || 'the end of your current billing period'}</strong>
                  {cancellationNoticeDays > 0 ? ` (${cancellationNoticeDays} day${cancellationNoticeDays === 1 ? '' : 's'} from today).` : '.'}
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-white/40 shrink-0">→</span>
                <span>
                  {cancellationNoticeDays > 0
                    ? <>You&apos;ll be billed normally during the {cancellationNoticeDays}-day notice period.</>
                    : <>No further charges after the current period ends.</>
                  }
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-white/40 shrink-0">→</span>
                <span>Full access continues until the effective date above.</span>
              </li>
            </ul>
            {cancellationPolicy && (
              <p className="text-xs text-white/55 leading-relaxed mt-3 whitespace-pre-wrap border-t border-white/[0.06] pt-3">
                {cancellationPolicy}
              </p>
            )}
          </div>

          <div className="rounded-2xl p-5 mb-5 bg-rose-500/5 border border-rose-500/20">
            <p className="text-xs font-bold uppercase tracking-wider text-rose-300 mb-3">What you&apos;ll lose</p>
            <ul className="space-y-2 text-sm text-white/80">
              {[
                'Your child’s spot in class',
                'Access to progress reports',
                'Session attendance tracking',
                'Coach feedback &amp; reviews',
              ].map((line) => (
                <li key={line} className="flex items-center gap-2.5">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-rose-500/20 border border-rose-500/30 shrink-0">
                    <svg className="w-3 h-3 text-rose-300" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </span>
                  <span dangerouslySetInnerHTML={{ __html: line }} />
                </li>
              ))}
            </ul>
          </div>

          {retentionEnabled && (
            <div className="rounded-2xl p-4 mb-5 bg-[#4ecde6]/8 border border-[#4ecde6]/30">
              <p className="text-sm text-white/90">
                💡 <strong className="text-white">Last chance:</strong> Get{' '}
                <button
                  onClick={() => setStep('offer')}
                  className="text-[#4ecde6] font-bold underline underline-offset-2 hover:text-[#7adeeb] transition-colors"
                >
                  {retentionPercent}% off {durationTextShort}
                </button>{' '}
                instead of leaving.
              </p>
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-3">
            <button
              onClick={handleConfirmCancel}
              disabled={loading}
              className="flex-1 py-3.5 rounded-xl text-sm font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/20 disabled:opacity-50 transition-all"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-rose-300/30 border-t-rose-300 rounded-full animate-spin" />
                  Cancelling...
                </span>
              ) : (
                'Yes, cancel subscription'
              )}
            </button>
            {retentionEnabled && (
              <button
                onClick={() => setStep('offer')}
                className="flex-1 py-3.5 rounded-xl text-sm font-extrabold transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  background: 'linear-gradient(135deg, #ffffff 0%, #e8f9fc 100%)',
                  color: '#0a0a0a',
                  boxShadow: '0 8px 32px rgba(78, 205, 230, 0.3), 0 0 0 2px rgba(78, 205, 230, 0.5)',
                }}
              >
                Get {retentionPercent}% Off {durationTextShort === 'every month' ? 'instead' : durationTextShort} →
              </button>
            )}
          </div>
        </div>
      )}

      {/* ═══ RETAINED: Accepted the offer ═══ */}
      {step === 'retained' && (
        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500/10 via-[#0a1614] to-[#0a0a0a] rounded-3xl border-2 border-emerald-500/40 p-6 sm:p-8 shadow-[0_20px_60px_rgba(16,185,129,0.2)] text-center">
          <div className="absolute -top-12 -right-12 w-56 h-56 rounded-full bg-emerald-500/15 blur-[60px] pointer-events-none" />
          <div className="relative">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-emerald-500/15 border-2 border-emerald-500/40 mb-4 text-4xl">
              🎉
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-3">Welcome back!</h1>
            <p className="text-white/70 mb-5 text-sm sm:text-base">
              {retentionMonths === 1 ? (
                <>Your <strong className="text-emerald-300">{retentionPercent}% discount</strong> applies to your next charge.
                  <br className="hidden sm:block" /> You&apos;ll pay{' '}
                  <strong className="text-emerald-300 text-lg">£{discountedAmount || discountPrice}</strong> next month
                  {saving && <> (saving £{saving})</>}, then back to £{monthlyAmount.toFixed(2)}/month.
                </>
              ) : retentionMonths === null ? (
                <>Your <strong className="text-emerald-300">{retentionPercent}% discount</strong> applies every month.
                  <br className="hidden sm:block" /> You now pay{' '}
                  <strong className="text-emerald-300 text-lg">£{discountedAmount || discountPrice}/month</strong>
                  {saving && <> (saving £{saving}/month)</>}.
                </>
              ) : (
                <>Your <strong className="text-emerald-300">{retentionPercent}% discount</strong> applies for the next {retentionMonths} months.
                  <br className="hidden sm:block" /> You&apos;ll pay{' '}
                  <strong className="text-emerald-300 text-lg">£{discountedAmount || discountPrice}/month</strong> for {retentionMonths} months
                  {saving && <> (saving £{saving}/month)</>}, then back to £{monthlyAmount.toFixed(2)}/month.
                </>
              )}
            </p>
            <div className="rounded-2xl p-4 mb-6 bg-emerald-500/10 border border-emerald-500/30">
              <p className="text-sm text-emerald-300 font-semibold">
                ✓ Discount applied — no further action needed
              </p>
            </div>
            <button
              onClick={() => router.push('/dashboard/payments')}
              className="w-full py-4 rounded-2xl text-sm sm:text-base font-extrabold transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: 'linear-gradient(135deg, #ffffff 0%, #e8f9fc 100%)',
                color: '#0a0a0a',
                boxShadow: '0 12px 40px rgba(16, 185, 129, 0.3), 0 0 0 2px rgba(16, 185, 129, 0.5)',
              }}
            >
              Back to Dashboard →
            </button>
          </div>
        </div>
      )}

      {/* ═══ CANCELLED: Subscription ended ═══ */}
      {step === 'cancelled' && (
        <div className="bg-gradient-to-br from-[#141414] via-[#0f1416] to-[#0a0a0a] rounded-3xl border border-[#1e1e1e] p-6 sm:p-8 shadow-2xl text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.08] mb-3 text-3xl">
            👋
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Subscription Cancelled</h1>
          <p className="text-white/60 mb-4 text-sm">Your {planName} subscription has been cancelled.</p>
          {endDate && (
            <div className="rounded-2xl p-4 mb-6 bg-amber-500/10 border border-amber-500/30">
              <p className="text-sm text-amber-200">
                📅 You still have access until <strong className="text-amber-100">{endDate}</strong>
              </p>
            </div>
          )}
          <p className="text-white/50 text-sm mb-6">
            Changed your mind? You can re-subscribe any time from the payments page.
          </p>
          <button
            onClick={() => router.push('/dashboard/payments')}
            className="w-full py-3.5 rounded-xl text-sm font-semibold bg-white/[0.06] text-white border border-white/[0.1] hover:bg-white/[0.1] transition-all"
          >
            Back to Payments
          </button>
        </div>
      )}
    </div>
  )
}
