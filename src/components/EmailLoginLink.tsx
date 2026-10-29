'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

/**
 * "We've emailed you a login link" box for parents who have no password yet (John, 29 Oct 2026:
 * No.1 GK parents confirmed their invite, were told to sign in, had no password, and went round
 * in circles). Uses the any-device email link (src/lib/auth-email-links.ts). With `auto`, it sends
 * once as soon as the page opens (once per browser tab, keyed by `onceKey`).
 */
export default function EmailLoginLink({ email, auto = false, onceKey, color = '#4ecde6' }: { email: string; auto?: boolean; onceKey?: string; color?: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState('')
  const started = useRef(false)

  async function send() {
    setState('sending'); setError('')
    const res = await fetch('/api/auth/email-link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, kind: 'signin' }) }).catch(() => null)
    if (res?.ok) { setState('sent'); return }
    const d = (await res?.json().catch(() => ({}))) as { error?: string } | undefined
    setError(d?.error || 'Something went wrong. Please try again.'); setState('error')
  }

  useEffect(() => {
    if (!auto || !email || started.current) return
    started.current = true
    const key = `pp-login-link:${onceKey || email}`
    let already = false
    try { already = sessionStorage.getItem(key) === '1'; sessionStorage.setItem(key, '1') } catch { /* private window */ }
    if (already) setState('sent')
    else void send()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, email, onceKey])

  if (!email) return (
    <Link href="/auth/signin" className="block w-full py-3 rounded-full font-bold text-sm text-center" style={{ backgroundColor: color, color: '#0a0a0a' }}>Sign in</Link>
  )

  return (
    <div className="space-y-3 text-center" data-testid="email-login-link">
      {state === 'sent' ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <p className="text-sm font-semibold text-white">Check your email</p>
          <p className="text-xs text-white/60 mt-1">We&apos;ve sent a login link to <b className="text-white/80">{email}</b>. Tap it to open your account. No password needed. It works on any phone or computer.</p>
        </div>
      ) : (
        <button onClick={send} disabled={state === 'sending'} className="block w-full py-3 rounded-full font-bold text-sm text-center disabled:opacity-60" style={{ backgroundColor: color, color: '#0a0a0a' }}>
          {state === 'sending' ? 'Sending…' : 'Email me my login link'}
        </button>
      )}
      {state === 'error' && <p className="text-xs text-red-400">{error}</p>}
      <p className="text-[11px] text-white/40">
        {state === 'sent' ? <>Not arrived? Check junk, or <button onClick={send} className="underline">send it again</button>. </> : <>No password needed. </>}
        Already have a password? <Link href={`/auth/signin?email=${encodeURIComponent(email)}`} className="underline">Sign in</Link>
      </p>
    </div>
  )
}
