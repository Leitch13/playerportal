'use client'

import { useState } from 'react'
import Link from 'next/link'

type State = 'ready' | 'confirming' | 'confirmed' | 'already' | 'expired' | 'date_passed' | 'full' | 'not_found' | 'error'

const MESSAGES: Record<Exclude<State, 'ready' | 'confirming'>, { title: string; body: string; again?: boolean }> = {
  confirmed: { title: 'Trial confirmed', body: 'You’re booked in. We’ve emailed you the details and the academy has been told.' },
  already: { title: 'Already confirmed', body: 'This trial is already booked. Check your email for the details.' },
  expired: { title: 'This link has run out', body: 'Links last 7 days. Please book the trial again. It only takes a minute.', again: true },
  date_passed: { title: 'That date has gone by', body: 'Please pick another date for the trial.', again: true },
  full: { title: 'That day is now full', body: 'Someone took the last place. Please pick another date, or join the class waiting list.', again: true },
  not_found: { title: 'Link not recognised', body: 'This link doesn’t match a booking. Please book the trial again.', again: true },
  error: { title: 'Something went wrong', body: 'We couldn’t confirm just now. Please try again in a moment.' },
}

function textOn(hex: string): string {
  const h = hex.replace('#', '')
  if (!/^[0-9a-f]{6}$/i.test(h)) return '#0a0a0a'
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#0a0a0a' : '#ffffff'
}

export default function ConfirmTrialButton({ token, color, initial, bookUrl, childName, academy }: {
  token: string; color: string; initial: State; bookUrl: string; childName: string; academy: string
}) {
  const [state, setState] = useState<State>(initial)

  async function confirm() {
    if (state === 'confirming') return
    setState('confirming')
    try {
      const res = await fetch('/api/trials/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
      const j = await res.json().catch(() => ({}))
      const next = (j as { state?: State }).state
      setState(next && next in MESSAGES ? next : 'error')
    } catch {
      setState('error')
    }
  }

  if (state === 'ready' || state === 'confirming' || state === 'error') {
    return (
      <div data-testid="trial-confirm">
        {state === 'error' && <p className="text-red-300 text-sm mb-3">{MESSAGES.error.body}</p>}
        <button
          type="button"
          onClick={confirm}
          disabled={state === 'confirming'}
          className="w-full rounded-xl py-3.5 font-bold text-base disabled:opacity-60"
          style={{ backgroundColor: color, color: textOn(color) }}
        >
          {state === 'confirming' ? 'Confirming…' : `Confirm ${childName ? childName + '’s' : 'my'} trial`}
        </button>
        <p className="text-white/40 text-xs mt-3 text-center">One tap and {academy} will hold the place.</p>
      </div>
    )
  }

  const m = MESSAGES[state]
  return (
    <div data-testid={`trial-confirm-${state}`}>
      <h2 className="text-lg font-bold mb-1">{state === 'confirmed' ? '✓ ' : ''}{m.title}</h2>
      <p className="text-white/60 text-sm">{m.body}</p>
      {m.again && (
        <Link href={bookUrl} className="inline-block mt-4 rounded-xl px-5 py-2.5 font-semibold text-sm" style={{ backgroundColor: color, color: textOn(color) }}>
          Book a trial
        </Link>
      )}
    </div>
  )
}
