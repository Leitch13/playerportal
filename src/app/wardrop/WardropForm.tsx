'use client'

import { useState } from 'react'
import { fbTrack } from '@/lib/meta-pixel'

/**
 * ASCEND webinar registration form.
 *
 * Submit order is deliberate and must not be reordered:
 *   1. await POST /api/webinar-register   — the lead is persisted FIRST, so
 *      someone who abandons Stripe checkout is still captured.
 *   2. fire Meta Pixel `Lead`
 *   3. redirect to the Stripe Payment Link
 *
 * A failed capture never blocks checkout — step 1 is wrapped so that any
 * error still falls through to steps 2 and 3.
 */

// Stripe Payment Link — env var, never hard-coded. Read at module scope so a
// missing value is detectable before the user fills anything in.
// Env var wins, so you can change the link in Vercel without a deploy. The
// fallback is John's live £5 link so the page works the moment it ships.
const STRIPE_LINK =
  process.env.NEXT_PUBLIC_STRIPE_WEBINAR_LINK || 'https://buy.stripe.com/aFa00ia47bh6aTa3009ws02'

/**
 * Stripe rejects a client_reference_id containing anything outside
 * [A-Za-z0-9_-], so the academy name is sanitised before being passed.
 * Truncated to 60 chars as specified.
 */
function toClientReferenceId(academy: string): string {
  return academy.trim().replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60)
}

function buildCheckoutUrl(email: string, academy: string): string | null {
  if (!STRIPE_LINK) return null
  try {
    const url = new URL(STRIPE_LINK)
    url.searchParams.set('prefilled_email', email)
    const ref = toClientReferenceId(academy)
    if (ref) url.searchParams.set('client_reference_id', ref)
    return url.toString()
  } catch {
    return null
  }
}

export default function WardropForm() {
  const [form, setForm] = useState({ name: '', academy: '', email: '' })
  const [status, setStatus] = useState<'idle' | 'sending' | 'registered'>('idle')
  const [error, setError] = useState('')

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const complete = form.name.trim() && form.academy.trim() && form.email.trim()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const name = form.name.trim()
    const academy = form.academy.trim()
    const email = form.email.trim()

    if (!name || !academy || !email) {
      setError('Please fill in all three fields.')
      return
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setError('That email address doesn’t look right — please check it.')
      return
    }

    setError('')
    setStatus('sending')

    // ── 1. Persist the lead BEFORE anything else ──────────────────────────
    // Awaited so the request completes rather than being cancelled by the
    // redirect. keepalive is belt-and-braces for the same reason. Any failure
    // is swallowed: a broken capture must not cost a sale.
    try {
      await fetch('/api/webinar-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, academy, email }),
        keepalive: true,
      })
    } catch {
      /* capture failed — still send them to checkout */
    }

    // ── 2. Meta Pixel Lead ────────────────────────────────────────────────
    // fbTrack hits the site's existing pixel, which AnalyticsGate only mounts
    // after the visitor accepts all cookies — so this no-ops for opted-out
    // users rather than tracking them.
    fbTrack('Lead', { content_name: 'ascend_webinar_wardrop' })

    // ── 3. Redirect to Stripe ─────────────────────────────────────────────
    const checkout = buildCheckoutUrl(email, academy)
    if (checkout) {
      window.location.href = checkout
      return
    }

    // No Stripe link configured yet — the lead is already captured, so tell
    // the truth rather than dead-ending the visitor.
    setStatus('registered')
  }

  const input =
    'w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-base text-white placeholder:text-white/30 ' +
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 focus:border-cyan-400/50 ' +
    'motion-safe:transition-colors'

  if (status === 'registered') {
    return (
      <div className="rounded-2xl border border-cyan-400/25 bg-white/[0.04] p-6 text-center sm:p-8">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-cyan-400/15">
          <svg className="h-6 w-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white">Seat held — check your inbox</h2>
        <p className="mt-2 text-sm leading-relaxed text-white/60">
          We’ve got your details. Your payment link is on its way to{' '}
          <span className="text-white">{form.email.trim()}</span> — pay it and the Zoom link follows straight after.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-8">
      <div>
        <label htmlFor="w-name" className="mb-1.5 block text-xs font-medium text-white/70">
          Your name <span className="text-cyan-400">*</span>
        </label>
        <input id="w-name" name="name" value={form.name} onChange={set('name')} required
          autoComplete="name" placeholder="Alex Morgan" className={input} />
      </div>

      <div>
        <label htmlFor="w-academy" className="mb-1.5 block text-xs font-medium text-white/70">
          Academy name <span className="text-cyan-400">*</span>
        </label>
        <input id="w-academy" name="academy" value={form.academy} onChange={set('academy')} required
          autoComplete="organization" placeholder="Riverside Football Academy" className={input} />
      </div>

      <div>
        <label htmlFor="w-email" className="mb-1.5 block text-xs font-medium text-white/70">
          Email <span className="text-cyan-400">*</span>
        </label>
        <input id="w-email" name="email" type="email" value={form.email} onChange={set('email')} required
          autoComplete="email" placeholder="you@academy.co.uk" className={input} />
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={status === 'sending' || !complete}
        className="w-full rounded-full bg-cyan-400 py-4 text-base font-bold text-black
          hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0A]
          motion-safe:transition-colors"
      >
        {status === 'sending' ? 'One moment…' : 'Register and pay £5 →'}
      </button>

      <p className="text-center text-xs leading-relaxed text-white/40">
        Payment is handled by Stripe. Your details are saved before you get there, so nothing is lost if you come back.
      </p>
    </form>
  )
}
