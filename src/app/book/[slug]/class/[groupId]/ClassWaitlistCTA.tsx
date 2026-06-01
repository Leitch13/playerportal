'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Props {
  groupId: string
  slug: string
  primaryColor: string
}

type State =
  | { kind: 'loading' }
  | { kind: 'signed-out' }
  | { kind: 'ready' }
  | { kind: 'joining' }
  | { kind: 'joined'; position: number }
  | { kind: 'error'; message: string }

export default function ClassWaitlistCTA({ groupId, slug, primaryColor }: Props) {
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (cancelled) return
      if (!user) {
        setState({ kind: 'signed-out' })
        return
      }
      // Check if this parent's child is already waiting / offered for this group
      const { data: existing } = await supabase
        .from('waitlist')
        .select('position, status')
        .eq('group_id', groupId)
        .eq('parent_id', user.id)
        .in('status', ['waiting', 'offered'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (cancelled) return
      if (existing) {
        setState({ kind: 'joined', position: existing.position })
      } else {
        setState({ kind: 'ready' })
      }
    })()
    return () => { cancelled = true }
  }, [groupId])

  async function handleJoin() {
    setState({ kind: 'joining' })
    try {
      const res = await fetch('/api/waitlist/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setState({ kind: 'error', message: data.error || 'Could not join waitlist' })
        return
      }
      setState({ kind: 'joined', position: data.position })
    } catch {
      setState({ kind: 'error', message: 'Network error — please try again' })
    }
  }

  // Shared button style — neutral / amber for waitlist (not the "buy" colour)
  const baseClass = "block w-full text-center py-4 sm:py-5 rounded-2xl font-extrabold text-base sm:text-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
  const fullStyle = { backgroundColor: '#f59e0b', color: '#0a0a0a', boxShadow: '0 10px 40px rgba(245,158,11,0.45), 0 0 0 3px rgba(245,158,11,0.2)' }

  if (state.kind === 'loading') {
    return (
      <div className={baseClass} style={{ backgroundColor: '#1e293b', color: '#94a3b8' }}>
        Checking your account…
      </div>
    )
  }

  if (state.kind === 'signed-out') {
    return (
      <>
        <Link href={`/auth/signup?org=${slug}&class=${groupId}&intent=waitlist`} className={baseClass} style={fullStyle}>
          Join Waitlist →
        </Link>
        <p className="text-center text-xs text-white/40 mt-2">
          Quick sign-up, then we'll add your child to the queue. You're not charged.
        </p>
      </>
    )
  }

  if (state.kind === 'joined') {
    return (
      <div className={baseClass} style={{ backgroundColor: 'rgba(16,185,129,0.15)', color: '#10b981', border: '2px solid rgba(16,185,129,0.4)' }}>
        ✓ On the waitlist · #{state.position}
        <span className="block text-[11px] sm:text-xs font-medium text-emerald-300/80 mt-1">
          We'll email and notify you the moment a spot opens up
        </span>
      </div>
    )
  }

  if (state.kind === 'joining') {
    return (
      <div className={baseClass} style={{ ...fullStyle, opacity: 0.6 }}>
        Adding you to the waitlist…
      </div>
    )
  }

  if (state.kind === 'error') {
    return (
      <>
        <button onClick={handleJoin} className={baseClass} style={fullStyle}>
          Join Waitlist →
        </button>
        <p className="text-center text-xs text-red-400 mt-2">{state.message}</p>
      </>
    )
  }

  // ready
  return (
    <>
      <button onClick={handleJoin} className={baseClass} style={fullStyle}>
        Join Waitlist →
      </button>
      <p className="text-center text-xs text-white/40 mt-2">
        We'll email you the moment a spot opens up. Free to join.
      </p>
    </>
  )
  // primaryColor is accepted for API symmetry but the waitlist uses amber to differentiate
  void primaryColor
}
