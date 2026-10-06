'use client'

import { useState } from 'react'

// Shown in place of the locked booking form when a camp is full. Leaves the
// parent's details with the academy; takes no payment and holds no place.
export default function CampWaitlistForm({ campId, primaryColor, defaultName = '', defaultEmail = '' }: {
  campId: string
  primaryColor: string
  defaultName?: string
  defaultEmail?: string
}) {
  const [parentName, setParentName] = useState(defaultName)
  const [email, setEmail] = useState(defaultEmail)
  const [phone, setPhone] = useState('')
  const [childName, setChildName] = useState('')
  const [childAge, setChildAge] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<null | 'added' | 'already'>(null)

  // Not a <form>: this sits inside the camp booking form, and a form inside a
  // form is invalid HTML (the browser drops the inner one and nothing submits).
  async function submit() {
    if (parentName.trim().length < 2) { setError('Please enter your name.'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) { setError('Please enter a valid email address.'); return }
    if (childName.trim().length < 2) { setError('Please enter your child’s name.'); return }
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/camps/waitlist', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campId, parentName, email, phone, childName, childAge }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.ok) setDone(data.already ? 'already' : 'added')
      else setError(data.error || 'Something went wrong. Please try again.')
    } catch {
      setError('We couldn’t reach the server. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  const input = 'w-full rounded-xl border border-white/[0.12] bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-white/40 focus:outline-none'
  const label = 'mb-1.5 block text-xs font-medium text-white/60'

  if (done) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4" data-testid="camp-waitlist-done">
        <p className="text-sm font-semibold text-emerald-300">{done === 'already' ? 'You’re already on the waiting list' : 'You’re on the waiting list'}</p>
        <p className="mt-1 text-sm text-white/60">The academy has {childName || 'your child'}’s details and will be in touch if a place opens. Nothing has been charged.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-white/[0.1] bg-white/[0.03] p-4" data-testid="camp-waitlist-form" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (!busy) submit() } }}>
      <p className="text-sm font-semibold text-white">This camp is full. Join the waiting list</p>
      <p className="mt-1 text-sm text-white/55">Leave your details and the academy will contact you if a place opens. No payment now.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={label} htmlFor="wl-name">Your name</label>
          <input id="wl-name" className={input} value={parentName} onChange={(e) => setParentName(e.target.value)} maxLength={80} autoComplete="name" />
        </div>
        <div>
          <label className={label} htmlFor="wl-email">Email</label>
          <input id="wl-email" type="email" className={input} value={email} onChange={(e) => setEmail(e.target.value)} maxLength={120} autoComplete="email" />
        </div>
        <div>
          <label className={label} htmlFor="wl-phone">Phone (optional)</label>
          <input id="wl-phone" type="tel" className={input} value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} autoComplete="tel" />
        </div>
        <div>
          <label className={label} htmlFor="wl-child">Child’s name</label>
          <input id="wl-child" className={input} value={childName} onChange={(e) => setChildName(e.target.value)} maxLength={80} />
        </div>
        <div>
          <label className={label} htmlFor="wl-age">Child’s age (optional)</label>
          <input id="wl-age" type="number" min={1} max={18} inputMode="numeric" className={input} value={childAge} onChange={(e) => setChildAge(e.target.value)} />
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-red-400" role="alert">{error}</p>}
      <button type="button" onClick={submit} disabled={busy} data-testid="camp-waitlist-join" className="mt-4 w-full rounded-xl px-4 py-3 text-sm font-bold disabled:opacity-60" style={{ backgroundColor: primaryColor, color: '#0a0a0a' }}>
        {busy ? 'Adding you…' : 'Join the waiting list'}
      </button>
    </div>
  )
}
