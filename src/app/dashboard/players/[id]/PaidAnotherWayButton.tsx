'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// "Paid another way": the parent paid the academy by bank transfer or cash instead of setting up the
// card (John, 5 Nov 2026). Shows what will be marked paid, then records it (src/lib/never-confirmed.ts).
export default function PaidAnotherWayButton({ playerId, compact = false }: { playerId: string; compact?: boolean }) {
  const router = useRouter()
  const [state, setState] = useState<'idle' | 'loading' | 'ask' | 'saving' | 'done'>('idle')
  const [what, setWhat] = useState<{ amount: number; label: string } | null>(null)
  const [error, setError] = useState('')
  const size = compact ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-2 text-sm'

  async function open() {
    setState('loading'); setError('')
    const res = await fetch(`/api/admin/players/${playerId}/paid-another-way`).catch(() => null)
    const data = res ? await res.json().catch(() => ({})) : {}
    if (!res?.ok) { setError(data.error || 'Could not load. Please try again.'); setState('idle'); return }
    setWhat(data); setState('ask')
  }

  async function save(how: 'bank' | 'cash') {
    setState('saving'); setError('')
    const res = await fetch(`/api/admin/players/${playerId}/paid-another-way`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ how }) }).catch(() => null)
    const data = res ? await res.json().catch(() => ({})) : {}
    if (!res?.ok) { setError(data.error || 'Could not save. Please try again.'); setState('ask'); return }
    setState('done'); router.refresh()
  }

  if (state === 'done') return <span className={`inline-flex items-center rounded-lg font-semibold text-emerald-300 ${size}`}>Marked as paid</span>
  if (state === 'ask' || state === 'saving') return (
    <span className="inline-flex flex-col items-end gap-1.5 rounded-lg border border-white/15 bg-white/[0.04] p-2 text-right">
      <span className="text-xs text-white/80">Mark <b>£{what?.amount.toFixed(2)}</b> for {what?.label} as paid? Their card payments will start next month.</span>
      <span className="inline-flex gap-1.5">
        <button type="button" disabled={state === 'saving'} onClick={() => save('bank')} className="rounded-md bg-emerald-400 px-2.5 py-1 text-xs font-semibold text-[#04140c] disabled:opacity-60">Bank transfer</button>
        <button type="button" disabled={state === 'saving'} onClick={() => save('cash')} className="rounded-md bg-emerald-400 px-2.5 py-1 text-xs font-semibold text-[#04140c] disabled:opacity-60">Cash</button>
        <button type="button" disabled={state === 'saving'} onClick={() => setState('idle')} className="rounded-md border border-white/20 px-2.5 py-1 text-xs text-white/70">Cancel</button>
      </span>
      {error && <span className="max-w-[260px] text-[11px] leading-snug text-[#e0736d]">{error}</span>}
    </span>
  )
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button type="button" onClick={open} disabled={state === 'loading'} data-testid="paid-another-way"
        className={`inline-flex items-center rounded-lg border border-white/20 font-semibold text-white/85 transition-colors hover:bg-white/[0.06] disabled:opacity-60 ${size}`}>
        {state === 'loading' ? 'Loading…' : 'Paid another way'}
      </button>
      {error && <span className="max-w-[240px] text-right text-[11px] leading-snug text-[#e0736d]">{error}</span>}
    </span>
  )
}
