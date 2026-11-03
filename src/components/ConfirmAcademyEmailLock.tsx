'use client'

import { useState } from 'react'

// Shown instead of the dashboard to a new academy owner who hasn't confirmed their email yet
// (src/lib/academy-email-check.ts).
export default function ConfirmAcademyEmailLock({ email, orgName }: { email: string; orgName: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState('')

  async function resend() {
    setState('sending')
    setError('')
    const res = await fetch('/api/onboard/confirm-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resend: true }) })
    const data = await res.json().catch(() => ({}))
    if (data.already) { window.location.reload(); return }
    if (!res.ok) { setError(data.error || 'Could not send. Please try again.'); setState('idle'); return }
    setState('sent')
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#080e18] px-4 text-white" data-testid="academy-email-lock">
      <div className="w-full max-w-md rounded-2xl border border-[#1d2c42] bg-[#0f1a2b] p-8 text-center">
        <h1 className="text-xl font-bold">Check your inbox</h1>
        <p className="mt-3 text-sm leading-relaxed text-[#93a2ba]">
          We&apos;ve emailed <strong className="text-white">{email}</strong> a button to confirm it&apos;s yours.
          Press it and {orgName} opens straight away: your dashboard, and your booking page for parents.
        </p>
        <button
          type="button"
          onClick={resend}
          disabled={state !== 'idle'}
          className="mt-6 w-full rounded-lg border border-[#293b58] bg-[#142236] px-4 py-2.5 text-sm font-semibold transition hover:bg-[#1a2b44] disabled:opacity-60"
        >
          {state === 'sending' ? 'Sending…' : state === 'sent' ? 'Sent. Check your inbox (and junk folder)' : 'Send it again'}
        </button>
        {error && <p className="mt-3 text-sm text-[#e0736d]">{error}</p>}
        <p className="mt-6 text-xs text-[#93a2ba]">Wrong email? Contact support@theplayerportal.net and we&apos;ll fix it.</p>
      </div>
    </main>
  )
}
