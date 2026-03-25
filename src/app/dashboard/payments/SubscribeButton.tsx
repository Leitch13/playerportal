'use client'

import { useState } from 'react'

export default function SubscribeButton({
  planId,
  planName,
  amount,
  interval,
  playerId,
  label,
}: {
  planId: string
  planName: string
  amount: number
  interval: string
  playerId?: string
  label?: string
}) {
  const [loading, setLoading] = useState(false)
  const [billingOption, setBillingOption] = useState<'monthly' | 'quarterly'>('monthly')

  const monthly = Number(amount)
  const quarterlyTotal = monthly * 3
  const quarterlyDiscounted = quarterlyTotal * 0.9
  const saving = quarterlyTotal - quarterlyDiscounted

  async function handleSubscribe() {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, playerId, billingOption }),
      })

      const data = await res.json()

      if (data.url) {
        window.location.href = data.url
      } else {
        alert(data.error || 'Something went wrong')
        setLoading(false)
      }
    } catch {
      alert('Failed to start subscription')
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      {/* Billing toggle */}
      <div className="flex rounded-lg bg-surface overflow-hidden border border-border">
        <button
          type="button"
          onClick={() => setBillingOption('monthly')}
          className={`flex-1 py-1.5 text-xs font-semibold transition-all ${
            billingOption === 'monthly'
              ? 'bg-primary text-white'
              : 'text-text-light hover:text-text'
          }`}
        >
          Monthly
        </button>
        <button
          type="button"
          onClick={() => setBillingOption('quarterly')}
          className={`flex-1 py-1.5 text-xs font-semibold transition-all relative ${
            billingOption === 'quarterly'
              ? 'bg-green-600 text-white'
              : 'text-text-light hover:text-text'
          }`}
        >
          3 Months
          <span className="ml-1 text-[9px] opacity-80">-10%</span>
        </button>
      </div>

      {/* Price display */}
      {billingOption === 'quarterly' && (
        <div className="text-center py-1">
          <span className="text-xs text-green-600 font-medium">
            £{quarterlyDiscounted.toFixed(2)} (save £{saving.toFixed(2)})
          </span>
        </div>
      )}

      {/* Subscribe button */}
      <button
        onClick={handleSubscribe}
        disabled={loading}
        className={`w-full px-4 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors flex items-center justify-center gap-2 ${
          billingOption === 'quarterly'
            ? 'bg-green-600 text-white hover:bg-green-700'
            : 'bg-primary text-white hover:bg-primary/90'
        }`}
      >
        {loading ? (
          <>
            <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Redirecting...
          </>
        ) : billingOption === 'quarterly' ? (
          <>Pay 3 Months · Save 10%</>
        ) : (
          <>{label || `Subscribe · £${monthly.toFixed(2)}/${interval === 'year' ? 'yr' : 'mo'}`}</>
        )}
      </button>
    </div>
  )
}
