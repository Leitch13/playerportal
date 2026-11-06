'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'

// Opening the emailed link shows this button; only pressing it confirms. Email scanners
// (Outlook, Hotmail) open links on their own, so a link that confirmed on opening could be
// "confirmed" by a robot, never by the owner.
function ConfirmEmail() {
  const token = useSearchParams().get('t') || ''
  const [state, setState] = useState<'idle' | 'working' | 'done'>('idle')
  const [error, setError] = useState('')

  async function confirm() {
    setState('working')
    setError('')
    const res = await fetch('/api/onboard/confirm-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setError(data.error || 'Something went wrong. Please try again.'); setState('idle'); return }
    setState('done')
    window.location.href = '/dashboard'
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#080e18] px-4 text-white">
      <div className="w-full max-w-md rounded-2xl border border-[#1d2c42] bg-[#0f1a2b] p-8 text-center">
        <h1 className="text-xl font-bold">Confirm your email</h1>
        <p className="mt-2 text-sm text-[#93a2ba]">One tap to confirm this email is yours.</p>
        <button
          type="button"
          onClick={confirm}
          disabled={state !== 'idle' || !token}
          data-testid="confirm-academy-email"
          className="mt-6 w-full rounded-lg bg-[#4ecde6] px-4 py-3 font-bold text-[#04141a] transition hover:brightness-105 disabled:opacity-60"
        >
          {state === 'working' ? 'Confirming…' : state === 'done' ? 'Confirmed. Taking you to your account…' : 'Confirm my email'}
        </button>
        {error && <p className="mt-3 text-sm text-[#e0736d]">{error}</p>}
      </div>
    </main>
  )
}

export default function Page() {
  return <Suspense><ConfirmEmail /></Suspense>
}
