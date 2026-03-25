'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Message = {
  id: string
  sender_id: string
  recipient_id: string
  subject: string | null
  body: string
  created_at: string
  read: boolean
  sender?: { full_name: string } | null
  recipient?: { full_name: string } | null
}

export default function MessageThread({
  message,
  currentUserId,
  isStaff,
  orgId,
}: {
  message: Message
  currentUserId: string
  isStaff: boolean
  orgId: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [replyBody, setReplyBody] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const isSent = message.sender_id === currentUserId
  const otherName = isSent
    ? (message.recipient as { full_name: string } | null)?.full_name || 'Unknown'
    : (message.sender as { full_name: string } | null)?.full_name || 'Unknown'
  const initial = otherName.charAt(0).toUpperCase()

  async function handleReply(e: React.FormEvent) {
    e.preventDefault()
    if (!replyBody.trim()) return
    setSending(true)

    const supabase = createClient()
    const replyToId = isSent ? message.recipient_id : message.sender_id

    const { error } = await supabase.from('messages').insert({
      organisation_id: orgId,
      sender_id: currentUserId,
      recipient_id: replyToId,
      subject: message.subject ? `Re: ${message.subject.replace(/^Re: /, '')}` : null,
      body: replyBody,
    })

    if (error) {
      alert(error.message)
    } else {
      setSent(true)
      setReplyBody('')
      setTimeout(() => {
        setSent(false)
        setOpen(false)
        router.refresh()
      }, 1500)
    }
    setSending(false)
  }

  return (
    <>
      {/* Message row — clickable */}
      <button
        onClick={() => setOpen(true)}
        className="w-full text-left py-4 hover:bg-surface/50 transition-colors rounded-lg px-2 -mx-2"
      >
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-accent/10 text-accent text-sm font-bold flex-shrink-0">
            {isSent ? '→' : initial}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold truncate">
                {isSent ? `To: ${otherName}` : otherName}
              </span>
              {!isSent && !message.read && (
                <span className="w-2 h-2 rounded-full bg-accent flex-shrink-0" />
              )}
              <span className="text-xs text-text-light ml-auto flex-shrink-0">
                {formatTime(message.created_at)}
              </span>
            </div>
            {message.subject && (
              <p className="text-sm font-medium truncate mt-0.5">{message.subject}</p>
            )}
            <p className="text-sm text-text-light truncate mt-0.5">
              {message.body}
            </p>
          </div>
          <span className="text-text-light text-lg flex-shrink-0">›</span>
        </div>
      </button>

      {/* Message detail modal */}
      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div
            className="bg-white dark:bg-surface-dark rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-accent/10 text-accent font-bold">
                  {initial}
                </span>
                <div>
                  <p className="font-semibold">{otherName}</p>
                  <p className="text-xs text-text-light">{new Date(message.created_at).toLocaleString()}</p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface text-lg"
              >
                ✕
              </button>
            </div>

            {/* Message body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {message.subject && (
                <h3 className="font-semibold text-lg">{message.subject}</h3>
              )}
              <div className="bg-surface/50 dark:bg-primary/30 rounded-xl p-4">
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.body}</p>
              </div>
              <p className="text-xs text-text-light">
                {isSent ? 'You sent this message' : `From ${otherName}`} · {new Date(message.created_at).toLocaleString()}
              </p>
            </div>

            {/* Reply form */}
            <div className="border-t border-border p-4">
              {sent ? (
                <div className="text-center py-2">
                  <span className="text-sm text-accent font-medium">✓ Reply sent!</span>
                </div>
              ) : (
                <form onSubmit={handleReply} className="space-y-3">
                  <textarea
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    placeholder={`Reply to ${otherName}...`}
                    rows={3}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-sm resize-none"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="px-4 py-2 text-sm text-text-light hover:text-text transition-colors"
                    >
                      Close
                    </button>
                    <button
                      type="submit"
                      disabled={sending || !replyBody.trim()}
                      className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-light disabled:opacity-50 transition-colors"
                    >
                      {sending ? 'Sending...' : 'Reply'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
