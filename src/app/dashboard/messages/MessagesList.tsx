/**
 * MessagesList — Day 1 server-rendered messages view.
 *
 * Reads the LEGACY `messages` table (the active messaging system as of
 * Day 1) and renders threads grouped by `thread_id`. Each thread shows
 * the participants, last message snippet, unread badge, and (when
 * available) the delivery_status for the most recent message.
 *
 * No client interactivity beyond clicking a thread (links to a
 * pre-existing thread route OR renders inline). Replaces the previous
 * MessagingHub component on the /dashboard/messages page, which was
 * silently rendering an empty list because it read from the unused
 * `conversations` table.
 *
 * The older MessagingHub.tsx is left in place for archaeology but is
 * no longer imported by the route.
 */
import Link from 'next/link'
import type { MessageRow, Thread } from '@/lib/messages-derive'

export default function MessagesList({
  currentUserId,
  threads,
}: {
  currentUserId: string
  threads: Thread[]
}) {
  if (threads.length === 0) {
    return (
      <div className="bg-[#141414] border border-[#1e1e1e] rounded-2xl p-10 text-center">
        <p className="text-sm text-white/60">No messages yet.</p>
        <p className="text-[11px] text-white/40 mt-1">Start a conversation using the form above or via the deep-link from the Parents list.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-bold text-white px-1">Your conversations</h2>
      <div className="bg-[#141414] border border-[#1e1e1e] rounded-2xl overflow-hidden divide-y divide-[#1e1e1e]">
        {threads.map(t => {
          const other = t.participants.find(p => p.id !== currentUserId)
          const otherName = other?.full_name || 'Unknown'
          const otherRole = other?.role || ''
          const isInbound = t.lastMessage.sender_id !== currentUserId
          const senderLabel = isInbound ? otherName : 'You'
          const snippet = t.lastMessage.body.length > 160
            ? t.lastMessage.body.slice(0, 160) + '…'
            : t.lastMessage.body
          const when = new Date(t.lastMessage.created_at).toLocaleString('en-GB', {
            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
          })
          return (
            <Link
              key={t.threadId}
              href={`/dashboard/messages/${t.threadId}`}
              className="block p-4 hover:bg-white/[0.04] transition-colors cursor-pointer focus:outline-none focus:bg-white/[0.05]"
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-white truncate">{otherName}</span>
                    {otherRole && (
                      <span className="text-[10px] uppercase tracking-wider font-bold text-white/40 px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06]">{otherRole}</span>
                    )}
                    {t.unreadCount > 0 && (
                      <span className="text-[10px] font-bold text-rose-200 px-1.5 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30">
                        {t.unreadCount} new
                      </span>
                    )}
                  </div>
                  {t.subject && (
                    <p className="text-xs text-white/60 font-medium mt-0.5 truncate">{t.subject}</p>
                  )}
                  <p className="text-xs text-white/50 mt-1 leading-relaxed">
                    <span className="text-white/30">{senderLabel}:</span> {snippet}
                  </p>
                  <DeliveryStatusChip msg={t.lastMessage} isInbound={isInbound} />
                </div>
                <div className="text-[10px] text-white/40 tabular-nums shrink-0 whitespace-nowrap">{when}</div>
              </div>
            </Link>
          )
        })}
      </div>
      <p className="text-[10px] text-white/30 px-1">
        Conversations are grouped by thread. Click any row to open the full thread.
      </p>
    </div>
  )
}

function DeliveryStatusChip({ msg, isInbound }: { msg: MessageRow; isInbound: boolean }) {
  if (isInbound) return null  // we don't show delivery state for messages we received
  const status = msg.delivery_status
  if (!status) return null  // migration 074 not applied yet OR pre-Day-1 row
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
        Delivery failed — see details
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
