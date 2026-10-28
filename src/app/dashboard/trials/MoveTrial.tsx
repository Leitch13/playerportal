'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { nextClassDates } from '@/lib/trial-move'

export interface MoveClass { id: string; name: string; dayOfWeek: string | null; timeSlot: string | null }

/** Trials page → Move: pick a class and one of its next dates (src/app/api/admin/trials/[id]/move). */
export default function MoveTrial({ trialId, childName, groupId, classes, card = false }: { trialId: string; childName: string; groupId: string | null; classes: MoveClass[]; card?: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [cls, setCls] = useState(groupId || classes[0]?.id || '')
  const [date, setDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  if (!classes.length) return null

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' })
  const c = classes.find((x) => x.id === cls)
  const dates = nextClassDates(c?.dayOfWeek, today, 8)
  const label = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })

  async function move() {
    setBusy(true); setMsg(null)
    const res = await fetch(`/api/admin/trials/${trialId}/move`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ groupId: cls, date }) })
    const d = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok || !d.ok) { setMsg({ ok: false, text: d.error || 'Couldn’t move it' }); return }
    setMsg({ ok: true, text: d.unchanged ? 'Already booked then.' : `Moved to ${label(date)}.${d.emailed ? ' The family has been emailed.' : ''}` })
    setOpen(false); router.refresh()
  }

  const btn = card ? 'px-3 py-2 rounded-lg text-sm font-semibold border border-white/15 text-white' : 'px-2.5 py-1 rounded-md text-xs font-semibold bg-white/5 text-white/80 hover:bg-white/10'
  return (
    <span className="inline-flex flex-col gap-1" data-testid="trial-move">
      {!open ? (
        <button onClick={() => setOpen(true)} className={btn}>{card ? 'Move to another day' : 'Move'}</button>
      ) : (
        <span className="flex flex-wrap items-center gap-1.5 rounded-lg border border-[#1d2c42] bg-[#0f1a2b] p-2">
          <span className="text-xs text-white/60">Move {childName.split(' ')[0]} to</span>
          {classes.length > 1 && (
            <select value={cls} onChange={(e) => { setCls(e.target.value); setDate('') }} className="rounded-md bg-[#0a1120] border border-[#1d2c42] px-2 py-1 text-xs text-white">
              {classes.map((x) => <option key={x.id} value={x.id}>{x.name.trim()}{x.dayOfWeek ? ` · ${x.dayOfWeek.trim().slice(0, 3)}` : ''}{x.timeSlot ? ` ${x.timeSlot}` : ''}</option>)}
            </select>
          )}
          <select value={date} onChange={(e) => setDate(e.target.value)} className="rounded-md bg-[#0a1120] border border-[#1d2c42] px-2 py-1 text-xs text-white" data-testid="trial-move-date">
            <option value="">Pick a date</option>
            {dates.map((d) => <option key={d} value={d}>{label(d)}</option>)}
          </select>
          <button onClick={move} disabled={busy || !date} className="rounded-md bg-[#4ecde6] px-2.5 py-1 text-xs font-bold text-[#06222b] disabled:opacity-50">{busy ? 'Moving…' : 'Move'}</button>
          <button onClick={() => setOpen(false)} className="text-xs text-white/50 underline">Cancel</button>
        </span>
      )}
      {msg && <span className={`text-xs ${msg.ok ? 'text-emerald-300' : 'text-red-400'}`}>{msg.text}</span>}
    </span>
  )
}
