'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Plan = { id: string; name: string; amount: number | null }

// "Request payment" — admin action on the player page. Opens a small dialog to
// pick a plan + first-charge date, then POSTs to the additive request-payment
// route (which emails the parent a one-tap confirm link). Renders only when the
// player has no active/pending subscription, so it can't double-bill.
export default function RequestPaymentButton({
  playerId,
  playerFirstName,
  plans,
}: {
  playerId: string
  playerFirstName: string
  plans: Plan[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [planId, setPlanId] = useState<string>(plans.length === 1 ? plans[0].id : '')
  const [firstBilling, setFirstBilling] = useState<'today' | 'next_month'>('next_month')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

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
      setSent(true)
      setLoading(false)
      router.refresh()
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); setSent(false); setError('') }}
        className="inline-flex items-center gap-2 rounded-lg bg-[#4ecde6]/12 border border-[#4ecde6]/35 text-[#4ecde6] px-3.5 py-2 text-sm font-semibold hover:bg-[#4ecde6]/20 transition-colors"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></svg>
        Request payment
      </button>

      {open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => !loading && setOpen(false)} />
          <div className="relative w-full max-w-md rounded-2xl border border-white/[0.12] bg-[#1a1a1a] shadow-2xl">
            <div className="px-5 py-4 border-b border-white/[0.08]">
              <h3 className="text-white font-bold text-base">Request payment — {playerFirstName}</h3>
              <p className="text-xs text-white/40 mt-0.5">We&apos;ll email their parent a one-tap link to add a card.</p>
            </div>

            {sent ? (
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
                    {plans.map((p) => (
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
                </div>

                <div>
                  <p className="text-[11px] uppercase tracking-wider text-white/40 font-semibold mb-2">First charge</p>
                  <div className="flex gap-2">
                    {([['today', 'Today · prorated'], ['next_month', '1st of next month']] as const).map(([val, label]) => (
                      <button
                        type="button"
                        key={val}
                        onClick={() => setFirstBilling(val)}
                        className={`flex-1 text-center py-2.5 rounded-xl border text-sm transition-colors ${firstBilling === val ? 'border-[#4ecde6] bg-[#4ecde6]/[0.06] text-white font-semibold' : 'border-white/[0.08] text-white/60 hover:border-white/20'}`}
                      >
                        {label}
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
