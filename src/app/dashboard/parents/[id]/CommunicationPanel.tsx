/**
 * Communication panel — Parent Detail page.
 *
 * Per the user's adjustment: NO message preview content. Just a count of
 * exchanged messages + a "Open conversation" link to the existing
 * /dashboard/messages thread. We never display a message body here.
 *
 * Read-only over the existing `messages` table. We do not send messages
 * from this component; the existing Messages page owns send.
 *
 * Phase 2.5 — surfaces the rolled-up LastContactSignal as a small stat
 * row at the top of the panel: Last contact age, Conversation count,
 * Most recent message date. Read-only.
 */
import Link from 'next/link'
import { formatContactAge, contactBucket, type LastContactSignal } from '@/lib/contact-derive'

export interface CommunicationProps {
  parentId: string
  parentEmail: string | null
  parentPhone: string | null
  messageCount: number
  // Phase 2.5 — null when no contact record exists in either system.
  contactSignal?: LastContactSignal | null
}

export default function CommunicationPanel({
  parentId,
  parentEmail,
  parentPhone,
  messageCount,
  contactSignal,
}: CommunicationProps) {
  const whatsappHref = parentPhone
    ? `https://wa.me/${parentPhone.replace(/[^\d]/g, '')}`
    : null

  // Phase 2.5 — render the rolled-up contact stats. Pure derivation from
  // pre-fetched signal — no client-side query.
  const sig = contactSignal ?? null
  const bucket = contactBucket(sig)
  const lastContactLabel = formatContactAge(sig)
  const lastContactCls =
    bucket === 'never'        ? 'text-rose-300'
    : bucket === 'stale_30plus' ? 'text-amber-300'
    : 'text-white'
  const mostRecentMessageDate = sig?.mostRecentMessageIso
    ? new Date(sig.mostRecentMessageIso).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
      })
    : '—'

  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-white/60">Communication</h3>

      {/* Phase 2.5 — three-stat row at the top of the panel. Read-only.
          Conversation count comes from the new conversation_participants
          system (0 in production today; will grow as MessagingHub usage
          increases). messageCount is the legacy total which the page
          already computes. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-2 text-xs pb-2 border-b border-white/[0.05]">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-white/40">Last contact</div>
          <div className={`mt-0.5 font-semibold ${lastContactCls}`}>{lastContactLabel}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-white/40">Conversations</div>
          <div className="mt-0.5 font-semibold text-white tabular-nums">{sig?.conversationCount ?? 0}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-white/40">Most recent message</div>
          <div className="mt-0.5 font-semibold text-white">{mostRecentMessageDate}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {parentEmail && (
          <a
            href={`mailto:${parentEmail}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.04] hover:bg-white/[0.08] text-white/80 border border-white/[0.08] transition-colors"
          >
            <span aria-hidden>📧</span> Email
          </a>
        )}
        {parentPhone && (
          <a
            href={`tel:${parentPhone}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.04] hover:bg-white/[0.08] text-white/80 border border-white/[0.08] transition-colors"
          >
            <span aria-hidden>📞</span> Call
          </a>
        )}
        {whatsappHref && (
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 transition-colors"
          >
            <span aria-hidden>💬</span> WhatsApp
          </a>
        )}
        <Link
          href={`/dashboard/messages?to=${parentId}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#4ecde6]/15 hover:bg-[#4ecde6]/25 text-[#4ecde6] border border-[#4ecde6]/30 transition-colors"
        >
          <span aria-hidden>✉️</span> {messageCount > 0 ? `Open conversation (${messageCount})` : 'Send message'}
        </Link>
      </div>
    </div>
  )
}
