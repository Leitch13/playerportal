'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Refunds Phase 1A — admin refund UI.
 *
 * Three-step confirmation flow (mirrors CancelFlow pattern):
 *   Step 1 — Reason picker
 *   Step 2 — Review (player / camp / amount / academy)
 *   Step 3 — Final confirm + submit
 *
 * After success the button disables itself + nudges the parent page to
 * refresh (router.refresh()) so the status badge + payment_status in
 * the invoice body update without a manual reload.
 *
 * Visibility: only mounted when the server page has already verified
 * the caller is admin AND the payment is a paid camp. No client-side
 * gate beyond what the parent passes via props.
 */

const REASONS = [
  { value: 'customer_request', label: 'Customer request' },
  { value: 'duplicate_booking', label: 'Duplicate booking' },
  { value: 'event_cancelled', label: 'Event cancelled' },
  { value: 'booking_error', label: 'Booking error' },
  { value: 'other', label: 'Other' },
] as const

type RefundReason = (typeof REASONS)[number]['value']

interface Props {
  paymentId: string
  amount: number
  player?: string | null
  camp?: string | null
  academy?: string | null
}

export default function RefundButton({
  paymentId,
  amount,
  player,
  camp,
  academy,
}: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [reason, setReason] = useState<RefundReason | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  function close() {
    if (busy) return
    setOpen(false)
    setStep(1)
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
        body: JSON.stringify({ reason }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || `Refund failed (HTTP ${res.status})`)
      }
      setDone(true)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Refund failed')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <span className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-sm font-medium">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        Refunded
      </span>
    )
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
          />
        </svg>
        Refund Payment
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={close}
        >
          <div
            className="bg-[#0a0a0a] border border-white/10 rounded-xl shadow-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">
                {step === 1 && 'Refund — Step 1 of 3'}
                {step === 2 && 'Refund — Step 2 of 3'}
                {step === 3 && 'Refund — Step 3 of 3'}
              </h2>
              <button
                onClick={close}
                disabled={busy}
                className="text-white/50 hover:text-white disabled:opacity-30 text-xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Step 1 — Reason picker */}
            {step === 1 && (
              <>
                <p className="text-sm text-white/70 mb-4">
                  Why are you refunding this payment?
                </p>
                <div className="space-y-2 mb-6">
                  {REASONS.map((r) => (
                    <label
                      key={r.value}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors ${
                        reason === r.value
                          ? 'bg-[#4ecde6]/10 border-[#4ecde6] text-white'
                          : 'bg-white/[0.02] border-white/10 text-white/80 hover:bg-white/[0.04]'
                      }`}
                    >
                      <input
                        type="radio"
                        name="refund_reason"
                        value={r.value}
                        checked={reason === r.value}
                        onChange={() => setReason(r.value)}
                        className="accent-[#4ecde6]"
                      />
                      <span className="text-sm">{r.label}</span>
                    </label>
                  ))}
                </div>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={close}
                    className="px-4 py-2 text-sm text-white/70 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setStep(2)}
                    disabled={!reason}
                    className="px-5 py-2 bg-[#4ecde6] text-black font-semibold rounded-lg text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#3bb8d0]"
                  >
                    Next →
                  </button>
                </div>
              </>
            )}

            {/* Step 2 — Review */}
            {step === 2 && (
              <>
                <p className="text-sm text-white/70 mb-4">
                  Please review the refund details before continuing.
                </p>
                <div className="bg-white/[0.03] border border-white/10 rounded-lg p-4 mb-6 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-white/50">Player</span>
                    <span className="text-white">{player || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/50">Camp</span>
                    <span className="text-white text-right">{camp || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/50">Academy</span>
                    <span className="text-white">{academy || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/50">Reason</span>
                    <span className="text-white">
                      {REASONS.find((r) => r.value === reason)?.label}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-white/10 pt-2 mt-2">
                    <span className="text-white/50">Refund amount</span>
                    <span className="text-emerald-400 font-bold">
                      £{amount.toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setStep(1)}
                    className="px-4 py-2 text-sm text-white/70 hover:text-white"
                  >
                    ← Back
                  </button>
                  <button
                    onClick={() => setStep(3)}
                    className="px-5 py-2 bg-[#4ecde6] text-black font-semibold rounded-lg text-sm hover:bg-[#3bb8d0]"
                  >
                    Continue →
                  </button>
                </div>
              </>
            )}

            {/* Step 3 — Final confirm */}
            {step === 3 && (
              <>
                <p className="text-sm text-white/80 mb-4">
                  Are you sure you want to refund <span className="font-bold text-emerald-400">£{amount.toFixed(2)}</span>?
                </p>
                <ul className="text-xs text-white/60 space-y-1.5 mb-6 list-disc list-inside">
                  <li>The full amount will be returned to the parent&apos;s card</li>
                  <li>Stripe will reverse the academy&apos;s payout</li>
                  <li>The platform fee will be reversed</li>
                  <li>This frees the seat on the camp roster</li>
                  <li>This action cannot be undone from the app</li>
                </ul>

                {error && (
                  <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-300">
                    {error}
                  </div>
                )}

                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setStep(2)}
                    disabled={busy}
                    className="px-4 py-2 text-sm text-white/70 hover:text-white disabled:opacity-30"
                  >
                    ← Back
                  </button>
                  <button
                    onClick={submit}
                    disabled={busy}
                    className="px-5 py-2 bg-red-500 text-white font-semibold rounded-lg text-sm hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {busy ? 'Refunding…' : 'Confirm Refund'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
