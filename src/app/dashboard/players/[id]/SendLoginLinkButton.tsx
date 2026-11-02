'use client'

import { useState } from 'react'

// "Send login link": the academy emails a parent a link that signs them straight in, on any device
// (John, 2 Nov 2026). Child page and parent page. See /api/admin/parents/[parentId]/login-link.
export default function SendLoginLinkButton({ parentId }: { parentId: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState('')
  async function send() {
    setState('sending'); setError('')
    const res = await fetch(`/api/admin/parents/${parentId}/login-link`, { method: 'POST' }).catch(() => null)
    const data = res ? await res.json().catch(() => ({})) : {}
    if (!res?.ok) { setError(data.error || 'Could not send. Please try again.'); setState('idle'); return }
    setState('sent')
  }
  return (
    <span className="inline-flex flex-col gap-1">
      <button type="button" onClick={send} disabled={state !== 'idle'} data-testid="send-login-link"
        className="inline-flex w-fit items-center rounded-lg border border-[#293b58] bg-[#142236] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:border-[#4ecde6]/50 disabled:opacity-60">
        {state === 'sending' ? 'Sending…' : state === 'sent' ? 'Login link sent' : 'Send login link'}
      </button>
      {error && <span className="max-w-[260px] text-[11px] leading-snug text-[#e0736d]">{error}</span>}
    </span>
  )
}
