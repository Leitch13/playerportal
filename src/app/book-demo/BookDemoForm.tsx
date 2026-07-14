'use client'

import { useState } from 'react'

/**
 * Marketing-site "Book a demo / Talk to us" form. Posts to
 * /api/demo-request (email-only capture). Purely a lead-capture surface —
 * no auth, no account, no payment.
 */
export default function BookDemoForm() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [form, setForm] = useState({ name: '', academy: '', email: '', phone: '', currentTool: '', message: '' })

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim()) return
    setStatus('sending')
    try {
      const res = await fetch('/api/demo-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      setStatus(res.ok ? 'sent' : 'error')
    } catch {
      setStatus('error')
    }
  }

  const input = 'w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#4ecde6]/40 focus:border-[#4ecde6]/40 transition-colors'

  if (status === 'sent') {
    return (
      <div className="bg-white/[0.04] border border-[#4ecde6]/25 rounded-2xl p-8 text-center">
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[#4ecde6]/15 flex items-center justify-center">
          <svg className="w-6 h-6 text-[#4ecde6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
        </div>
        <h2 className="text-xl font-bold text-white">Got it — we&rsquo;ll be in touch.</h2>
        <p className="text-sm text-white/60 mt-2">We usually reply within a day. Keen to show you around.</p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="bg-white/[0.04] border border-white/10 rounded-2xl p-6 sm:p-8 space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-white/70 mb-1.5">Your name <span className="text-[#4ecde6]">*</span></label>
          <input value={form.name} onChange={set('name')} required placeholder="Alex Morgan" className={input} />
        </div>
        <div>
          <label className="block text-xs font-medium text-white/70 mb-1.5">Academy / club name</label>
          <input value={form.academy} onChange={set('academy')} placeholder="Riverside Football Academy" className={input} />
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-white/70 mb-1.5">Email <span className="text-[#4ecde6]">*</span></label>
          <input type="email" value={form.email} onChange={set('email')} required placeholder="you@academy.com" className={input} />
        </div>
        <div>
          <label className="block text-xs font-medium text-white/70 mb-1.5">Phone <span className="text-white/30">(optional)</span></label>
          <input value={form.phone} onChange={set('phone')} placeholder="+44 7700 900000" className={input} />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-white/70 mb-1.5">What are you using now? <span className="text-white/30">(optional)</span></label>
        <input value={form.currentTool} onChange={set('currentTool')} placeholder="ClassForKids, spreadsheets, Pitchero…" className={input} />
      </div>
      <div>
        <label className="block text-xs font-medium text-white/70 mb-1.5">Anything you&rsquo;d like to see? <span className="text-white/30">(optional)</span></label>
        <textarea value={form.message} onChange={set('message')} rows={3} placeholder="A quick note about your academy or club…" className={input} />
      </div>

      {status === 'error' && (
        <p className="text-sm text-red-400">Something went wrong. Please email us directly at <a href="mailto:john.leitch@playitloveit.com" className="underline">john.leitch@playitloveit.com</a>.</p>
      )}

      <button
        type="submit"
        disabled={status === 'sending' || !form.name.trim() || !form.email.trim()}
        className="w-full py-3.5 rounded-full text-sm font-bold text-black bg-[#4ecde6] hover:bg-[#6eddf2] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {status === 'sending' ? 'Sending…' : 'Request a demo'}
      </button>
      <p className="text-center text-xs text-white/40">No commitment. We&rsquo;ll show you around and answer anything.</p>
    </form>
  )
}
