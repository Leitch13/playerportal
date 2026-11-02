'use client'

import { useState } from 'react'

// "WhatsApp it": next to every academy send button (John, 2 Nov 2026). Opens WhatsApp on the
// academy's phone with the family's own link and a message typed in; they press send.
// The link and message come from /api/admin/whatsapp-link, which sends nothing itself.
export default function WhatsAppItButton({ kind, id, compact = false }: { kind: 'invite' | 'card' | 'owed' | 'charge' | 'setup' | 'camp'; id: string; compact?: boolean }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function go() {
    setBusy(true); setError('')
    // Opened now, inside the tap, so phones don't block it as a pop-up; pointed at WhatsApp once the link is ready.
    const win = typeof window !== 'undefined' ? window.open('', '_blank') : null
    const res = await fetch('/api/admin/whatsapp-link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, id }) }).catch(() => null)
    const data = res ? await res.json().catch(() => ({})) : {}
    setBusy(false)
    if (!res?.ok || !data.url) { win?.close(); setError(data.error || 'Could not open WhatsApp. Please try again.'); return }
    if (win) win.location.href = data.url
    else window.location.href = data.url
  }
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button type="button" onClick={go} disabled={busy} data-testid={`whatsapp-${kind}`}
        className={`inline-flex items-center gap-1.5 rounded-lg border border-[#25D366]/50 bg-[#25D366]/10 font-semibold text-[#5be08f] transition-colors hover:bg-[#25D366]/20 disabled:opacity-60 ${compact ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-2 text-sm'}`}>
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3a.4.4 0 0 0 0-.4l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7a2.8 2.8 0 0 0 1.8-1.3 2.3 2.3 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3Z" /></svg>
        {busy ? 'Opening…' : 'WhatsApp it'}
      </button>
      {error && <span className="max-w-[240px] text-right text-[11px] leading-snug text-[#e0736d]">{error}</span>}
    </span>
  )
}
