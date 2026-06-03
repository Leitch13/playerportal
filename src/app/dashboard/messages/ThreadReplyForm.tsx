'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * ThreadReplyForm — client reply composer for the thread view.
 *
 * Posts to /api/messages/send with the EXISTING threadId so the reply
 * lands on the same conversation. After a successful send, refreshes
 * the route so the new message + delivery chip appear immediately.
 *
 * Works for both admin/coach (replying to a parent) and parent
 * (replying to staff) once the API allows it.
 */
export default function ThreadReplyForm({
  threadId,
  recipientId,
  recipientName,
  subject,
}: {
  threadId: string
  recipientId: string
  recipientName: string
  subject: string | null
}) {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    if (!body.trim()) return
    setSending(true)
    try {
      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          recipientIds: [recipientId],
          subject,           // preserve original subject on replies
          body: body.trim(),
          threadId,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) {
        setError((json as { error?: string }).error || `HTTP ${res.status}`)
        setSending(false)
        return
      }
      // Surface email delivery state to the sender — Day 1 trust ask.
      if ((json.emailed ?? 0) === 0) {
        setError(`Message saved, but email could not be delivered${json.skipped ? ' (no email on file)' : ''}.`)
      } else {
        setSuccess(true)
        setBody('')
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send failed')
    } finally {
      setSending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-[#141414] border border-[#1e1e1e] rounded-2xl p-4 space-y-3" data-testid="thread-reply-form">
      <label className="block">
        <span className="text-[11px] uppercase tracking-wider font-bold text-white/40">
          Reply to {recipientName}
        </span>
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          required
          rows={4}
          placeholder={`Write your reply to ${recipientName}…`}
          className="mt-2 w-full px-3 py-2 bg-[#0f0f0f] border border-[#252525] rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#4ecde6]/40"
        />
      </label>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-[10px] text-white/40">
          Your reply is delivered both in-app and by email.
        </div>
        <button
          type="submit"
          disabled={sending || !body.trim()}
          className="px-4 py-2 rounded-lg text-sm font-bold bg-[#4ecde6] text-black disabled:opacity-40 hover:bg-[#5edcf6] transition-colors"
        >
          {sending ? 'Sending…' : 'Send reply'}
        </button>
      </div>
      {error && <p className="text-xs text-rose-300">{error}</p>}
      {success && <p className="text-xs text-emerald-300/80">Reply sent.</p>}
    </form>
  )
}
