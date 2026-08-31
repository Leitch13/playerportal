'use client'

import { useState } from 'react'
import { postJson } from '@/lib/post-json'

export default function PayClient({
  paymentId,
  description,
  amount,
  dueDate,
  settled,
  justPaid,
  cancelled,
  parentName,
  childName,
  academyName,
  primaryColor,
  logoUrl,
  contactEmail,
}: {
  paymentId: string
  description: string
  amount: number
  dueDate: string | null
  settled: boolean
  justPaid: boolean
  cancelled: boolean
  parentName: string | null
  childName: string | null
  academyName: string
  primaryColor: string
  logoUrl: string | null
  contactEmail: string | null
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n)

  async function handlePay() {
    setLoading(true)
    setError('')
    const res = await postJson(`/api/payments/${paymentId}/checkout`)
    const url = res.data.url
    if (!res.ok || typeof url !== 'string' || !url) {
      setError((typeof res.data.error === 'string' && res.data.error) || res.error || 'Could not start the payment. Please try again.')
      setLoading(false)
      return
    }
    window.location.href = url
  }

  // Stripe redirects back here on success; the webhook does the actual
  // reconciliation, so the row may still read unpaid for a moment.
  const showSuccess = justPaid || settled

  return (
    <div className="min-h-screen bg-[#0a0a0a] px-4 py-10 text-white">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 text-center">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={academyName}
              className="mx-auto mb-3 h-14 w-14 rounded-full object-cover"
            />
          ) : (
            <div
              className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full text-lg font-black text-black"
              style={{ background: primaryColor }}
            >
              {academyName.charAt(0)}
            </div>
          )}
          <h1 className="text-lg font-bold">{academyName}</h1>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#12121a] p-6">
          {showSuccess ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
                <svg
                  className="h-6 w-6 text-emerald-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="mb-1 text-lg font-bold">
                {justPaid && !settled ? 'Payment received' : 'This is already paid'}
              </h2>
              <p className="text-sm text-white/60">
                {justPaid && !settled
                  ? 'Thanks — your payment went through. A receipt is on its way to your inbox.'
                  : 'Nothing further is owed on this request.'}
              </p>
            </div>
          ) : (
            <>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-white/40">
                Payment request
              </p>
              {parentName && <p className="mb-5 text-sm text-white/60">For {parentName}</p>}

              <div className="mb-6 rounded-xl border border-white/10 bg-black/30 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white">{description}</p>
                    {childName && <p className="mt-1 text-xs text-white/50">{childName}</p>}
                    {dueDate && (
                      <p className="mt-1 text-xs text-white/50">
                        Due{' '}
                        {new Date(`${dueDate}T00:00:00`).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    )}
                  </div>
                  <p className="shrink-0 text-2xl font-black tabular-nums">{fmt(amount)}</p>
                </div>
              </div>

              {cancelled && (
                <p className="mb-4 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-xs text-orange-300">
                  Payment was cancelled — nothing has been charged. You can try again below.
                </p>
              )}
              {error && (
                <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                  {error}
                </p>
              )}

              <button
                onClick={handlePay}
                disabled={loading}
                className="w-full rounded-xl px-6 py-3.5 text-sm font-bold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ background: primaryColor }}
              >
                {loading ? 'Opening secure checkout…' : `Pay ${fmt(amount)}`}
              </button>

              <p className="mt-4 text-center text-[11px] text-white/40">
                🔒 Secure payment powered by Stripe. No account needed.
              </p>
            </>
          )}
        </div>

        {contactEmail && (
          <p className="mt-5 text-center text-xs text-white/40">
            Questions? Contact{' '}
            <a href={`mailto:${contactEmail}`} className="underline hover:text-white/60">
              {contactEmail}
            </a>
          </p>
        )}
      </div>
    </div>
  )
}
