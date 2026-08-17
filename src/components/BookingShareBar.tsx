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
        <div className="flex-1 truncate rounded-xl bg-[#142236] border border-[#1d2c42] px-3 py-2 text-xs text-[#93a2ba]">
          {bookingUrl}
        </div>
        <button
          onClick={handleCopy}
          className="shrink-0 rounded-xl bg-[#4ecde6] px-3 py-2 text-xs font-semibold text-[#04141a] transition hover:opacity-90"
        >
          {copied ? 'Copied!' : 'Copy Link'}
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl border border-[#293b58] bg-transparent px-2 py-2 text-center text-xs font-medium text-[#93a2ba] transition hover:border-[#3a4f6e] hover:text-white"
        >
          WhatsApp
        </a>
        <a
          href={fbHref}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl border border-[#293b58] bg-transparent px-2 py-2 text-center text-xs font-medium text-[#93a2ba] transition hover:border-[#3a4f6e] hover:text-white"
        >
          Facebook
        </a>
        <a
          href={mailHref}
          className="rounded-xl border border-[#293b58] bg-transparent px-2 py-2 text-center text-xs font-medium text-[#93a2ba] transition hover:border-[#3a4f6e] hover:text-white"
        >
          Email
        </a>
      </div>
    </div>
  )
}
