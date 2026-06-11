'use client'

// ============================================================================
// BookingShareBar — Dashboard MVP "Academy Live" share block.
// Copy link + one-tap Share via WhatsApp / Facebook / Email.
// Pure client-side: WhatsApp/Facebook/Email are plain share URLs (no send
// happens from us); Copy uses the clipboard. No network, no DB, no Stripe.
// ============================================================================

import { useState } from 'react'

export default function BookingShareBar({
  bookingUrl,
  academyName,
}: {
  bookingUrl: string
  academyName?: string | null
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(bookingUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers / denied clipboard permission.
      const input = document.createElement('input')
      input.value = bookingUrl
      document.body.appendChild(input)
      input.select()
      try { document.execCommand('copy') } catch { /* noop */ }
      document.body.removeChild(input)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const shareText = `Book your sessions with ${academyName || 'our academy'}: ${bookingUrl}`
  const waHref = `https://wa.me/?text=${encodeURIComponent(shareText)}`
  const fbHref = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(bookingUrl)}`
  const mailHref = `mailto:?subject=${encodeURIComponent(`Book with ${academyName || 'our academy'}`)}&body=${encodeURIComponent(shareText)}`

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 truncate rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-xs text-white/70">
          {bookingUrl}
        </div>
        <button
          onClick={handleCopy}
          className="shrink-0 rounded-lg bg-[#4ecde6] px-3 py-2 text-xs font-semibold text-black transition hover:opacity-90"
        >
          {copied ? 'Copied!' : 'Copy Link'}
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-green-500/30 bg-green-500/10 px-2 py-2 text-center text-xs font-medium text-green-300 transition hover:bg-green-500/20"
        >
          WhatsApp
        </a>
        <a
          href={fbHref}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-2 py-2 text-center text-xs font-medium text-blue-300 transition hover:bg-blue-500/20"
        >
          Facebook
        </a>
        <a
          href={mailHref}
          className="rounded-lg border border-white/15 bg-white/5 px-2 py-2 text-center text-xs font-medium text-white/70 transition hover:bg-white/10"
        >
          Email
        </a>
      </div>
    </div>
  )
}
