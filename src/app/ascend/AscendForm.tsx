'use client'

import { useState } from 'react'

const STAGES = ['Just starting out', 'Coaching part-time', 'Coaching full-time', 'Running an academy']

export default function AscendForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [stage, setStage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/ascend/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, stage }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError((data as { error?: string }).error || 'Something went wrong — please try again.')
        return
      }
      setDone(true)
    } catch {
      setError('Something went wrong — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="rounded-3xl bg-[#1a232b] border-2 border-[#f2b441] p-8">
        <div className="w-12 h-12 rounded-full flex items-center justify-center text-[#10161c] text-xl font-black bg-[#f2b441]">✓</div>
        <h3 className="mt-4 text-2xl font-black text-white">Check your inbox.</h3>
        <p className="mt-2 text-[#b6c2ca]">
          The calculator&apos;s on its way to <span className="text-white font-semibold">{email}</span> right now.
        </p>
        <p className="mt-4 text-sm text-[#b6c2ca]">
          Run your real numbers, then <span className="text-[#f2b441] font-semibold">reply to the email with the gap it shows you</span> —
          John reads every reply and will tell you the first thing he&apos;d fix.
        </p>
        <p className="mt-5 text-xs text-[#7e8c99]">Nothing arrived in 2 minutes? Check spam — then drag it to your inbox so you don&apos;t miss the follow-ups.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-3xl bg-[#1a232b] border border-white/10 p-6 sm:p-8">
      <p className="text-[11px] uppercase tracking-[0.18em] text-[#f2b441] font-bold">Free — straight to your inbox</p>
      <h3 className="mt-2 text-xl font-black text-white">Get the Coaching Business Calculator</h3>

      <div className="mt-5 space-y-4">
        <div>
          <label htmlFor="as-name" className="block text-sm font-semibold text-white mb-1.5">First name *</label>
          <input id="as-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex"
            className="w-full rounded-xl border border-white/15 bg-[#10161c] px-4 py-3 text-base text-white placeholder-[#7e8c99] focus:outline-none focus:border-[#f2b441] focus:ring-2 focus:ring-[#f2b441]/25" />
        </div>
        <div>
          <label htmlFor="as-email" className="block text-sm font-semibold text-white mb-1.5">Email *</label>
          <input id="as-email" required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com"
            className="w-full rounded-xl border border-white/15 bg-[#10161c] px-4 py-3 text-base text-white placeholder-[#7e8c99] focus:outline-none focus:border-[#f2b441] focus:ring-2 focus:ring-[#f2b441]/25" />
        </div>
        <div>
          <label htmlFor="as-stage" className="block text-sm font-semibold text-white mb-1.5">Where are you at?</label>
          <select id="as-stage" value={stage} onChange={(e) => setStage(e.target.value)}
            className="w-full rounded-xl border border-white/15 bg-[#10161c] px-4 py-3 text-base text-white focus:outline-none focus:border-[#f2b441] focus:ring-2 focus:ring-[#f2b441]/25">
            <option value="">Select…</option>
            {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-[#f0526b]">{error}</p>}

      <button type="submit" disabled={submitting}
        className="mt-6 w-full rounded-full py-4 text-base font-black text-[#10161c] bg-[#f2b441] hover:opacity-90 transition-opacity disabled:opacity-60">
        {submitting ? 'Sending…' : 'Send me the calculator →'}
      </button>
      <p className="mt-3 text-center text-xs text-[#7e8c99]">Free · no spam · unsubscribe anytime</p>
    </form>
  )
}
