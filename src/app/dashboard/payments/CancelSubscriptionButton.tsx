'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const CANCEL_REASONS = [
  { id: 'too_expensive', label: 'Too expensive', icon: '💰' },
  { id: 'child_lost_interest', label: 'My child lost interest', icon: '😕' },
  { id: 'schedule_conflict', label: 'Schedule doesn\'t work', icon: '📅' },
  { id: 'moving_away', label: 'Moving away', icon: '🏠' },
  { id: 'quality', label: 'Not happy with quality', icon: '⭐' },
  { id: 'other', label: 'Other reason', icon: '💬' },
]

export default function CancelSubscriptionButton({
  subscriptionId,
  planName,
  amount,
}: {
  subscriptionId: string
  planName: string
  amount: number
}) {
  const router = useRouter()
  const [step, setStep] = useState<'idle' | 'reason' | 'offer' | 'confirm' | 'cancelled' | 'retained'>('idle')
  const [actionLoading, setActionLoading] = useState(false)
  const [selectedReason, setSelectedReason] = useState('')
  const [otherText, setOtherText] = useState('')
  const [endDate, setEndDate] = useState('')
  const [savedAmount, setSavedAmount] = useState('')

  const discountedAmount = (amount * 0.75).toFixed(2)

  async function handleCancel() {
    setActionLoading(true)
    try {
      const res = await fetch('/api/stripe/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriptionId,
          reason: selectedReason,
          reasonDetail: selectedReason === 'other' ? otherText : CANCEL_REASONS.find(r => r.id === selectedReason)?.label,
        }),
      })
      const data = await res.json()
      if (data.error) {
        alert(data.error)
        setActionLoading(false)
      } else {
        setEndDate(data.endDate || '')
        setStep('cancelled')
        setActionLoading(false)
      }
    } catch {
      alert('Failed to cancel subscription')
      setActionLoading(false)
    }
  }

  async function handleApplyDiscount() {
    setActionLoading(true)
    try {
      const res = await fetch('/api/stripe/retain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionId }),
      })
      const data = await res.json()
      if (data.error) {
        alert(data.error)
        setActionLoading(false)
      } else {
        setSavedAmount(data.saving || (amount * 0.25).toFixed(2))
        setStep('retained')
        setActionLoading(false)
      }
    } catch {
      alert('Failed to apply discount')
      setActionLoading(false)
    }
  }

  if (step === 'idle') {
    return (
      <button
        onClick={() => setStep('reason')}
        className="text-xs text-text-light hover:text-danger transition-colors"
      >
        Cancel
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">

        {/* Step 1: Reason survey */}
        {step === 'reason' && (
          <div className="p-6">
            <div className="text-center mb-5">
              <div className="w-14 h-14 bg-surface rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">💬</span>
              </div>
              <h3 className="text-lg font-bold">We&apos;re sorry to hear that</h3>
              <p className="text-sm text-text-light mt-1">Could you tell us why you&apos;re thinking of leaving?</p>
            </div>

            <div className="space-y-2 mb-4">
              {CANCEL_REASONS.map((reason) => (
                <button
                  key={reason.id}
                  onClick={() => setSelectedReason(reason.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-left transition-all ${
                    selectedReason === reason.id
                      ? 'bg-accent/10 border-2 border-accent font-semibold'
                      : 'bg-surface/50 border-2 border-transparent hover:bg-surface'
                  }`}
                >
                  <span className="text-lg">{reason.icon}</span>
                  <span>{reason.label}</span>
                  {selectedReason === reason.id && (
                    <span className="ml-auto text-accent">✓</span>
                  )}
                </button>
              ))}
            </div>

            {selectedReason === 'other' && (
              <textarea
                className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 mb-4"
                rows={2}
                placeholder="Tell us more..."
                value={otherText}
                onChange={(e) => setOtherText(e.target.value)}
              />
            )}

            <div className="space-y-2">
              <button
                onClick={() => setStep('offer')}
                disabled={!selectedReason}
                className="w-full px-4 py-3 bg-primary text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-30 transition-all"
              >
                Continue
              </button>
              <button
                onClick={() => { setStep('idle'); setSelectedReason(''); setOtherText('') }}
                className="w-full px-4 py-2 text-xs text-text-light hover:text-text transition-colors"
              >
                Never mind, I&apos;ll stay
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Retention offer */}
        {step === 'offer' && (
          <div className="p-6 text-center">
            <div className="w-14 h-14 bg-warning/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🎁</span>
            </div>
            <h3 className="text-lg font-bold mb-1">Wait — we have a special offer!</h3>
            <p className="text-sm text-text-light mb-2">
              We&apos;d love to keep you. How about <span className="font-bold text-accent">25% off</span> your
              {' '}<span className="font-medium text-text">{planName}</span> subscription?
            </p>

            {selectedReason === 'too_expensive' && (
              <p className="text-xs text-accent font-medium mb-4">
                We noticed cost is a concern — this discount is perfect for you!
              </p>
            )}

            {/* Offer card */}
            <div className="bg-gradient-to-r from-accent/5 to-accent/10 border border-accent/20 rounded-xl p-5 mb-6">
              <div className="flex items-center justify-center gap-4">
                <div className="text-right">
                  <div className="text-sm text-text-light line-through">&pound;{Number(amount).toFixed(2)}</div>
                  <div className="text-[10px] text-text-light">per month</div>
                </div>
                <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </div>
                <div className="text-left">
                  <div className="text-2xl font-bold text-accent">&pound;{discountedAmount}</div>
                  <div className="text-[10px] text-accent font-semibold">per month — FOREVER</div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-accent/10">
                <p className="text-xs text-emerald-600 font-semibold">
                  You save &pound;{(amount * 0.25).toFixed(2)} every month
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={handleApplyDiscount}
                disabled={actionLoading}
                className="w-full px-4 py-3.5 bg-accent text-white rounded-xl text-sm font-bold hover:bg-accent/90 disabled:opacity-50 transition-colors shadow-lg shadow-accent/20"
              >
                {actionLoading ? 'Applying discount...' : '🎉 Stay & Get 25% Off Forever'}
              </button>
              <button
                onClick={() => setStep('confirm')}
                disabled={actionLoading}
                className="w-full px-4 py-2.5 text-text-light text-sm hover:text-danger transition-colors"
              >
                No thanks, I still want to cancel
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Final confirmation */}
        {step === 'confirm' && (
          <div className="p-6 text-center">
            <div className="w-14 h-14 bg-danger/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h3 className="text-lg font-bold mb-1">Are you sure?</h3>
            <p className="text-sm text-text-light mb-2">
              Your <span className="font-medium text-text">{planName}</span> subscription will be cancelled
              at the end of your current billing period.
            </p>
            <div className="bg-surface rounded-xl p-3 mb-5">
              <p className="text-xs text-text-light">
                ✓ You won&apos;t be charged again<br/>
                ✓ Access continues until period ends<br/>
                ✓ You can re-subscribe any time
              </p>
            </div>

            <div className="space-y-2">
              <button
                onClick={handleCancel}
                disabled={actionLoading}
                className="w-full px-4 py-3 bg-danger text-white rounded-xl text-sm font-semibold hover:bg-danger/90 disabled:opacity-50 transition-colors"
              >
                {actionLoading ? 'Cancelling...' : 'Yes, Cancel Subscription'}
              </button>
              <button
                onClick={() => setStep('offer')}
                disabled={actionLoading}
                className="w-full px-4 py-2.5 text-sm font-medium text-accent hover:text-accent/80 transition-colors"
              >
                ← Wait, show me that 25% off again
              </button>
            </div>
          </div>
        )}

        {/* Step: Cancelled confirmation */}
        {step === 'cancelled' && (
          <div className="p-6 text-center">
            <div className="w-14 h-14 bg-surface rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">👋</span>
            </div>
            <h3 className="text-lg font-bold mb-1">Subscription Cancelled</h3>
            <p className="text-sm text-text-light mb-4">
              Your <span className="font-medium text-text">{planName}</span> subscription has been cancelled.
            </p>
            {endDate && (
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 mb-5 border border-amber-200 dark:border-amber-700/30">
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  📅 You still have access until <strong>{endDate}</strong>
                </p>
              </div>
            )}
            <div className="bg-surface rounded-xl p-3 mb-5">
              <p className="text-xs text-text-light">
                ✓ No further charges will be made<br />
                ✓ You can re-subscribe any time
              </p>
            </div>
            <button
              onClick={() => { setStep('idle'); router.refresh() }}
              className="w-full px-4 py-3 bg-primary text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-colors"
            >
              Done
            </button>
          </div>
        )}

        {/* Step: Retained with discount */}
        {step === 'retained' && (
          <div className="p-6 text-center">
            <div className="w-14 h-14 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🎉</span>
            </div>
            <h3 className="text-lg font-bold mb-1">Welcome back!</h3>
            <p className="text-sm text-text-light mb-2">
              Your 25% discount has been applied.
            </p>
            <div className="bg-accent/5 border border-accent/20 rounded-xl p-4 mb-5">
              <p className="text-2xl font-bold text-accent mb-1">
                &pound;{discountedAmount}<span className="text-sm font-medium text-text-light">/mo</span>
              </p>
              <p className="text-xs text-emerald-600 font-semibold">
                Saving &pound;{savedAmount} every month — forever
              </p>
            </div>
            <button
              onClick={() => { setStep('idle'); router.refresh() }}
              className="w-full px-4 py-3 bg-accent text-primary rounded-xl text-sm font-semibold hover:opacity-90 transition-colors"
            >
              Done
            </button>
          </div>
        )}

        {/* Close button — only show during flow steps, not on result screens */}
        {!['cancelled', 'retained'].includes(step) && (
          <div className="border-t border-border px-6 py-3">
            <button
              onClick={() => { setStep('idle'); setSelectedReason(''); setOtherText('') }}
              className="w-full text-center text-xs text-text-light hover:text-text transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
