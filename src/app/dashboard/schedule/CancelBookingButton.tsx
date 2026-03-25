'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const REASONS = [
  { id: 'schedule', label: 'Schedule doesn\'t work', icon: '📅' },
  { id: 'expensive', label: 'Too expensive', icon: '💰' },
  { id: 'child_stopped', label: 'Child lost interest', icon: '😕' },
  { id: 'switching', label: 'Switching class', icon: '🔄' },
  { id: 'other', label: 'Other reason', icon: '💬' },
]

type Step = 'idle' | 'reason' | 'offer' | 'confirm' | 'cancelled' | 'retained'

export default function CancelBookingButton({
  enrolmentId,
  playerId,
  className,
}: {
  enrolmentId: string
  playerId?: string
  className?: string
}) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('idle')
  const [loading, setLoading] = useState(false)
  const [reason, setReason] = useState('')

  async function handleCancel() {
    setLoading(true)
    const supabase = createClient()

    const { error } = await supabase
      .from('enrolments')
      .update({ status: 'cancelled' })
      .eq('id', enrolmentId)

    if (error) {
      console.error('Cancel enrolment error:', error)
      alert('Failed to cancel — please try again')
      setLoading(false)
    } else {
      setStep('cancelled')
      setLoading(false)
      setTimeout(() => router.refresh(), 2000)
    }
  }

  async function handleStayWithDiscount() {
    setLoading(true)
    const supabase = createClient()

    // Get current user and org
    const { data: { user } } = await supabase.auth.getUser()
    const { data: orgId } = await supabase.rpc('get_my_org')

    if (!user || !orgId) {
      alert('Something went wrong — please try again')
      setLoading(false)
      return
    }

    // Calculate expiry — 2 months from now
    const expiresAt = new Date()
    expiresAt.setMonth(expiresAt.getMonth() + 2)

    // Create the discount record
    const { error } = await supabase.from('enrolment_discounts').insert({
      enrolment_id: enrolmentId,
      player_id: playerId || null,
      profile_id: user.id,
      organisation_id: orgId,
      discount_percent: 50,
      months_remaining: 2,
      reason: reason || 'retention_offer',
      status: 'active',
      expires_at: expiresAt.toISOString(),
    })

    if (error) {
      console.error('Discount creation error:', error)
      // Still show success — the parent chose to stay
    }

    // Create a notification for the admin
    try {
      await supabase.from('notifications').insert({
        profile_id: user.id,
        organisation_id: orgId,
        type: 'discount',
        title: '50% discount applied',
        body: `Retention offer accepted — 50% off for 2 months on ${className || 'class'}`,
        link: '/dashboard/payments',
      })
    } catch {
      // silently ignore notification failures
    }

    setStep('retained')
    setLoading(false)
  }

  if (step === 'idle') {
    return (
      <button
        onClick={() => setStep('reason')}
        className="px-2 py-1 text-xs border border-red-200 text-red-600 rounded hover:bg-red-50 transition-colors"
      >
        Cancel
      </button>
    )
  }

  if (step === 'cancelled') {
    return <span className="px-2 py-1 text-xs text-green-600 font-medium">✓ Cancelled</span>
  }

  if (step === 'retained') {
    return (
      <span className="px-2 py-1 text-xs text-accent font-medium animate-fade-in">
        🎉 50% off applied for 2 months!
      </span>
    )
  }

  return (
    <>
      <button
        className="px-2 py-1 text-xs border border-red-200 text-red-600 rounded opacity-50"
        disabled
      >
        Cancel
      </button>

      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white dark:bg-primary-light rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden animate-scale-in">

          {/* ── Step 1: Why? ── */}
          {step === 'reason' && (
            <div className="p-6">
              <div className="text-center mb-5">
                <span className="text-3xl">😔</span>
                <h3 className="text-lg font-bold mt-2">We&apos;re sorry to see you go</h3>
                <p className="text-sm text-text-light mt-1">Why are you cancelling this class?</p>
              </div>
              <div className="space-y-2 mb-5">
                {REASONS.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setReason(r.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-left transition-all ${
                      reason === r.id
                        ? 'bg-accent/10 border-2 border-accent font-semibold'
                        : 'bg-surface dark:bg-white/5 border-2 border-transparent hover:bg-surface-dark dark:hover:bg-white/10'
                    }`}
                  >
                    <span>{r.icon}</span>
                    <span>{r.label}</span>
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setStep('idle'); setReason('') }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-text-light border border-border hover:bg-surface transition-colors"
                >
                  Never mind
                </button>
                <button
                  onClick={() => reason && setStep('offer')}
                  disabled={!reason}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-30 transition-colors dark:bg-red-900/20"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: 50% off for 2 months ── */}
          {step === 'offer' && (
            <div className="p-6 text-center">
              <span className="text-4xl">🎉</span>
              <h3 className="text-lg font-bold mt-3 mb-1">Wait — special offer!</h3>
              <p className="text-sm text-text-light mb-4">
                Stay and get <strong className="text-accent">50% off for the next 2 months</strong>
              </p>

              <div className="bg-gradient-to-br from-accent/5 to-accent/10 dark:from-accent/10 dark:to-accent/5 border-2 border-accent/20 rounded-2xl p-5 mb-5">
                <p className="text-3xl font-extrabold text-accent">50% OFF</p>
                <p className="text-sm text-accent/70 font-semibold mt-1">for 2 months — applied automatically</p>
              </div>

              <div className="space-y-2 text-left mb-5">
                <div className="flex items-center gap-2 text-sm text-text">
                  <span className="text-green-500">✓</span> Keep your child&apos;s place in {className || 'class'}
                </div>
                <div className="flex items-center gap-2 text-sm text-text">
                  <span className="text-green-500">✓</span> 50% off next 2 payments — automatic
                </div>
                <div className="flex items-center gap-2 text-sm text-text">
                  <span className="text-green-500">✓</span> Cancel any time after — no strings
                </div>
              </div>

              <button
                onClick={handleStayWithDiscount}
                disabled={loading}
                className="w-full py-3 rounded-xl text-sm font-bold bg-accent text-primary hover:opacity-90 transition-all mb-2 shadow-lg shadow-accent/20 disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                    Applying...
                  </span>
                ) : (
                  '🎉 Stay & Get 50% Off for 2 Months'
                )}
              </button>
              <button
                onClick={() => setStep('confirm')}
                disabled={loading}
                className="w-full py-2 text-sm text-text-light hover:text-red-500 transition-colors"
              >
                No thanks, cancel anyway
              </button>
            </div>
          )}

          {/* ── Step 3: Final confirm ── */}
          {step === 'confirm' && (
            <div className="p-6 text-center">
              <span className="text-3xl">⚠️</span>
              <h3 className="text-lg font-bold mt-2 mb-1">Are you sure?</h3>
              <p className="text-sm text-text-light mb-4">
                Your child will lose their place in {className || 'this class'}.
              </p>

              <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3 mb-5 text-left">
                <ul className="space-y-1.5 text-sm text-red-700 dark:text-red-400">
                  <li className="flex items-center gap-2"><span>✕</span> Place in class lost</li>
                  <li className="flex items-center gap-2"><span>✕</span> May need to rejoin waitlist</li>
                  <li className="flex items-center gap-2"><span>✕</span> Losing the 50% off deal</li>
                </ul>
              </div>

              <div className="bg-accent/5 dark:bg-accent/10 rounded-xl p-3 mb-5">
                <p className="text-sm text-text">
                  💡 Last chance:{' '}
                  <button onClick={() => setStep('offer')} className="text-accent font-bold underline">
                    50% off for 2 months
                  </button>
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setStep('offer')}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-accent text-primary hover:opacity-90 transition-all"
                >
                  Get 50% Off
                </button>
                <button
                  onClick={handleCancel}
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Cancelling...' : 'Cancel Class'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
