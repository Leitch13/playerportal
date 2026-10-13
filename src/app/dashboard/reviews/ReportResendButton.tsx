'use client'

/**
 * The status line on a player report: emailed to the parent or not, opened or
 * not, and a button to email it. See src/lib/report-status.ts.
 * The moment a send succeeds the line itself changes, without waiting for the page.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Part = { ok: boolean; text: string }

export default function ReportResendButton({ reviewId, sent, seen, canSend, who }: { reviewId: string; sent: Part; seen: Part; canSend: boolean; who: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [justSent, setJustSent] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const send = async () => {
    setBusy(true); setErr(null)
    try {
      const res = await fetch('/api/email/progress-report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reviewId }) })
      const json = await res.json().catch(() => ({})) as { emailed?: boolean; error?: string }
      if (res.ok && json.emailed) { setJustSent(true); router.refresh() } else setErr(/no parent email/i.test(json.error || '') ? 'No email address for this parent.' : 'The email could not be sent. Please try again.')
    } catch { setErr('No connection. Please try again.') } finally { setBusy(false) }
  }
  const shown: Part = justSent ? { ok: true, text: `Emailed to ${who} just now` } : sent
  const dot = (ok: boolean) => <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${ok ? 'bg-[#4ecde6]' : 'bg-white/25'}`} />
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px]" data-testid="report-status">
      <span className={`inline-flex items-center gap-1.5 font-semibold ${shown.ok ? 'text-white/80' : 'text-white/55'}`} data-testid="report-status-sent">{dot(shown.ok)}{shown.text}</span>
      {shown.ok && <span className={`inline-flex items-center gap-1.5 font-semibold ${seen.ok ? 'text-white/80' : 'text-white/45'}`} data-testid="report-status-seen">{dot(seen.ok)}{seen.text}</span>}
      {canSend && !justSent && (
        <button type="button" onClick={send} disabled={busy} data-testid="report-resend" className="rounded-lg border border-[#243652] px-2 py-0.5 text-[11px] font-semibold text-white/75 transition-colors hover:border-white/30 hover:text-white disabled:opacity-50">
          {busy ? 'Sending…' : sent.ok ? 'Email again' : 'Email it now'}
        </button>
      )}
      {err && <span className="w-full text-[11px] text-rose-300" role="alert">{err}</span>}
    </div>
  )
}
