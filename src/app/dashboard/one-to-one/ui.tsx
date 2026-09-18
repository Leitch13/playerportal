'use client'

// 1-2-1 Slots · small client pieces shared by the academy pages.
// Every mutation goes through /api/one-to-one/admin with an `action`,
// or /api/one-to-one/coach from a coach's own page.
// No money anywhere in here.

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

export async function act(body: Record<string, unknown>, endpoint = '/api/one-to-one/admin'): Promise<{ ok: boolean; error?: string; [k: string]: unknown }> {
  const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { ok: false, error: json.error || `Failed (${res.status})` }
  return { ok: true, ...json }
}

export function ActionButton({
  body, children, confirm: confirmText, tone = 'default', className = '', onDone, endpoint,
}: {
  body: Record<string, unknown>; children: React.ReactNode; confirm?: string
  tone?: 'default' | 'primary' | 'quiet' | 'danger'; className?: string; onDone?: () => void
  /** Defaults to the academy route. A coach's page posts to its own. */
  endpoint?: string
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [err, setErr] = useState<string | null>(null)
  const tones = {
    default: 'border-white/[0.12] bg-white/[0.06] text-white hover:bg-white/[0.1]',
    primary: 'border-[#4ecde6] bg-[#4ecde6] text-[#04141a] hover:brightness-110',
    quiet: 'border-transparent bg-transparent text-white/60 hover:text-white',
    danger: 'border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/15',
  }
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (confirmText && !window.confirm(confirmText)) return
          setErr(null)
          start(async () => {
            const r = await act(body, endpoint)
            if (!r.ok) { setErr(r.error || 'Failed'); return }
            onDone?.()
            router.refresh()
          })
        }}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${tones[tone]} ${className}`}
      >
        {pending ? 'Working…' : children}
      </button>
      {err && <span className="text-[11px] text-red-300">{err}</span>}
    </span>
  )
}

/** A small form that posts its fields as one action. Children are the inputs; names become body keys. */
export function ActionForm({
  action, children, submitLabel = 'Save', extra = {}, onDone, className = '', endpoint,
}: {
  action: string; children: React.ReactNode; submitLabel?: string
  extra?: Record<string, unknown>; onDone?: () => void; className?: string; endpoint?: string
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [err, setErr] = useState<string | null>(null)
  return (
    <form
      className={`space-y-3 ${className}`}
      onSubmit={(e) => {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        const body: Record<string, unknown> = { action, ...extra }
        for (const [k, v] of fd.entries()) body[k] = typeof v === 'string' ? v : ''
        // checkboxes: present = true, absent = false, for names ending in "Allowed"/"Active"
        for (const el of Array.from(e.currentTarget.elements)) {
          const input = el as HTMLInputElement
          if (input.type === 'checkbox' && input.name) body[input.name] = input.checked
        }
        const form = e.currentTarget
        setErr(null)
        start(async () => {
          const r = await act(body, endpoint)
          if (!r.ok) { setErr(r.error || 'Failed'); return }
          form.reset()
          onDone?.()
          router.refresh()
        })
      }}
    >
      {children}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-lg border border-[#4ecde6] bg-[#4ecde6] px-3 py-1.5 text-xs font-semibold text-[#04141a] disabled:opacity-50">
          {pending ? 'Saving…' : submitLabel}
        </button>
        {err && <span className="text-xs text-red-300">{err}</span>}
      </div>
    </form>
  )
}

export const inputCls = 'w-full rounded-lg border border-white/[0.12] bg-[#080e18] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#4ecde6] focus:outline-none'
export const labelCls = 'block text-[11px] font-semibold uppercase tracking-wide text-white/45 mb-1'

export function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={`block ${className}`}><span className={labelCls}>{label}</span>{children}</label>
}

/** Weekly-hours editor for a venue: one row per day, "16:00–19:30" text, blank = closed. */
export function WeeklyHoursFields({ initial }: { initial?: Record<string, [string, string][]> }) {
  const days: [string, string][] = [['mon', 'Mon'], ['tue', 'Tue'], ['wed', 'Wed'], ['thu', 'Thu'], ['fri', 'Fri'], ['sat', 'Sat'], ['sun', 'Sun']]
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {days.map(([k, label]) => {
        const v = initial?.[k]?.[0]
        return (
          <label key={k} className="block">
            <span className={labelCls}>{label}</span>
            <input name={`wh_${k}`} defaultValue={v ? `${v[0]}-${v[1]}` : ''} placeholder="16:00-19:30" className={inputCls} />
          </label>
        )
      })}
    </div>
  )
}

/** Turns wh_mon="16:00-19:30" fields into the weeklyHours object the API expects. */
export function VenueForm({ venue }: { venue?: { id: string; name: string; address: string | null; weekly_hours: Record<string, [string, string][]>; is_active: boolean } }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [err, setErr] = useState<string | null>(null)
  const [open, setOpen] = useState(!venue)
  if (venue && !open) return <button type="button" onClick={() => setOpen(true)} className="text-xs font-medium text-[#4ecde6] hover:underline">Edit hours</button>
  return (
    <form
      className="space-y-3 rounded-xl border border-white/[0.08] bg-[#0f1a2b] p-4"
      onSubmit={(e) => {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        const weeklyHours: Record<string, [string, string][]> = {}
        for (const k of ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']) {
          const raw = String(fd.get(`wh_${k}`) || '').trim()
          if (!raw) continue
          const m = /^(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})$/.exec(raw)
          if (!m) { setErr(`${k}: write it like 16:00-19:30`); return }
          weeklyHours[k] = [[m[1], m[2]]]
        }
        setErr(null)
        start(async () => {
          const r = await act({ action: 'venue.save', id: venue?.id, name: fd.get('name'), address: fd.get('address'), weeklyHours, isActive: (fd.get('isActive') ?? 'on') === 'on' })
          if (!r.ok) { setErr(r.error || 'Failed'); return }
          setOpen(!venue)
          router.refresh()
        })
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Venue"><input name="name" defaultValue={venue?.name} required placeholder="Portobello" className={inputCls} /></Field>
        <Field label="Address"><input name="address" defaultValue={venue?.address ?? ''} placeholder="optional" className={inputCls} /></Field>
      </div>
      <div>
        <span className={labelCls}>Opening hours · blank means closed that day</span>
        <WeeklyHoursFields initial={venue?.weekly_hours} />
      </div>
      {venue && (
        <label className="flex items-center gap-2 text-xs text-white/70"><input type="checkbox" name="isActive" defaultChecked={venue.is_active} /> In use</label>
      )}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-lg border border-[#4ecde6] bg-[#4ecde6] px-3 py-1.5 text-xs font-semibold text-[#04141a] disabled:opacity-50">{pending ? 'Saving…' : venue ? 'Save venue' : 'Add venue'}</button>
        {venue && <button type="button" onClick={() => setOpen(false)} className="text-xs text-white/60">Cancel</button>}
        {err && <span className="text-xs text-red-300">{err}</span>}
      </div>
    </form>
  )
}

export function Disclosure({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button type="button" onClick={() => setOpen((o) => !o)} className="text-xs font-medium text-[#4ecde6] hover:underline">{open ? 'Close' : label}</button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  )
}
