'use client'

/**
 * What an academy does with a trial that has happened: send the joining link,
 * move it to another date, or close it. See src/lib/trial-join.ts.
 * Replaces "Convert", which only ticked a box.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

export default function TrialJoinActions({ id, childName, hasEmail, sentAt, card = false }: { id: string; childName: string; hasEmail: boolean; sentAt: string | null; card?: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState<null | 'send' | 'date' | 'close' | 'joined'>(null)
  const [sent, setSent] = useState<string | null>(sentAt)
  const [err, setErr] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  const [newDate, setNewDate] = useState('')

  async function post(what: NonNullable<typeof busy>, path: string, body?: unknown) {
    setBusy(what); setErr(null)
    try {
      const res = await fetch(`/api/admin/trials/${id}/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
      const json = await res.json().catch(() => ({})) as { ok?: boolean; error?: string; sentAt?: string }
      if (!res.ok || !json.ok) { setErr(json.error || 'That did not work. Please try again.'); return null }
      return json
    } catch { setErr('No connection. Please try again.'); return null } finally { setBusy(null) }
  }

  const send = async () => { const r = await post('send', 'send-join-link'); if (r) { setSent(r.sentAt || new Date().toISOString()); router.refresh() } }
  const saveDate = async () => { if (!newDate) return; if (await post('date', 'extend', { newDate })) { setPicking(false); router.refresh() } }
  const close = async () => { if (!window.confirm(`Close ${childName}'s trial as not joining? Nothing is sent to the parent.`)) return; if (await post('close', 'mark-lost')) router.refresh() }
  const joined = async () => { if (!window.confirm(`Mark ${childName} as joined? Use this only if they are already a paying member. It does not take a payment.`)) return; if (await post('joined', 'mark-converted')) router.refresh() }

  // On a phone card: one full-width cyan button, bordered secondaries. In the table: small chips.
  const quiet = card
    ? 'flex-1 whitespace-nowrap rounded-xl border border-[#243652] bg-white/[0.02] px-3 py-2.5 text-sm font-semibold text-white/80 transition-colors hover:border-white/30 hover:text-white disabled:opacity-50'
    : 'rounded-lg border border-[#243652] px-2.5 py-1.5 text-xs font-semibold text-white/70 transition-colors hover:border-white/30 hover:text-white disabled:opacity-50'
  const main = card
    ? 'w-full rounded-xl bg-[#4ecde6] px-4 py-3 text-sm font-bold text-[#06121c] transition-opacity hover:opacity-90 disabled:opacity-50'
    : 'rounded-lg bg-[#4ecde6] px-3 py-1.5 text-xs font-bold text-[#06121c] transition-opacity hover:opacity-90 disabled:opacity-50'
  return (
    <div className={`flex w-full flex-wrap items-center gap-2 ${card ? 'order-first' : ''}`} data-testid="trial-join-actions">
      {hasEmail && (
        <button type="button" onClick={send} disabled={busy !== null} data-testid="trial-send-join-link"
          className={sent ? quiet : main}>
          {busy === 'send' ? 'Sending…' : sent ? 'Send again' : 'Send joining link'}
        </button>
      )}
      <button type="button" onClick={() => setPicking((v) => !v)} disabled={busy !== null} className={quiet} data-testid="trial-new-date">Another trial date</button>
      <button type="button" onClick={close} disabled={busy !== null} className={quiet} data-testid="trial-not-joining">{busy === 'close' ? 'Closing…' : 'Not joining'}</button>
      <button type="button" onClick={joined} disabled={busy !== null} className={`px-1 text-xs text-white/40 underline-offset-2 hover:text-white/70 hover:underline disabled:opacity-50 ${card ? 'w-full pt-1 text-center' : ''}`} data-testid="trial-already-joined">Already a paying member?</button>
      {sent && <p className={`w-full text-xs text-white/55 ${card ? 'order-first' : ''}`} data-testid="trial-join-sent"><span className="font-semibold text-[#4ecde6]">Joining link emailed {shortDate(sent)}.</span> It marks itself as joined when they pay.</p>}
      {picking && (
        <div className="flex w-full flex-wrap items-center gap-2" data-testid="trial-date-picker">
          <input type="date" value={newDate} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setNewDate(e.target.value)} aria-label="New trial date"
            className="rounded-lg border border-[#243652] bg-[#0f1a2b] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#4ecde6]/60 [color-scheme:dark]" />
          <button type="button" onClick={saveDate} disabled={!newDate || busy !== null} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/15 disabled:opacity-40">{busy === 'date' ? 'Saving…' : 'Save date'}</button>
          <span className="text-xs text-white/40">Nothing is sent to the parent.</span>
        </div>
      )}
      {err && <p className="w-full text-xs text-rose-300" role="alert">{err}</p>}
    </div>
  )
}
