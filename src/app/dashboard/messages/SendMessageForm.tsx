'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function SendMessageForm({
  parents,
  autoOpen,
  orgId,
}: {
  parents: { id: string; full_name: string }[]
  autoOpen: boolean
  orgId: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(autoOpen)

  useEffect(() => {
    if (autoOpen) setOpen(true)
  }, [autoOpen])
  const [recipientId, setRecipientId] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  // Sprint M1 (MF-5) — surface failures inline instead of blocking the
  // thread with a browser alert(). `error` is the message we show in a
  // banner above the actions row; the same row gets a Retry button when
  // it's non-null. `warning` covers the soft-fail "saved but not emailed"
  // case so the parent doesn't think the message bounced.
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setWarning(null)
    setLoading(true)

    // Day 1 — route through unified send API: inserts AND emails.
    try {
      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          recipientIds: [recipientId],
          subject: subject || null,
          body,
        }),
      })
      const json = await res.json().catch(() => ({} as { ok?: boolean; error?: string; emailed?: number }))
      if (!res.ok || !json.ok) {
        setError((json as { error?: string }).error || `Send failed (HTTP ${res.status}). Tap Retry to try again.`)
      } else {
        if ((json.emailed ?? 0) === 0) {
          setWarning('Message saved, but email delivery was skipped (no email on file).')
        }
        setOpen(false)
        setRecipientId('')
        setSubject('')
        setBody('')
        router.refresh()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send failed. Tap Retry to try again.')
    }
    setLoading(false)
  }

  // MF-5 — Retry re-submits without making the user re-type. We synthesise
  // a SubmitEvent-shaped object because handleSubmit only reads
  // .preventDefault().
  function handleRetry() {
    handleSubmit({ preventDefault() {} } as React.FormEvent)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors"
      >
        + Send Message
      </button>
    )
  }

  return (
    // Sprint M1 (MF-1) — composer becomes a flex column so the actions row
    // can sticky-bottom on mobile (above the soft keyboard) without
    // sliding off the visible area. Max height caps the panel so the
    // recipient/subject/textarea region scrolls instead of pushing the
    // Send button down.
    <div className="bg-[#141414] rounded-xl border border-[#1e1e1e] p-4 sm:p-6 flex flex-col max-h-[calc(100dvh-8rem)]">
      <h2 className="text-lg font-semibold mb-4 shrink-0">New Message</h2>
      <form onSubmit={handleSubmit} className="space-y-4 flex flex-col min-h-0 flex-1">
        <div>
          <label className="block text-sm font-medium mb-1">To *</label>
          <select
            value={recipientId}
            onChange={(e) => setRecipientId(e.target.value)}
            required
            className="w-full px-3 py-2 border border-[#1e1e1e] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="">Select parent...</option>
            {parents.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full px-3 py-2 border border-[#1e1e1e] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Message *</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {[
              'Thanks for your message, I\'ll get back to you shortly',
              'Your child did great today!',
              'Reminder: please bring shin pads to the next session',
              'Payment is now overdue, please settle at your earliest convenience',
            ].map((tpl) => (
              <button
                key={tpl}
                type="button"
                onClick={() => setBody(tpl)}
                className="px-3 py-1 text-xs rounded-full bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors truncate max-w-[260px]"
                title={tpl}
              >
                {tpl}
              </button>
            ))}
          </div>
          {/* MF-1 — textarea grows from 4 rows up to ~50dvh so the field
              gets bigger on a phone (thumbs need room) without overflowing
              when the keyboard is open. min-h beats rows on small screens. */}
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            rows={4}
            className="w-full px-3 py-2 border border-[#1e1e1e] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary min-h-[112px] sm:min-h-[140px] max-h-[40dvh] resize-y"
          />
        </div>
        {/* MF-5 — inline error + soft-fail warning. Error stays until
            Retry succeeds; warning is informational only. */}
        {error && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs sm:text-sm text-rose-300">
            <div className="font-medium">Couldn&apos;t send your message</div>
            <div className="text-rose-300/80 mt-0.5">{error}</div>
          </div>
        )}
        {warning && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs sm:text-sm text-amber-300">
            {warning}
          </div>
        )}
        {/* MF-1 — actions row sticks to the bottom of the composer on
            mobile so the Send button is always thumb-reachable above the
            soft keyboard. The negative margins extend the sticky band to
            the panel edges. */}
        <div className="sticky bottom-0 -mx-4 sm:-mx-6 -mb-4 sm:-mb-6 px-4 sm:px-6 py-3 mt-auto bg-[#141414] border-t border-white/5 flex gap-2 flex-wrap shrink-0">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2.5 sm:py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50 transition-colors flex-1 sm:flex-none min-h-[44px]"
          >
            {loading ? 'Sending...' : 'Send'}
          </button>
          {error && !loading && (
            <button
              type="button"
              onClick={handleRetry}
              className="px-4 py-2.5 sm:py-2 bg-rose-500/15 text-rose-200 border border-rose-500/30 rounded-lg text-sm font-medium hover:bg-rose-500/25 transition-colors min-h-[44px]"
            >
              Retry
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="px-4 py-2.5 sm:py-2 border border-[#1e1e1e] rounded-lg text-sm font-medium hover:bg-white/5 transition-colors min-h-[44px]"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
