'use client'

import { useState } from 'react'

export default function SendReminderButton({ paymentId }: { paymentId: string }) {
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)

  async function handleSend() {
    setSending(true)
    try {
      await fetch('/api/email/payment-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId }),
      })
      setSent(true)
    } catch {
      // fire and forget
      setSent(true)
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <span className="text-xs text-green-400 font-medium whitespace-nowrap">
        Reminder sent
      </span>
    )
  }

  return (
    <button
      onClick={handleSend}
      disabled={sending}
      className="text-xs font-medium text-orange-400 hover:text-orange-300 whitespace-nowrap transition-colors disabled:opacity-50"
    >
      {sending ? 'Sending...' : 'Send Reminder'}
    </button>
  )
}
