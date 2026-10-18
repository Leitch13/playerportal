'use client'

import { useState } from 'react'

export default function BackupContactForm({ bookingId, child, needBackup = true, needDob = false }: { bookingId: string; child: string; needBackup?: boolean; needDob?: boolean }) {
  const [dob, setDob] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null)
    try {
      const r = await fetch('/api/camps/backup-contact', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ bookingId, ...(needBackup ? { name, phone } : {}), ...(needDob ? { dob } : {}) }) }).then((x) => x.json())
      if (r.ok) setDone(true); else setErr(r.error || 'That did not save. Please try again.')
    } catch { setErr('No connection. Please try again.') } finally { setBusy(false) }
  }
  if (done) return <p className="mt-5 rounded-2xl border border-[#4ecde6]/30 bg-[#4ecde6]/[0.07] px-4 py-3 text-sm text-white/90" data-testid="camp-backup-saved">Thank you. {needBackup ? `${name.trim().split(/\s+/)[0]} is saved as the backup contact for ${child}.` : `${child}'s details are saved.`}</p>
  const field = 'w-full rounded-xl border border-[#243652] bg-[#0b1524] px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#4ecde6]/60'
  return (
    <form onSubmit={save} className="mt-5 space-y-3" data-testid="camp-backup-form">
      {needDob && (<label className="block text-xs text-white/60">{child}&apos;s date of birth<input className={field + ' mt-1'} type="date" value={dob} onChange={(e) => setDob(e.target.value)} required data-testid="camp-backup-dob" /></label>)}
      {needBackup && <>
      <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Their name, e.g. Gran, or Jim Smith" autoComplete="off" maxLength={80} data-testid="camp-backup-name" />
      <input className={field} type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Their phone number" autoComplete="off" maxLength={30} data-testid="camp-backup-phone" />
      </>}
      {err && <p className="text-sm text-rose-300" role="alert">{err}</p>}
      <button type="submit" disabled={busy} className="w-full rounded-xl bg-[#4ecde6] px-4 py-3 text-sm font-bold text-[#06121c] hover:opacity-90 disabled:opacity-50">{busy ? 'Saving…' : needBackup ? 'Save' : 'Save date of birth'}</button>
      {needBackup && <p className="text-xs text-white/40">The backup needs to be a different number from your own.</p>}
    </form>
  )
}
