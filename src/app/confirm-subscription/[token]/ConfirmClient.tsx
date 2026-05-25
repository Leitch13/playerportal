'use client'

import { useState } from 'react'

interface Props {
  token: string
  childName: string
  planName: string
  planAmount: number
  sessionsPerWeek: number
  academyName: string
  primaryColor: string
  logoUrl: string | null
  quarterlyEnabled: boolean
  quarterlyDiscountPercent: number
}

export default function ConfirmClient({
  token,
  childName,
  planName,
  planAmount,
  sessionsPerWeek,
  academyName,
  primaryColor,
  logoUrl,
  quarterlyEnabled,
  quarterlyDiscountPercent,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [billing, setBilling] = useState<'monthly' | 'quarterly'>('monthly')

  const discountFraction = Math.max(0, Math.min(50, quarterlyDiscountPercent)) / 100
  const quarterlyTotal = planAmount * 3 * (1 - discountFraction)
  const quarterlySaving = planAmount * 3 * discountFraction
  const showQuarterly = quarterlyEnabled && discountFraction > 0

  async function handleConfirm() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/migration/confirm-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, billingOption: billing }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) {
        setError(data.error || 'Something went wrong. Please try again.')
        setLoading(false)
        return
      }
      window.location.href = data.url
    } catch {
      setError('Network error. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#141414] border border-[#1e1e1e] rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 text-center border-b border-[#1e1e1e]" style={{ background: `linear-gradient(135deg, ${primaryColor}15 0%, transparent 100%)` }}>
          {logoUrl ? (
            <img src={logoUrl} alt={academyName} className="h-12 mx-auto mb-3 object-contain" />
          ) : (
            <div className="text-3xl mb-2">⚽</div>
          )}
          <p className="text-xs uppercase tracking-wider font-semibold" style={{ color: primaryColor }}>
            {academyName}
          </p>
          <h1 className="text-xl font-bold text-white mt-2">Confirm {childName}&apos;s subscription</h1>
          <p className="text-sm text-white/50 mt-1">Takes 30 seconds. Secured by Stripe.</p>
        </div>

        {/* Plan summary */}
        <div className="p-6">
          <div className="bg-[#0a0a0a] rounded-xl border border-[#2a2a2a] p-5 mb-5">
            <div className="flex items-baseline justify-between mb-1">
              <p className="text-sm font-semibold text-white">{planName}</p>
              <p className="text-xs text-white/40">{sessionsPerWeek} session{sessionsPerWeek !== 1 ? 's' : ''}/week</p>
            </div>
            {billing === 'monthly' ? (
              <div className="flex items-baseline gap-1 mt-2">
                <span className="text-3xl font-extrabold text-white">£{planAmount.toFixed(2)}</span>
                <span className="text-sm text-white/50">/month</span>
              </div>
            ) : (
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-3xl font-extrabold text-emerald-400">£{quarterlyTotal.toFixed(2)}</span>
                <span className="text-sm text-white/50">every 3 months</span>
              </div>
            )}
            <p className="text-[11px] text-white/40 mt-1">
              {billing === 'monthly'
                ? 'Auto-renews monthly. Cancel anytime.'
                : `Save £${quarterlySaving.toFixed(2)} · then renews quarterly.`}
            </p>
          </div>

          {showQuarterly && (
            <div className="flex bg-[#1a1a1a] rounded-full p-1 mb-5">
              <button
                onClick={() => setBilling('monthly')}
                className={`flex-1 py-2 rounded-full text-xs font-semibold transition-colors ${
                  billing === 'monthly' ? 'text-[#0a0a0a]' : 'text-white/50'
                }`}
                style={billing === 'monthly' ? { backgroundColor: primaryColor } : undefined}
              >
                Pay Monthly
              </button>
              <button
                onClick={() => setBilling('quarterly')}
                className={`flex-1 py-2 rounded-full text-xs font-semibold transition-colors relative ${
                  billing === 'quarterly' ? 'text-[#0a0a0a]' : 'text-white/50'
                }`}
                style={billing === 'quarterly' ? { backgroundColor: primaryColor } : undefined}
              >
                Pay Quarterly
                <span className="absolute -top-1.5 -right-1.5 bg-emerald-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                  −{Math.round(discountFraction * 100)}%
                </span>
              </button>
            </div>
          )}

          <ul className="space-y-2 text-xs text-white/70 mb-5">
            <li className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Same class, same time, same coach
            </li>
            <li className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Full parent dashboard + progress tracking
            </li>
            <li className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Cancel anytime — no lock-in
            </li>
          </ul>

          {error && (
            <div className="mb-4 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300">
              {error}
            </div>
          )}

          <button
            onClick={handleConfirm}
            disabled={loading}
            className="w-full py-3.5 rounded-full font-bold text-sm transition-transform hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
            style={{ backgroundColor: primaryColor, color: '#0a0a0a' }}
          >
            {loading ? 'Redirecting to secure checkout...' : `Confirm & pay ${billing === 'monthly' ? `£${planAmount.toFixed(2)}/mo` : `£${quarterlyTotal.toFixed(2)}`}`}
          </button>

          <p className="text-[11px] text-white/30 text-center mt-4">
            🔒 Secure payment by Stripe. Your card details never touch our servers.
          </p>
        </div>
      </div>
    </div>
  )
}
