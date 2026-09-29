'use client'

import { useState } from 'react'
import PolicyAccept from '../PolicyAccept'

export default function AgreeAndPay({ checkoutId, academy, accent, ink }: { checkoutId: string; academy: string; accent: string; ink: string }) {
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const go = async () => {
    setBusy(true); setErr(null)
    const res = await fetch('/api/one-to-one/agree', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ checkoutId, policyAccepted: agreed }) })
    const j = await res.json().catch(() => ({}))
    if (!res.ok || !j.url) { setBusy(false); setErr(j.error || 'Could not open the payment page'); return }
    window.location.href = j.url
  }
  return (
    <div className="space-y-4">
      <PolicyAccept checked={agreed} onChange={setAgreed} academy={academy} accent={accent} />
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={go} disabled={!agreed || busy} className="rounded-xl px-5 py-3 text-sm font-semibold disabled:opacity-40" style={{ background: accent, color: ink }}>
          {busy ? 'One moment…' : 'Continue to payment'}
        </button>
        {err && <span className="text-xs text-[#f3a7a2]" role="status">{err}</span>}
      </div>
    </div>
  )
}
