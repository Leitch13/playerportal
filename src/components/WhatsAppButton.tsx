/**
 * WhatsAppButton — small green chip-style anchor that opens wa.me with a
 * pre-filled message. Used in admin row contexts (Trial Manager rows,
 * Overdue Payment rows) where coaches want to chase a parent in one tap.
 *
 * Renders nothing when the phone number is missing — never a broken
 * dead link. Server-rendered (no client JS needed); the underlying
 * `<a target="_blank">` does the work.
 */
import { buildWhatsappUrl } from '@/lib/whatsapp'

interface Props {
  /** Recipient phone (parent_phone, profile.phone, etc). Null/empty hides the button. */
  phone: string | null | undefined
  /** Pre-filled message body. Empty → no ?text param. */
  message?: string
  /** Visible button text. Defaults to "WhatsApp". */
  label?: string
  /** Icon-only mode (used in dense table rows). Hides text, keeps an aria-label. */
  iconOnly?: boolean
  /** Hand off a className so callers can size + space us. */
  className?: string
  /** Optional testid for validation harness. Defaults to 'whatsapp-button'. */
  testId?: string
}

export default function WhatsAppButton({
  phone,
  message,
  label = 'WhatsApp',
  iconOnly = false,
  className = '',
  testId = 'whatsapp-button',
}: Props) {
  const href = buildWhatsappUrl(phone, message)
  if (!href) return null

  const base =
    'inline-flex items-center gap-1.5 rounded-md text-xs font-semibold ' +
    'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 ' +
    'transition-colors px-2.5 py-1 ' +
    'border border-emerald-500/20'

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-testid={testId}
      aria-label={label}
      title={label}
      className={`${base} ${className}`}
    >
      {/* WhatsApp glyph — tiny inline SVG, no remote font/icon load */}
      <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden>
        <path d="M20.5 3.5A11 11 0 0 0 3 17l-1 5 5.2-1.4A11 11 0 1 0 20.5 3.5Zm-8.5 17a8.9 8.9 0 0 1-4.6-1.3l-.3-.2-3 .8.8-3-.2-.3A9 9 0 1 1 12 20.5Zm5-6.8c-.3-.2-1.6-.8-1.9-.9-.3-.1-.5-.1-.7.1-.2.3-.8.9-1 1-.2.2-.4.2-.7.1a7.2 7.2 0 0 1-3.5-3 .5.5 0 0 1 .1-.7l.4-.5.2-.3a.8.8 0 0 0 0-.7l-1-2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4a3 3 0 0 0-.9 2.2 5.4 5.4 0 0 0 1 2.7 11 11 0 0 0 4 3.6c.6.2 1 .4 1.4.5.6.2 1.1.2 1.5.1.5-.1 1.4-.6 1.6-1.1.2-.6.2-1 .1-1.1 0-.1-.2-.2-.5-.4Z" />
      </svg>
      {!iconOnly && <span>{label}</span>}
    </a>
  )
}
