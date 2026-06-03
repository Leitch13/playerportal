'use client'

import { useState } from 'react'
import type { MessageData } from './MessagesApp'

export default function NewMessage({
  currentUserId,
  currentUserName,
  orgId,
  recipients,
  onMessageSent,
  onBack,
}: {
  currentUserId: string
  currentUserName: string
  orgId: string
  recipients: { id: string; full_name: string; role: string }[]
  onMessageSent: (msg: MessageData) => void
  onBack: () => void
}) {
  const [recipientId, setRecipientId] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [search, setSearch] = useState('')

  const filteredRecipients = search.trim()
    ? recipients.filter(
        (r) =>
          r.full_name.toLowerCase().includes(search.toLowerCase()) ||
          r.role.toLowerCase().includes(search.toLowerCase())
      )
    : recipients

  const selectedRecipient = recipients.find((r) => r.id === recipientId)

  function getRoleBadgeColor(role: string): string {
    switch (role) {
      case 'admin':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/20'
      case 'coach':
        return 'bg-[#4ecde6]/20 text-[#4ecde6] border-[#4ecde6]/20'
      default:
        return 'bg-white/10 text-white/60 border-white/10'
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!recipientId || !body.trim() || sending) return

    setSending(true)

    // Day 1 — route through the unified send API so the message ALSO
    // delivers via email. Previously this called supabase.from('messages')
    // .insert directly; the row was created but no parent ever received
    // anything in their inbox.
    const threadId = crypto.randomUUID()
    let messageId = ''
    let okToShow = false
    let createdAt = new Date().toISOString()

    try {
      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          recipientIds: [recipientId],
          subject: subject || null,
          body: body.trim(),
          threadId,
        }),
      })
      const json = await res.json().catch(() => ({} as { ok?: boolean; messageIds?: string[] }))
      if (res.ok && json.ok && Array.isArray(json.messageIds) && json.messageIds.length > 0) {
        messageId = json.messageIds[0]
        okToShow = true
      } else {
        // surface error inline (existing UI degrades silently — improve later)
        const errMsg = (json as { error?: string }).error || `HTTP ${res.status}`
        console.error('Message send failed:', errMsg)
      }
    } catch (err) {
      console.error('Message send threw:', err)
    }

    if (okToShow) {
      const recipient = recipients.find((r) => r.id === recipientId)
      const msgData: MessageData = {
        id: messageId,
        sender_id: currentUserId,
        recipient_id: recipientId,
        body: body.trim(),
        subject: subject || null,
        read: false,
        created_at: createdAt,
        thread_id: threadId,
        sender: { id: currentUserId, full_name: currentUserName, role: 'parent' },
        recipient: recipient || { id: recipientId, full_name: 'Unknown', role: 'parent' },
      }
      onMessageSent(msgData)
    }

    setSending(false)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-[#1e1e1e] bg-[#0e0e0e]">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/[0.05] text-white/60 transition-colors"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div className="w-10 h-10 rounded-full bg-[#4ecde6]/15 border border-[#4ecde6]/20 flex items-center justify-center flex-shrink-0">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#4ecde6"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-white">New Message</p>
            <p className="text-[11px] text-white/40">Start a new conversation</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Recipient selection */}
        <div>
          <label className="block text-xs font-medium text-white/50 mb-2 uppercase tracking-wider">
            To
          </label>
          {selectedRecipient ? (
            <div className="flex items-center gap-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 border ${getRoleBadgeColor(
                  selectedRecipient.role
                )}`}
              >
                {selectedRecipient.full_name.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm text-white flex-1">{selectedRecipient.full_name}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${getRoleBadgeColor(
                  selectedRecipient.role
                )}`}
              >
                {selectedRecipient.role}
              </span>
              <button
                type="button"
                onClick={() => setRecipientId('')}
                className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/10 text-white/40 transition-colors"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="relative">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  placeholder="Search by name or role..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#4ecde6]/40 focus:ring-1 focus:ring-[#4ecde6]/20 transition-colors"
                />
              </div>
              <div className="max-h-48 overflow-y-auto rounded-xl border border-[#1e1e1e] bg-[#141414]">
                {filteredRecipients.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-white/30 text-center">No recipients found</p>
                ) : (
                  filteredRecipients.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        setRecipientId(r.id)
                        setSearch('')
                      }}
                      className="w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-[#1a1a1a] transition-colors border-b border-[#1e1e1e] last:border-0"
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border ${getRoleBadgeColor(
                          r.role
                        )}`}
                      >
                        {r.full_name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm text-white/80 flex-1">{r.full_name}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${getRoleBadgeColor(
                          r.role
                        )}`}
                      >
                        {r.role}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Subject */}
        <div>
          <label className="block text-xs font-medium text-white/50 mb-2 uppercase tracking-wider">
            Subject (optional)
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. Training schedule change"
            className="w-full px-4 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#4ecde6]/40 focus:ring-1 focus:ring-[#4ecde6]/20 transition-colors"
          />
        </div>

        {/* Message body */}
        <div>
          <label className="block text-xs font-medium text-white/50 mb-2 uppercase tracking-wider">
            Message
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Type your message here..."
            rows={6}
            className="w-full px-4 py-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#4ecde6]/40 focus:ring-1 focus:ring-[#4ecde6]/20 resize-none transition-colors leading-relaxed"
          />
        </div>
      </div>

      {/* Send button */}
      <div className="flex-shrink-0 p-4 border-t border-[#1e1e1e] bg-[#0e0e0e]">
        <button
          onClick={handleSend}
          disabled={!recipientId || !body.trim() || sending}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[#4ecde6] text-[#0a0a0a] rounded-xl text-sm font-semibold hover:bg-[#4ecde6]/90 disabled:opacity-30 disabled:hover:bg-[#4ecde6] transition-all"
        >
          {sending ? (
            <>
              <div className="w-4 h-4 border-2 border-[#0a0a0a]/30 border-t-[#0a0a0a] rounded-full animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
                stroke="none"
              >
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
              Send Message
            </>
          )}
        </button>
      </div>
    </div>
  )
}
