'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function BookClassButton({
  playerId,
  groupId,
  playerName,
  orgId,
  className,
  isFull,
  spotsLeft,
}: {
  playerId: string
  groupId: string
  playerName: string
  orgId: string
  className?: string
  isFull?: boolean
  spotsLeft?: number
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<'booked' | 'waitlisted' | 'error' | 'needs_sub' | 'needs_upgrade' | null>(null)
  const [errorMsg, setErrorMsg] = useState<string>('')
  const [subscribeUrl, setSubscribeUrl] = useState<string>('')
  // One-tap upgrade data (when they've hit their session cap but a higher plan exists)
  const [upgradePlan, setUpgradePlan] = useState<{ id: string; name: string; amount: number } | null>(null)
  const [currentPlan, setCurrentPlan] = useState<{ name?: string; amount?: number } | null>(null)
  const [upgrading, setUpgrading] = useState(false)

  async function handleBook() {
    setLoading(true)
    setErrorMsg('')

    if (isFull) {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const { count } = await supabase
        .from('waitlist')
        .select('id', { count: 'exact', head: true })
        .eq('training_group_id', groupId)
        .eq('status', 'waiting')
      const { error } = await supabase.from('waitlist').insert({
        player_id: playerId,
        training_group_id: groupId,
        parent_id: user?.id,
        organisation_id: orgId,
        position: (count || 0) + 1,
        status: 'waiting',
      })
      if (error) {
        if (error.code === '23505') {
          alert(`${playerName} is already on the waitlist`)
        } else {
          setResult('error')
        }
      } else {
        setResult('waitlisted')
        router.refresh()
      }
      setLoading(false)
      return
    }

    // Subscription-gated booking via API route
    try {
      const res = await fetch('/api/enrolments/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, groupId }),
      })
      const data = await res.json()

      if (res.ok) {
        setResult('booked')
        router.refresh()
      } else if (res.status === 402 && data.needsSubscription) {
        setResult('needs_sub')
        setErrorMsg(data.error || 'You need an active subscription before booking.')
        setSubscribeUrl(data.bookingUrl || '/dashboard/payments')
      } else if (res.status === 403 && data.needsUpgrade) {
        setResult('needs_upgrade')
        setErrorMsg(data.error || `${playerName} has reached the session limit on your current plan.`)
        setSubscribeUrl(data.upgradeUrl || '/dashboard/payments')
        setUpgradePlan(data.upgradePlan || null)
        setCurrentPlan(data.currentPlan || null)
      } else if (res.status === 409) {
        alert(data.error || `${playerName} is already enrolled in this class`)
      } else {
        setResult('error')
        setErrorMsg(data.error || 'Failed to book — please try again')
      }
    } catch {
      setResult('error')
      setErrorMsg('Network error — please try again')
    }
    setLoading(false)
  }

  async function handleUpgrade() {
    if (!upgradePlan) return
    setUpgrading(true)
    setErrorMsg('')
    try {
      const res = await fetch('/api/stripe/change-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, groupId, newPlanId: upgradePlan.id }),
      })
      const data = await res.json()
      if (res.ok) {
        setResult('booked')
        router.refresh()
      } else {
        setErrorMsg(data.error || 'Upgrade failed — please try again')
      }
    } catch {
      setErrorMsg('Network error — please try again')
    }
    setUpgrading(false)
  }

  if (result === 'booked') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 animate-fade-in">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        Booked!
      </span>
    )
  }

  if (result === 'waitlisted') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-amber-500/15 text-amber-300 border border-amber-500/40 animate-fade-in">
        ⏳ Waitlisted
      </span>
    )
  }

  // Needs-subscription state — links to academy booking page where they can pick a plan
  if (result === 'needs_sub') {
    return (
      <a
        href={subscribeUrl}
        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-amber-500/15 text-amber-200 border border-amber-500/40 hover:bg-amber-500/25 transition-colors"
        title={errorMsg}
      >
        💳 Subscribe to book →
      </a>
    )
  }

  // Needs-upgrade state — they have a plan but hit the session cap.
  // If a higher plan exists, offer a one-tap in-place upgrade (no 2nd sub).
  // Otherwise fall back to the class-page link.
  if (result === 'needs_upgrade') {
    if (upgradePlan) {
      return (
        <div className="inline-flex flex-col gap-2 max-w-[240px] p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 animate-fade-in">
          <p className="text-[11px] text-white/70 leading-snug">
            Add a session for <strong className="text-white">{playerName}</strong>?
            {currentPlan?.amount != null && (
              <> Your plan moves to <strong className="text-white">{upgradePlan.name}</strong> (£{upgradePlan.amount.toFixed(0)}/mo).</>
            )}{' '}
            You&apos;ll pay the difference for the rest of this month.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={handleUpgrade}
              disabled={upgrading}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-extrabold rounded-lg bg-purple-400 text-[#0a0a0a] hover:bg-purple-300 transition-colors disabled:opacity-50"
            >
              {upgrading ? (
                <><span className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />Upgrading…</>
              ) : (
                <>⬆️ Upgrade &amp; Book</>
              )}
            </button>
            <button
              onClick={() => { setResult(null); setUpgradePlan(null) }}
              disabled={upgrading}
              className="text-[11px] text-white/40 hover:text-white/70 transition-colors"
            >
              Cancel
            </button>
          </div>
          {errorMsg && <p className="text-[10px] text-rose-300">{errorMsg}</p>}
        </div>
      )
    }
    return (
      <a
        href={subscribeUrl}
        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-purple-500/15 text-purple-200 border border-purple-500/40 hover:bg-purple-500/25 transition-colors"
        title={errorMsg}
      >
        ⬆️ Upgrade plan to book more
      </a>
    )
  }

  if (result === 'error') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-rose-500/15 text-rose-300 border border-rose-500/40" title={errorMsg}>
        Failed — try again
      </span>
    )
  }

  // Primary "Book [Name]" button — uses the white + brand-glow pattern that's now
  // consistent across booking pages so parents recognise it as the primary action.
  return (
    <button
      onClick={handleBook}
      disabled={loading}
      className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all hover:scale-[1.03] active:scale-[0.97] disabled:opacity-50 disabled:hover:scale-100 ${
        isFull
          ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 hover:bg-amber-500/25'
          : ''
      }`}
      style={
        isFull
          ? undefined
          : {
              background: 'linear-gradient(135deg, #ffffff 0%, #e8f9fc 100%)',
              color: '#0a0a0a',
              boxShadow: '0 6px 24px rgba(78, 205, 230, 0.4), 0 0 0 2px rgba(78, 205, 230, 0.6), inset 0 -2px 0 rgba(0,0,0,0.06)',
            }
      }
    >
      {loading ? (
        <>
          <span className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />
          {isFull ? 'Joining...' : 'Booking...'}
        </>
      ) : isFull ? (
        <>⏳ Waitlist {playerName}</>
      ) : spotsLeft !== undefined && spotsLeft <= 3 ? (
        <>Book {playerName} <span className="text-amber-600 font-bold">({spotsLeft} left!)</span></>
      ) : (
        <>Book {playerName} →</>
      )}
    </button>
  )
}
