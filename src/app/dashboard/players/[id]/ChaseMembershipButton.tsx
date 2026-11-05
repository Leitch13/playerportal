'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ChaseKind } from '@/lib/membership-pay-link'
import WhatsAppItButton from '@/components/WhatsAppItButton'
import PaidAnotherWayButton from './PaidAnotherWayButton'

// The academy chasing a child's class membership (John, 2 Nov 2026: "build the buttons").
//   • invite → "Resend invite": the parent's own confirm link again (request-payment, resend).
//   • card   → "Send payment link": a link to pay the bill that failed (src/lib/membership-pay-link.ts).
//   • owed   → coming on an invite never confirmed: a bill for the months owed + the invite (src/lib/never-confirmed.ts).
// Shown on the child page, the class register and Enrolments → In a class, not paying.
export default function ChaseMembershipButton({ playerId, kind, compact = false, amount }: { playerId: string; kind: Exclude<ChaseKind, null> | 'owed'; compact?: boolean; amount?: number }) {
  const router = useRouter()
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState('')
  const label = kind === 'invite' ? 'Resend invite' : kind === 'owed' ? `Send £${(amount ?? 0).toFixed(2)} bill + invite` : 'Send payment link'
  const done = kind === 'invite' ? 'Invite sent again' : kind === 'owed' ? 'Bill and invite sent' : 'Payment link sent'
  const path = kind === 'invite' ? 'request-payment' : kind === 'owed' ? 'back-months' : 'membership-pay-link'

  async function send() {
    setState('sending')
    setError('')
    try {
      const res = await fetch(`/api/admin/players/${playerId}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(kind === 'invite' ? { resend: true } : {}),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Could not send. Please try again.')
        setState('idle')
        return
      }
      setState('sent')
      router.refresh()
    } catch {
      setError('Something went wrong. Please try again.')
      setState('idle')
    }
  }

  return (
    <span className="inline-flex flex-wrap items-start justify-end gap-1.5">
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={send}
        disabled={state !== 'idle'}
        data-testid={`chase-${kind}`}
        className={`inline-flex items-center rounded-lg font-semibold transition-colors disabled:opacity-60 ${compact ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-2 text-sm'} ${
          kind !== 'invite' ? 'bg-[#e0736d] text-[#1a0505] hover:brightness-105' : 'bg-[#4ecde6] text-[#04141a] hover:brightness-105'
        }`}
      >
        {state === 'sending' ? 'Sending…' : state === 'sent' ? done : label}
      </button>
      {error && <span className="max-w-[240px] text-right text-[11px] leading-snug text-[#e0736d]">{error}</span>}
    </span>
    <WhatsAppItButton kind={kind} id={playerId} compact={compact} />
    {(kind === 'owed' || kind === 'invite') && <PaidAnotherWayButton playerId={playerId} compact={compact} />}
    </span>
  )
}
