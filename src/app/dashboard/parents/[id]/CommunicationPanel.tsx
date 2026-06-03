/**
 * Communication panel — Parent Detail page.
 *
 * Per the user's adjustment: NO message preview content. Just a count of
 * exchanged messages + a "Open conversation" link to the existing
 * /dashboard/messages thread. We never display a message body here.
 *
 * Read-only over the existing `messages` table. We do not send messages
 * from this component; the existing Messages page owns send.
 */
import Link from 'next/link'

export interface CommunicationProps {
  parentId: string
  parentEmail: string | null
  parentPhone: string | null
  messageCount: number
}

export default function CommunicationPanel({
  parentId,
  parentEmail,
  parentPhone,
  messageCount,
}: CommunicationProps) {
  const whatsappHref = parentPhone
    ? `https://wa.me/${parentPhone.replace(/[^\d]/g, '')}`
    : null
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-white/60">Communication</h3>

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
