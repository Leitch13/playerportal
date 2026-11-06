'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

// John's page for a new academy (src/lib/academy-approval.ts). Opening it changes
// nothing (email scanners open links); only the buttons decide.
type Info = { academy: string | null; owner: string | null; email: string | null; phone: string | null; location: string | null }

function Approve() {
  const token = useSearchParams().get('t') || ''
  const [info, setInfo] = useState<Info | null>(null)
  const [state, setState] = useState<'idle' | 'working' | string>('idle')
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/onboard/approve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
      .then((r) => r.json()).then((d) => { if (d.error) setError(d.error); else setInfo(d) }).catch(() => setError('Could not load.'))
  }, [token])

  async function decide(decision: 'approve' | 'reject') {
    setState('working')
    setError('')
    const res = await fetch('/api/onboard/approve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, decision }) })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setError(data.error || 'Something went wrong. Please try again.'); setState('idle'); return }
    setState(data.state)
  }

  const done: Record<string, string> = {
    approved: 'Approved. Their dashboard and booking page are open and they’ve been emailed.',
    declined: 'Declined. Their dashboard and booking page stay closed.',
    already_approved: 'This academy was already approved.',
    already_declined: 'This academy was already declined.',
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#080e18] px-4 text-white">
      <div className="w-full max-w-md rounded-2xl border border-[#1d2c42] bg-[#0f1a2b] p-8">
        <h1 className="text-xl font-bold">New academy</h1>
        {info && (
          <dl className="mt-4 space-y-1 text-sm text-[#93a2ba]">
            <div><span className="text-white font-semibold">{info.academy || 'Unknown academy'}</span></div>
            {info.owner && <div>Owner: {info.owner}</div>}
            {info.email && <div>Email: {info.email}</div>}
            {info.phone && <div>Phone: {info.phone}</div>}
            {info.location && <div>Location: {info.location}</div>}
          </dl>
        )}
        {state in done ? (
          <p className="mt-6 text-sm" data-testid="approve-result">{done[state]}</p>
        ) : (
          <div className="mt-6 grid gap-3">
            <button type="button" onClick={() => decide('approve')} disabled={state === 'working' || !info}
              className="w-full rounded-lg bg-[#4ecde6] px-4 py-3 font-bold text-[#04141a] disabled:opacity-60" data-testid="approve-academy">
              Approve
            </button>
            <button type="button" onClick={() => decide('reject')} disabled={state === 'working' || !info}
              className="w-full rounded-lg border border-[#293b58] bg-[#142236] px-4 py-2.5 text-sm font-semibold disabled:opacity-60" data-testid="decline-academy">
              Don&apos;t approve
            </button>
          </div>
        )}
        {error && <p className="mt-3 text-sm text-[#e0736d]">{error}</p>}
      </div>
    </main>
  )
}

export default function Page() {
  return <Suspense><Approve /></Suspense>
}
