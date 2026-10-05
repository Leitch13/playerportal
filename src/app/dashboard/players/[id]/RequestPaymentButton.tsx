'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Plan = { id: string; name: string; amount: number | null }

// "Request payment" — admin action on the player page. Opens a small dialog to
// pick a plan + first-charge date, then POSTs to the additive request-payment
// route (which emails the parent a one-tap confirm link). Renders only when the
// player has no active/pending subscription, so it can't double-bill.
//
// Oct 2026 — also used on Enrolments → "In a class, not paying":
//   • `compact` draws a small row-sized button.
//   • `pendingSentAt` means a request is already waiting for this player, so the
//     button becomes "Resend": one tap re-sends the same link (no new request).
//   • The first-charge choice now opens on "Now", which is the billing rule
//     (the sessions left this month, then the plan from the 1st). "From the
//     1st" is the admin saying this month is already paid for.
//   • The route now says whether the email really went; a failure is shown.
export default function RequestPaymentButton({
  playerId,
  playerFirstName,
  plans,
  morePlans = [],
  compact = false,
  pendingSentAt = null,
  lockAfterSent = false,
  onSent,
}: {
  playerId: string
  playerFirstName: string
  plans: Plan[]
  /** The academy's other plans, when `plans` has been narrowed to the child's class. Behind "Show all plans". */
  morePlans?: Plan[]
  compact?: boolean
  pendingSentAt?: string | null
  /** Enrol form: once a link has gone, the button reads "Payment link sent" and can't send twice. */
  lockAfterSent?: boolean
  onSent?: (emailed: boolean) => void
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [planId, setPlanId] = useState<string>(plans.length === 1 ? plans[0].id : '')
  const [showAll, setShowAll] = useState(false)
  const offered = showAll ? [...plans, ...morePlans] : plans
  const [firstBilling, setFirstBilling] = useState<'today' | 'next_month'>('today')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [everSent, setEverSent] = useState(false)
  const [warning, setWarning] = useState('')
  const [resent, setResent] = useState<'idle' | 'sending' | 'sent'>('idle')

  // A request is already waiting: one tap re-sends the same link.
  async function resend() {
    setResent('sending')
    setError('')
    try {
      const res = await fetch(`/api/admin/players/${playerId}/request-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resend: true }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Could not resend the link.')
        setResent('idle')
        return
      }
      setResent('sent')
      router.refresh()
    } catch {
      setError('Something went wrong. Please try again.')
      setResent('idle')
    }
  }

  if (pendingSentAt) {
    return (
      <span className="inline-flex flex-col items-end gap-1">
        <button
          type="button"
          onClick={resend}
          disabled={resent !== 'idle'}
          className="inline-flex items-center rounded-lg border border-[#293b58] bg-[#142236] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:border-[#4ecde6]/50 disabled:opacity-60"
        >
          {resent === 'sending' ? 'Sending…' : resent === 'sent' ? 'Link sent again' : 'Resend link'}
        </button>
        {error && <span className="max-w-[240px] text-right text-[11px] leading-snug text-[#e0736d]">{error}</span>}
      </span>
    )
  }

  if (plans.length === 0) return null

  async function submit() {
    if (!planId) { setError('Choose a plan.'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/players/${playerId}/request-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, firstBilling }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Could not send the request.')
        setLoading(false)
        return
      }
      // The request is saved either way; `emailed: false` means the parent
      // hasn't been told yet, so say so instead of "sent".
      setWarning(data.emailed === false ? (data.warning || 'The request is saved, but the email didn\'t send. Press Resend.') : '')
      setSent(true)
      setEverSent(true)
      onSent?.(data.emailed !== false)
      setLoading(false)
      router.refresh()
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <>
      {lockAfterSent && everSent && !open ? (
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#67c79a]/40 px-3.5 py-2 text-sm font-semibold text-[#67c79a]" data-testid="request-payment-sent">
          {warning ? 'Saved, not emailed yet' : 'Payment link sent'}
        </span>
      ) : (
      <button
        type="button"
        onClick={() => { if (lockAfterSent && everSent) return; setOpen(true); setSent(false); setError(''); setWarning('') }}
        className={compact
          ? 'inline-flex items-center rounded-lg border border-[#4ecde6]/35 bg-[#4ecde6]/[0.12] px-3 py-1.5 text-xs font-semibold text-[#4ecde6] transition-colors hover:bg-[#4ecde6]/20'
          : 'inline-flex items-center gap-2 rounded-lg bg-[#4ecde6]/12 border border-[#4ecde6]/35 text-[#4ecde6] px-3.5 py-2 text-sm font-semibold hover:bg-[#4ecde6]/20 transition-colors'}
      >
        {!compact && <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></svg>}
        Request payment
      </button>
      )}

      {open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 text-left">
          <div className="absolute inset-0 bg-black/60" onClick={() => !loading && setOpen(false)} />
          <div className="relative w-full max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl border border-white/[0.12] bg-[#142236] shadow-2xl">
            <div className="px-5 py-4 border-b border-white/[0.08]">
              <h3 className="text-white font-bold text-base">Request payment — {playerFirstName}</h3>
              <p className="text-xs text-white/40 mt-0.5">We&apos;ll email their parent a one-tap link to add a card.</p>
            </div>

            {sent && warning ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm font-semibold text-[#d8a95a]">Saved, but not emailed</p>
                <p className="mt-2 text-sm text-white/70">{warning}</p>
                <button type="button" onClick={() => setOpen(false)} className="mt-5 text-sm font-semibold text-white/70 hover:text-white">Close</button>
              </div>
            ) : sent ? (
              <div className="px-5 py-8 text-center">
                <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center bg-[#4ecde6]/15">
                  <svg className="w-8 h-8" fill="none" stroke="#4ecde6" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                </div>
                <p className="text-sm text-white/80">Payment link sent to {playerFirstName}&apos;s parent.</p>
                <button type="button" onClick={() => setOpen(false)} className="mt-5 text-sm font-semibold text-white/70 hover:text-white">Done</button>
              </div>
            ) : (
              <div className="px-5 py-4 space-y-4">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-white/40 font-semibold mb-2">Membership plan</p>
                  <div className="space-y-2">
                    {offered.map((p) => (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => setPlanId(p.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors ${planId === p.id ? 'border-[#4ecde6] bg-[#4ecde6]/[0.06]' : 'border-white/[0.08] hover:border-white/20'}`}
                      >
                        <span className={`w-4 h-4 rounded-full border-2 grid place-items-center flex-none ${planId === p.id ? 'border-[#4ecde6]' : 'border-white/25'}`}>
                          {planId === p.id && <span className="w-2 h-2 rounded-full bg-[#4ecde6]" />}
                        </span>
                        <span className="text-sm text-white font-medium">{p.name}</span>
                        <span className="ml-auto text-sm font-bold text-white tabular-nums">£{Number(p.amount || 0).toFixed(0)}</span>
                      </button>
                    ))}
                  </div>
                  {morePlans.length > 0 && !showAll && (
                    <button type="button" onClick={() => setShowAll(true)} data-testid="show-all-plans" className="mt-2 text-xs font-semibold text-white/50 hover:text-white">
                      {plans.length === 1 ? 'Not this plan? Show all plans' : 'Show all plans'}
                    </button>
                  )}
                </div>

                <div>
                  <p className="text-[11px] uppercase tracking-wider text-white/40 font-semibold mb-2">When do they start paying?</p>
                  <div className="space-y-2">
                    {([
                      ['today', 'Now', 'They pay for the sessions left this month, then the full plan from the 1st.'],
                      ['next_month', 'From the 1st of next month', 'Nothing today. Use this if they\'ve already paid you for this month.'],
                    ] as const).map(([val, label, hint]) => (
                      <button
                        type="button"
                        key={val}
                        onClick={() => setFirstBilling(val)}
                        className={`w-full text-left px-3 py-2.5 rounded-xl border transition-colors ${firstBilling === val ? 'border-[#4ecde6] bg-[#4ecde6]/[0.06]' : 'border-white/[0.08] hover:border-white/20'}`}
                      >
                        <span className={`block text-sm ${firstBilling === val ? 'text-white font-semibold' : 'text-white/80'}`}>{label}</span>
                        <span className="block text-xs text-white/45 mt-0.5">{hint}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {error && (
                  <div className="px-3.5 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
                )}

                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => setOpen(false)} disabled={loading} className="flex-1 py-2.5 rounded-xl border border-white/[0.12] text-white/70 text-sm font-semibold hover:bg-white/5 transition-colors disabled:opacity-50">Cancel</button>
                  <button type="button" onClick={submit} disabled={loading || !planId} className="flex-1 py-2.5 rounded-xl bg-[#4ecde6] text-[#072830] text-sm font-bold hover:brightness-105 transition disabled:opacity-50">
                    {loading ? 'Sending…' : 'Send payment link'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
