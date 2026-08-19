'use client'

import { useState } from 'react'
import { fbTrack } from '@/lib/meta-pixel'

const PLAYER_OPTIONS = ['Under 20', '20–50', '50–150', '150+']

export default function FunnelForm() {
  const [name, setName] = useState('')
  const [academy, setAcademy] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [players, setPlayers] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/funnel/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, academy, email, phone, players }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError((data as { error?: string }).error || 'Something went wrong — please try again.')
        return
      }
      fbTrack('Lead', { content_name: 'free-booking-page' })
      setDone(true)
    } catch {
      setError('Something went wrong — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="rounded-3xl bg-white border-2 border-[#0a97b6] p-8 shadow-[0_18px_40px_-20px_rgba(10,151,182,0.45)]">
        <div className="w-12 h-12 rounded-full flex items-center justify-center text-white text-xl font-black" style={{ background: 'linear-gradient(170deg,#12a2bd,#0b7f96)' }}>✓</div>
        <h3 className="mt-4 text-2xl font-black text-[#0d1b2b]">You&apos;re in.</h3>
        <p className="mt-2 text-[#5a6b7c]">Here&apos;s what happens next:</p>
        <ol className="mt-4 space-y-3 text-sm text-[#0d1b2b]">
          <li className="flex gap-3"><span className="font-black text-[#0a97b6]">1.</span>We build your academy&apos;s branded booking page — <strong>within 24 hours</strong>.</li>
          <li className="flex gap-3"><span className="font-black text-[#0a97b6]">2.</span>It lands in your inbox. Have a poke around — no payment details, no commitment.</li>
          <li className="flex gap-3"><span className="font-black text-[#0a97b6]">3.</span>Love it? We migrate your members for free and you go live on a 14-day free trial.</li>
        </ol>
        <p className="mt-5 text-xs text-[#93a2ad]">Check your inbox — a confirmation is already on its way (look in spam if it&apos;s shy).</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-3xl bg-white border border-[#e3ebf0] p-6 sm:p-8 shadow-[0_1px_3px_rgba(13,40,54,0.05),0_18px_40px_-20px_rgba(10,151,182,0.35)]">
      <p className="text-[11px] uppercase tracking-[0.18em] text-[#0a97b6] font-bold">Free — takes 60 seconds</p>
      <h3 className="mt-2 text-xl font-black text-[#0d1b2b]">Get your academy&apos;s booking page built</h3>

      <div className="mt-5 space-y-4">
        <div>
          <label htmlFor="fl-name" className="block text-sm font-semibold text-[#0d1b2b] mb-1.5">Your name *</label>
          <input id="fl-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex Ferguson"
            className="w-full rounded-xl border border-[#d7e2e9] px-4 py-3 text-base text-[#0d1b2b] placeholder-[#a8b6c0] focus:outline-none focus:border-[#0a97b6] focus:ring-2 focus:ring-[#0a97b6]/20" />
        </div>
        <div>
          <label htmlFor="fl-academy" className="block text-sm font-semibold text-[#0d1b2b] mb-1.5">Academy name *</label>
          <input id="fl-academy" required value={academy} onChange={(e) => setAcademy(e.target.value)} placeholder="Northside Football Academy"
            className="w-full rounded-xl border border-[#d7e2e9] px-4 py-3 text-base text-[#0d1b2b] placeholder-[#a8b6c0] focus:outline-none focus:border-[#0a97b6] focus:ring-2 focus:ring-[#0a97b6]/20" />
        </div>
        <div>
          <label htmlFor="fl-email" className="block text-sm font-semibold text-[#0d1b2b] mb-1.5">Email *</label>
          <input id="fl-email" required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com"
            className="w-full rounded-xl border border-[#d7e2e9] px-4 py-3 text-base text-[#0d1b2b] placeholder-[#a8b6c0] focus:outline-none focus:border-[#0a97b6] focus:ring-2 focus:ring-[#0a97b6]/20" />
        </div>
        <div>
          <label htmlFor="fl-phone" className="block text-sm font-semibold text-[#0d1b2b] mb-1.5">Phone <span className="font-normal text-[#93a2ad]">(optional)</span></label>
          <input id="fl-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07xxx xxxxxx"
            className="w-full rounded-xl border border-[#d7e2e9] px-4 py-3 text-base text-[#0d1b2b] placeholder-[#a8b6c0] focus:outline-none focus:border-[#0a97b6] focus:ring-2 focus:ring-[#0a97b6]/20" />
        </div>
        <div>
          <label htmlFor="fl-players" className="block text-sm font-semibold text-[#0d1b2b] mb-1.5">How many players?</label>
          <select id="fl-players" value={players} onChange={(e) => setPlayers(e.target.value)}
            className="w-full rounded-xl border border-[#d7e2e9] px-4 py-3 text-base text-[#0d1b2b] bg-white focus:outline-none focus:border-[#0a97b6] focus:ring-2 focus:ring-[#0a97b6]/20">
            <option value="">Select…</option>
            {PLAYER_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <button type="submit" disabled={submitting}
        className="mt-6 w-full rounded-full py-4 text-base font-bold text-white hover:opacity-90 transition-opacity disabled:opacity-60"
        style={{ background: 'linear-gradient(170deg,#12a2bd,#0b7f96)' }}>
        {submitting ? 'Sending…' : 'Build my free booking page →'}
      </button>
      <p className="mt-3 text-center text-xs text-[#93a2ad]">No card. No commitment. Yours to keep looking at.</p>
    </form>
  )
}
