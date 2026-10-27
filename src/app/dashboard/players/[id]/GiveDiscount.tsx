'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/** Child page → Give a discount on one of the child's paying memberships (src/app/api/discounts/child). */
type Duration = 'once' | 'repeating_3' | 'repeating_6' | 'forever'
const DURATIONS: { v: Duration; label: string }[] = [
  { v: 'once', label: 'Next payment' }, { v: 'repeating_3', label: '3 months' }, { v: 'repeating_6', label: '6 months' }, { v: 'forever', label: 'Until I remove it' },
]

export default function GiveDiscount({ childName, memberships }: { childName: string; memberships: { id: string; name: string; amount: number }[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [subId, setSubId] = useState(memberships[0]?.id ?? '')
  const [type, setType] = useState<'percentage' | 'fixed'>('percentage')
  const [value, setValue] = useState('')
  const [duration, setDuration] = useState<Duration>('forever')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  if (!memberships.length) return null
  const m = memberships.find((x) => x.id === subId) ?? memberships[0]
  const v = Number(value)
  const after = !v ? null : Math.max(0, type === 'percentage' ? m.amount * (1 - Math.min(100, v) / 100) : m.amount - v)
  const lastsText = duration === 'once' ? 'on the next payment' : duration === 'forever' ? 'every month until you remove it' : `for the next ${duration === 'repeating_3' ? 3 : 6} payments`

  async function give() {
    setBusy(true); setMsg(null)
    const res = await fetch('/api/discounts/child', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscriptionId: subId, type, value: v, duration, reason }) })
    const d = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setMsg({ ok: false, text: d.error || 'Couldn’t give the discount' }); return }
    setMsg({ ok: true, text: `Done. ${childName} pays £${d.newAmount} ${lastsText}.${d.emailed ? ' Their parent has been emailed.' : ''}` })
    setOpen(false); setValue(''); setReason('')
    router.refresh()
  }

  const seg = (on: boolean) => `flex-1 px-3 py-2 text-xs font-semibold ${on ? 'bg-cyan-400 text-[#06222b]' : 'text-white/60'}`
  return (
    <div className="mt-4 pt-4 border-t border-white/[0.06]" data-testid="give-discount">
      {msg && <p className={`text-sm mb-3 ${msg.ok ? 'text-emerald-300' : 'text-red-400'}`}>{msg.text}</p>}
      {!open ? (
        <button onClick={() => setOpen(true)} className="rounded-lg border border-white/15 px-3 py-2 text-sm font-semibold text-white hover:bg-white/5">Give a discount</button>
      ) : (
        <div className="space-y-3">
          <p className="font-semibold text-white">Give {childName} a discount</p>
          {memberships.length > 1 && (
            <select value={subId} onChange={(e) => setSubId(e.target.value)} className="w-full rounded-lg bg-[#0a1120] border border-[#1d2c42] px-3 py-2 text-sm text-white">
              {memberships.map((x) => <option key={x.id} value={x.id}>{x.name} · £{x.amount.toFixed(2)}</option>)}
            </select>
          )}
          <div className="flex gap-2">
            <div className="flex rounded-lg border border-[#1d2c42] overflow-hidden"><button type="button" className={seg(type === 'percentage')} onClick={() => setType('percentage')}>% off</button><button type="button" className={seg(type === 'fixed')} onClick={() => setType('fixed')}>£ off</button></div>
            <input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" placeholder={type === 'percentage' ? 'e.g. 50' : 'e.g. 10'} className="flex-1 rounded-lg bg-[#0a1120] border border-[#1d2c42] px-3 py-2 text-sm text-white" />
          </div>
          <div className="flex rounded-lg border border-[#1d2c42] overflow-hidden">{DURATIONS.map((d) => <button key={d.v} type="button" className={seg(duration === d.v)} onClick={() => setDuration(d.v)}>{d.label}</button>)}</div>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (only the academy sees this)" className="w-full rounded-lg bg-[#0a1120] border border-[#1d2c42] px-3 py-2 text-sm text-white" />
          {after != null && <p className="text-sm rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 px-3 py-2">{childName} pays <b>£{after.toFixed(2)}</b> instead of £{m.amount.toFixed(2)} {lastsText}. Their parent is emailed.</p>}
          <div className="flex gap-2">
            <button onClick={give} disabled={busy || !v} className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-bold text-[#06222b] disabled:opacity-50">{busy ? 'Saving…' : 'Give discount'}</button>
            <button onClick={() => setOpen(false)} className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
