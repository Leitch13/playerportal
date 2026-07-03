'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * ComposeButton — entry point for starting a NEW conversation from
 * /dashboard/messages.
 *
 * • Renders a button at the top of the page; clicking expands an inline
 *   composer (recipient picker + subject + body).
 * • POSTs to /api/messages/send with a fresh threadId (server picks one
 *   when omitted) and redirects to /dashboard/messages/[threadId] on
 *   success so the user immediately lands in the new thread.
 * • Works for every role — the recipient list is supplied by the server
 *   page (admin/coach see parents; parents see staff). Server-side the
 *   API double-checks the recipient is allowed for the sender's role.
 */
export default function ComposeButton({
  recipients,
  preSelectedRecipientId = '',
  autoOpen = false,
}: {
  recipients: { id: string; full_name: string; role: string }[]
  /** When the page received a valid `?to=<id>` deep-link, this pre-fills the
   *  recipient dropdown so the Send button enables as soon as a body is typed.
   *  Server already verified the id is in `recipients` — treat as trusted. */
  preSelectedRecipientId?: string
  /** Auto-expand the composer on mount. Set together with
   *  `preSelectedRecipientId` when the deep-link is honoured. */
  autoOpen?: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(autoOpen)
  const [recipientId, setRecipientId] = useState(preSelectedRecipientId)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!recipientId || !body.trim()) return
    setSending(true)
    try {
      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          recipientIds: [recipientId],
          subject: subject.trim() || null,
          body: body.trim(),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) {
        setError((json as { error?: string }).error || `HTTP ${res.status}`)
        setSending(false)
        return
      }
      setOpen(false)
      setRecipientId('')
      setSubject('')
      setBody('')
      // Navigate the user straight into the new conversation so they see
      // the message they just sent + the delivery chip.
      if (typeof json.threadId === 'string' && json.threadId) {
        router.push(`/dashboard/messages/${json.threadId}`)
      } else {
        router.refresh()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send failed')
    } finally {
      setSending(false)
    }
  }

  if (recipients.length === 0) {
    return (
      <div className="text-[11px] text-white/40 italic px-1">
        No one to message yet — once you have parents or staff added to your academy, a New Message button will appear here.
      </div>
    )
  }

  if (!open) {
    return (
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          data-testid="compose-open"
          className="px-4 py-2 rounded-lg text-sm font-bold bg-[#4ecde6] text-black hover:bg-[#5edcf6] transition-colors shadow-[0_0_20px_-8px_rgba(78,205,230,0.6)]"
        >
          + New Message
        </button>
        <span className="text-[10px] text-white/40">Both the in-app message and an email go out.</span>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-[#141414] border border-[#1e1e1e] rounded-2xl p-5 space-y-3" data-testid="compose-form">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-white">New message</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-[11px] text-white/40 hover:text-white/70">Cancel</button>
      </div>
      <label className="block">
        <span className="text-[11px] uppercase tracking-wider font-bold text-white/40">To</span>
        <select
          value={recipientId}
          onChange={e => setRecipientId(e.target.value)}
          required
          className="mt-2 w-full px-3 py-2 bg-[#0f0f0f] border border-[#252525] rounded-lg text-sm text-white focus:outline-none focus:border-[#4ecde6]/40"
        >
          <option value="">Select recipient…</option>
          {recipients.map(r => (
            <option key={r.id} value={r.id}>
              {r.full_name} ({r.role})
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-[11px] uppercase tracking-wider font-bold text-white/40">Subject (optional)</span>
        <input
          type="text"
          value={subject}
          onChange={e => setSubject(e.target.value)}
          placeholder="e.g. Practice schedule update"
          className="mt-2 w-full px-3 py-2 bg-[#0f0f0f] border border-[#252525] rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#4ecde6]/40"
        />
      </label>
      <label className="block">
        <span className="text-[11px] uppercase tracking-wider font-bold text-white/40">Message</span>
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          required
          rows={4}
          placeholder="Write your message…"
          className="mt-2 w-full px-3 py-2 bg-[#0f0f0f] border border-[#252525] rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#4ecde6]/40"
        />
      </label>
      <div className="flex items-center justify-end gap-3">
        <button
          type="submit"
          disabled={sending || !recipientId || !body.trim()}
          className="px-4 py-2 rounded-lg text-sm font-bold bg-[#4ecde6] text-black disabled:opacity-40 hover:bg-[#5edcf6] transition-colors"
        >
          {sending ? 'Sending…' : 'Send message'}
        </button>
      </div>
      {error && <p className="text-xs text-rose-300">{error}</p>}
    </form>
  )
}
