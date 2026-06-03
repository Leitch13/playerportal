/**
 * ThreadView — server-rendered list of messages in a single thread.
 *
 * Renders each message as a chat bubble (left = inbound, right = sent
 * by current user). Surfaces the delivery_status chip on outbound
 * messages when migration 074 is applied; gracefully omits otherwise.
 *
 * No client state, no hooks — the reply form is a separate client
 * component (ThreadReplyForm) that POSTs to /api/messages/send.
 */

interface MessageRow {
  id: string
  thread_id: string | null
  sender_id: string
  recipient_id: string
  subject: string | null
  body: string
  read: boolean
  created_at: string
  channel?: string | null
  delivery_status?: string | null
  delivery_failure_reason?: string | null
}

interface ProfileLite {
  id: string
  full_name: string | null
  role: string | null
  email: string | null
}

export default function ThreadView({
  currentUserId,
  messages,
  profileMap,
}: {
  currentUserId: string
  messages: MessageRow[]
  profileMap: Map<string, ProfileLite>
}) {
  return (
    <div className="bg-[#0f0f0f] border border-[#1e1e1e] rounded-2xl p-4 space-y-4" data-testid="thread-view">
      {messages.map(m => {
        const isMine = m.sender_id === currentUserId
        const sender = profileMap.get(m.sender_id)
        const senderName = isMine ? 'You' : (sender?.full_name || 'Unknown')
        const when = new Date(m.created_at).toLocaleString('en-GB', {
          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
        })
        return (
          <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] min-w-[180px] rounded-2xl px-4 py-2.5 ${isMine ? 'bg-[#1a2a2e] border border-[#4ecde6]/20' : 'bg-[#1a1a1a] border border-[#252525]'}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[10px] uppercase tracking-wider font-bold ${isMine ? 'text-[#4ecde6]' : 'text-white/60'}`}>{senderName}</span>
                {!isMine && sender?.role && (
                  <span className="text-[9px] uppercase tracking-wider font-bold text-white/40">· {sender.role}</span>
                )}
                <span className="ml-auto text-[10px] text-white/40 tabular-nums">{when}</span>
              </div>
              {m.subject && messages.indexOf(m) === 0 && (
                <p className="text-xs font-semibold text-white/70 mb-1">{m.subject}</p>
              )}
              <p className="text-sm text-white/90 whitespace-pre-wrap break-words">{m.body}</p>
              {isMine && <DeliveryStatusChip msg={m} />}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function DeliveryStatusChip({ msg }: { msg: MessageRow }) {
  const status = msg.delivery_status
  if (!status) return null
  if (status === 'sent' || status === 'delivered') {
    return (
      <span className="inline-flex items-center gap-1 mt-1 text-[10px] text-emerald-300/80">
        <span aria-hidden>✓</span>
        Delivered via {msg.channel || 'email'}
      </span>
    )
  }
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 mt-1 text-[10px] text-rose-300" title={msg.delivery_failure_reason || ''}>
        <span aria-hidden>⚠</span>
        Delivery failed
      </span>
    )
  }
  if (status === 'skipped') {
    return (
      <span className="inline-flex items-center gap-1 mt-1 text-[10px] text-amber-300" title={msg.delivery_failure_reason || ''}>
        <span aria-hidden>!</span>
        Email skipped (no email on file)
      </span>
    )
  }
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 mt-1 text-[10px] text-white/50">
        <span aria-hidden>…</span>
        Sending…
      </span>
    )
  }
  return null
}
