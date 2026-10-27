'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RemoveChildDiscount({ auditId, childName }: { auditId: string; childName: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function remove() {
    if (!confirm(`Take ${childName}'s discount off? Their next payment is the full price.`)) return
    setBusy(true); setError('')
    const res = await fetch('/api/discounts/child', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ auditId }) })
    const d = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(d.error || 'Couldn’t remove it'); return }
    router.refresh()
  }
  return (
    <div>
      <button onClick={remove} disabled={busy} className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/5 disabled:opacity-50">{busy ? 'Removing…' : 'Remove'}</button>
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  )
}
