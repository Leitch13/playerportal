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

type Step = 'reason' | 'offer' | 'confirm' | 'retained' | 'cancelled'

export default function CancelFlow({
  subscriptionId,
  planName,
  monthlyAmount,
  retentionEnabled = true,
  retentionPercent = 25,
  retentionMonths = null,
}: {
  subscriptionId: string
  planName: string
  monthlyAmount: number
  retentionEnabled?: boolean
  retentionPercent?: number
  retentionMonths?: number | null
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
  const durationText = retentionMonths && retentionMonths > 0
    ? `for ${retentionMonths} month${retentionMonths !== 1 ? 's' : ''}`
    : 'forever'

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
        body: JSON.stringify({ subscriptionId, reason, reasonDetail }),
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
    <div className="w-full max-w-lg">
      {/* Progress dots */}
      <div className="flex justify-center gap-2 mb-8">
        {['reason', 'offer', 'confirm'].map((s, i) => (
          <div
            key={s}
            className={`w-2.5 h-2.5 rounded-full transition-all ${
              ['reason', 'offer', 'confirm'].indexOf(step) >= i
                ? 'bg-accent scale-110'
                : 'bg-border'
            }`}
          />
        ))}
      </div>

      {/* ═══ STEP 1: Reason ═══ */}
      {step === 'reason' && (
        <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] p-8 shadow-sm">
          <div className="text-center mb-6">
            <p className="text-3xl mb-3">😔</p>
            <h1 className="text-xl font-bold text-primary">We&apos;re sorry to see you go</h1>
            <p className="text-white/60 text-sm mt-2">
              Before you cancel, help us understand why so we can improve.
            </p>
          </div>

          <div className="space-y-2 mb-6">
            {REASONS.map((r) => (
              <button
                key={r.id}
                onClick={() => setReason(r.id)}
                className={`w-full flex items-center gap-3 p-3.5 rounded-xl text-left text-sm transition-all ${
                  reason === r.id
                    ? 'bg-accent/10 border-2 border-accent text-primary font-medium'
                    : 'border-2 border-[#1e1e1e] hover:border-accent/40 text-white'
                }`}
              >
                <span className="text-lg">{r.icon}</span>
                {r.label}
              </button>
            ))}
          </div>

          {reason === 'other' && (
            <textarea
              value={reasonDetail}
              onChange={(e) => setReasonDetail(e.target.value)}
              placeholder="Tell us more..."
              className="w-full p-3 rounded-xl border border-[#1e1e1e] text-sm resize-none h-20 mb-4 focus:outline-none focus:border-accent"
            />
          )}

          <div className="flex gap-3">
            <button
              onClick={() => router.push('/dashboard/payments')}
              className="flex-1 py-3 rounded-xl text-sm font-medium text-white/60 hover:text-white border border-[#1e1e1e] hover:border-primary/20 transition-all"
            >
              Never mind
            </button>
            <button
              onClick={() => reason && setStep(retentionEnabled ? 'offer' : 'confirm')}
              disabled={!reason}
              className="flex-1 py-3 rounded-xl text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-40 transition-all"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* ═══ STEP 2: 25% Off Offer ═══ */}
      {step === 'offer' && (
        <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] p-8 shadow-sm">
          <div className="text-center mb-6">
            <p className="text-4xl mb-3">🎉</p>
            <h1 className="text-xl font-bold text-primary">Wait! We have a special offer</h1>
            <p className="text-white/60 text-sm mt-2">
              How about <strong className="text-accent">{retentionPercent}% off</strong> your subscription — {durationText}?
            </p>
          </div>

          {/* Pricing comparison */}
          <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-2xl p-6 mb-6 border-2 border-accent">
            <div className="text-center">
              <p className="text-sm text-white/60 line-through mb-1">
                £{monthlyAmount.toFixed(2)}/month
              </p>
              <p className="text-4xl font-extrabold text-accent mb-1">
                £{discountPrice}/mo
              </p>
              <div className="inline-block bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full">
                Save £{savingAmount}/month — {durationText}
              </div>
            </div>
          </div>

          <div className="space-y-3 mb-6">
            <div className="flex items-center gap-2 text-sm text-white">
              <span className="text-green-500">✓</span> Keep your child&apos;s place in class
            </div>
            <div className="flex items-center gap-2 text-sm text-white">
              <span className="text-green-500">✓</span> {retentionPercent}% off applied instantly
            </div>
            <div className="flex items-center gap-2 text-sm text-white">
              <span className="text-green-500">✓</span> Discount lasts {durationText}
            </div>
            <div className="flex items-center gap-2 text-sm text-white">
              <span className="text-green-500">✓</span> Cancel any time in the future
            </div>
          </div>

          <button
            onClick={handleAcceptOffer}
            disabled={loading}
            className="w-full py-3.5 rounded-xl text-sm font-bold bg-accent text-primary hover:opacity-90 disabled:opacity-50 transition-all mb-3"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                Applying discount...
              </span>
            ) : (
              <>Stay & Save {retentionPercent}% →</>
            )}
          </button>

          <button
            onClick={() => setStep('confirm')}
            className="w-full py-3 rounded-xl text-sm font-medium text-white/60 hover:text-red-500 transition-colors"
          >
            No thanks, I still want to cancel
          </button>
        </div>
      )}

      {/* ═══ STEP 3: Final Confirmation ═══ */}
      {step === 'confirm' && (
        <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] p-8 shadow-sm">
          <div className="text-center mb-6">
            <p className="text-3xl mb-3">⚠️</p>
            <h1 className="text-xl font-bold text-primary">Are you sure?</h1>
            <p className="text-white/60 text-sm mt-2">
              Your subscription will remain active until the end of your current billing period.
            </p>
          </div>

          <div className="bg-red-50 rounded-xl p-4 mb-6 border border-red-100">
            <p className="text-sm text-red-800 font-medium mb-2">What you&apos;ll lose:</p>
            <ul className="space-y-1.5 text-sm text-red-700">
              <li className="flex items-center gap-2">
                <span>✕</span> Your child&apos;s place in class
              </li>
              <li className="flex items-center gap-2">
                <span>✕</span> Access to progress reports
              </li>
              <li className="flex items-center gap-2">
                <span>✕</span> Session attendance tracking
              </li>
              <li className="flex items-center gap-2">
                <span>✕</span> Coach feedback and reviews
              </li>
            </ul>
          </div>

          {retentionEnabled && (
            <div className="bg-accent/5 rounded-xl p-4 mb-6 border border-accent/20">
              <p className="text-sm text-primary">
                💡 <strong>Last chance:</strong> You can still get{' '}
                <button
                  onClick={() => setStep('offer')}
                  className="text-accent font-bold underline"
                >
                  {retentionPercent}% off {durationText}
                </button>{' '}
                instead of cancelling.
              </p>
            </div>
          )}

          <div className="flex gap-3">
            {retentionEnabled && (
              <button
                onClick={() => setStep('offer')}
                className="flex-1 py-3 rounded-xl text-sm font-medium bg-accent text-primary hover:opacity-90 transition-all"
              >
                Get {retentionPercent}% Off
              </button>
            )}
            <button
              onClick={handleConfirmCancel}
              disabled={loading}
              className="flex-1 py-3 rounded-xl text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-all"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Cancelling...
                </span>
              ) : (
                'Cancel Subscription'
              )}
            </button>
          </div>
        </div>
      )}

      {/* ═══ RETAINED: Accepted the offer ═══ */}
      {step === 'retained' && (
        <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] p-8 shadow-sm text-center">
          <p className="text-5xl mb-4">🎉</p>
          <h1 className="text-2xl font-bold text-primary mb-2">Welcome back!</h1>
          <p className="text-white/60 mb-6">
            Your {retentionPercent}% discount has been applied {durationText}. You now pay{' '}
            <strong className="text-accent">£{discountedAmount || discountPrice}/month</strong>
            {saving && <> (saving £{saving}/month)</>}.
          </p>
          <div className="bg-green-50 rounded-xl p-4 mb-6 border border-green-200">
            <p className="text-sm text-green-700 font-medium">
              ✓ Discount applied — no further action needed
            </p>
          </div>
          <button
            onClick={() => router.push('/dashboard/payments')}
            className="w-full py-3 rounded-xl text-sm font-medium bg-accent text-primary hover:opacity-90 transition-all"
          >
            Back to Dashboard
          </button>
        </div>
      )}

      {/* ═══ CANCELLED: Subscription ended ═══ */}
      {step === 'cancelled' && (
        <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] p-8 shadow-sm text-center">
          <p className="text-3xl mb-4">👋</p>
          <h1 className="text-xl font-bold text-primary mb-2">Subscription Cancelled</h1>
          <p className="text-white/60 mb-4">
            Your {planName} subscription has been cancelled.
          </p>
          {endDate && (
            <div className="bg-amber-50 rounded-xl p-4 mb-6 border border-amber-200">
              <p className="text-sm text-amber-800">
                📅 You still have access until <strong>{endDate}</strong>
              </p>
            </div>
          )}
          <p className="text-white/60 text-sm mb-6">
            Changed your mind? You can re-subscribe any time from the payments page.
          </p>
          <button
            onClick={() => router.push('/dashboard/payments')}
            className="w-full py-3 rounded-xl text-sm font-medium bg-primary text-white hover:bg-primary/90 transition-all"
          >
            Back to Payments
          </button>
        </div>
      )}
    </div>
  )
}
