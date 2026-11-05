'use client'

import { useState } from 'react'
import Link from 'next/link'

// "Open my account" right after confirming an invite (src/app/api/invite/open-account/route.ts):
// the parent chooses a password and lands in their dashboard, no email needed (John, 5 Nov 2026).
export default function OpenAccountButton({ token, color }: { token: string; color: string }) {
  const [state, setState] = useState<'idle' | 'opening' | 'sign_in' | 'error'>('idle')
  const [error, setError] = useState('')

  async function open() {
    setState('opening'); setError('')
    for (let i = 0; i < 10; i++) {
      const res = await fetch('/api/invite/open-account', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) }).catch(() => null)
      const d = res ? await res.json().catch(() => ({})) : {}
      if (res?.status === 202) { await new Promise((r) => setTimeout(r, 3000)); continue }
      if (d.state === 'open' && d.url) { window.location.href = d.url; return }
      if (d.state === 'sign_in') { setState('sign_in'); return }
      setError(d.error || 'Something went wrong. Please try again.'); setState('error'); return
    }
    setError('Your payment is still being confirmed. Try again in a minute.'); setState('error')
  }

  if (state === 'sign_in') return (
    <div className="space-y-2 text-center">
      <p className="text-xs text-white/60">You&apos;ve already set up your account. Sign in with your email and password.</p>
      <Link href="/auth/signin" className="block w-full rounded-full py-3 text-center text-sm font-bold" style={{ backgroundColor: color, color: '#0a0a0a' }}>Sign in</Link>
    </div>
  )
  return (
    <div className="space-y-2">
      <button type="button" onClick={open} disabled={state === 'opening'} className="block w-full rounded-full py-3 text-center text-sm font-bold disabled:opacity-60" style={{ backgroundColor: color, color: '#0a0a0a' }}>
        {state === 'opening' ? 'Opening…' : 'Open my account'}
      </button>
      <p className="text-center text-xs text-white/50">You&apos;ll choose a password, then go straight to your dashboard.</p>
      {error && <p className="text-center text-xs text-[#e0736d]">{error}</p>}
    </div>
  )
}
