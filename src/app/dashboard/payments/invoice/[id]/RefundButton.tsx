'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { RefundKind } from '@/lib/refund-kind'

/**
 * Refund a card payment — one window, three taps (15 Oct 2026, John: "is it
 * easier to send a refund?"). It used to be a three-step wizard reachable only
 * from the receipt page; now it sits on the payment row, the family's payment
 * history and the receipt.
 *
 *   tap Refund → pick a reason (and, for a membership, whether to cancel it)
 *   → tap the red "Refund £X" button.
 *
 * Memberships: "Cancel this membership too" is ticked for payments under 35
 * days old and unticked for older ones, so a historical refund never quietly
 * ends a running membership.
 *
 * The server route (/api/admin/payments/[id]/refund) re-checks everything; the
 * pages only mount this for admins on paid card payments (src/lib/refund-kind.ts).
 */

const REASONS = [
  { value: 'customer_request', label: 'Parent asked' },
  { value: 'duplicate_booking', label: 'Paid twice' },
  { value: 'event_cancelled', label: 'Session or camp cancelled' },
  { value: 'booking_error', label: 'Booking mistake' },
  { value: 'other', label: 'Other' },
] as const

type RefundReason = (typeof REASONS)[number]['value']

export type PaymentKind = RefundKind

interface Props {
  paymentId: string
  amount: number
  player?: string | null
  /** What the payment was for (its description). */
  camp?: string | null
  academy?: string | null
  kind: PaymentKind
  /** Days since the payment; ≥35 leaves "cancel membership" unticked. */
  paymentAgeDays?: number
  /** Small button for a table row. */
  compact?: boolean
}

export default function RefundButton({ paymentId, amount, player, camp, kind, paymentAgeDays = 0, compact = false }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<RefundReason | null>(null)
  const isSubKind = kind === 'subscription'
  const [cancelSubscription, setCancelSubscription] = useState(isSubKind && paymentAgeDays < 35)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [done, setDone] = useState(false)

  function close() {
    if (busy) return
    setOpen(false)
    setReason(null)
    setError('')
  }

  async function submit() {
    if (!reason) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/payments/${paymentId}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, ...(isSubKind ? { cancel_subscription: cancelSubscription } : {}) }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `Refund failed (HTTP ${res.status})`)
      if (data.covered_message) setNotice(data.covered_message)
      if (data.cancel_warning) setError(`Refunded, but: ${data.cancel_warning}`)
      setDone(true)
      setOpen(false)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Refund failed')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <span data-testid="refund-done" className={`inline-flex flex-wrap items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 font-semibold text-emerald-300 ${compact ? 'px-2 py-0.5 text-[11px]' : 'px-4 py-2 text-sm'}`}>
        Refunded £{amount.toFixed(2)}
        {notice && <span className="font-normal text-emerald-200/80">{notice}</span>}
        {error && <span className="font-normal text-amber-300">{error}</span>}
      </span>
    )
  }

  return (
    <>
      <button
        type="button"
        data-testid="refund-open"
        onClick={() => setOpen(true)}
        className={compact
          ? 'rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/20'
          : 'inline-flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-5 py-2.5 text-sm font-semibold text-rose-300 hover:bg-rose-500/20'}
        title={`Refund £${amount.toFixed(2)} to the parent's card`}
      >
        Refund
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={close}>
          <div
            role="dialog"
            aria-label="Refund payment"
            className="w-full max-w-md rounded-xl border border-white/10 bg-[#080e18] p-6 text-left shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-white">Refund £{amount.toFixed(2)}</h2>
                <p className="mt-0.5 text-sm text-white/60">
                  {[player, camp].filter(Boolean).join(' · ') || 'Card payment'}
                </p>
              </div>
              <button onClick={close} disabled={busy} className="text-xl leading-none text-white/50 hover:text-white disabled:opacity-30" aria-label="Close">×</button>
            </div>

            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/45">Why?</p>
            <div className="mb-4 grid grid-cols-2 gap-2">
              {REASONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  data-testid={`refund-reason-${r.value}`}
                  onClick={() => setReason(r.value)}
                  className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                    reason === r.value ? 'border-[#4ecde6] bg-[#4ecde6]/10 text-white' : 'border-white/10 bg-white/[0.02] text-white/75 hover:bg-white/[0.05]'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            {isSubKind && (
              <label className="mb-4 flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <input
                  type="checkbox"
                  data-testid="refund-cancel-membership"
                  checked={cancelSubscription}
                  onChange={(e) => setCancelSubscription(e.target.checked)}
                  className="mt-1 accent-[#4ecde6]"
                />
                <span className="text-sm text-white">
                  Cancel this membership too
                  <span className="mt-0.5 block text-xs text-white/55">
                    {cancelSubscription
                      ? 'No more payments, and the child comes off the class.'
                      : 'The membership carries on and the parent is charged again next month.'}
                    {paymentAgeDays >= 35 && cancelSubscription && (
                      <span className="mt-1 block text-amber-300">This payment is {paymentAgeDays} days old. Only tick this if the membership should end now.</span>
                    )}
                  </span>
                </span>
              </label>
            )}

            <ul className="mb-5 space-y-1 text-xs text-white/55">
              <li>The full £{amount.toFixed(2)} goes back to the parent&apos;s card (5 to 10 working days).</li>
              <li>The parent is emailed to say it&apos;s on its way.</li>
              {kind === 'camp' && <li>Their place on the camp is freed.</li>}
              <li>This can&apos;t be undone.</li>
            </ul>

            {error && (
              <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">{error}</div>
            )}

            <div className="flex justify-end gap-3">
              <button onClick={close} disabled={busy} className="px-4 py-2 text-sm text-white/70 hover:text-white disabled:opacity-30">Cancel</button>
              <button
                type="button"
                data-testid="refund-confirm"
                onClick={submit}
                disabled={!reason || busy}
                className="rounded-lg bg-rose-500 px-5 py-2 text-sm font-semibold text-white hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? 'Refunding…' : `Refund £${amount.toFixed(2)}${isSubKind && cancelSubscription ? ' and cancel' : ''}`}
              </button>
            </div>
            {!reason && <p className="mt-2 text-right text-[11px] text-white/40">Pick a reason first.</p>}
          </div>
        </div>
      )}
    </>
  )
}
