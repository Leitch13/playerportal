'use client'

import { useState } from 'react'

/**
 * Admin action — email the parent a link to pay this one-off invoice.
 *
 * Raising an invoice only writes a ledger row; nothing is sent to the parent.
 * This is the "send it" step. Purely additive: it triggers an email and an
 * audit note, and never touches amount, status or any subscription.
 */
export default function SendPayLinkButton({ paymentId }: { paymentId: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleSend() {
    if (state === 'sending' || state === 'sent') return
    setState('sending')
    try {
      const res = await fetch(`/api/payments/${paymentId}/send-link`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not send the payment link.')
      setState('sent')
      setMessage(data.to ? `Sent to ${data.to}` : 'Payment link sent')
    } catch (err) {
      setState('error')
      setMessage(err instanceof Error ? err.message : 'Could not send the payment link.')
      setTimeout(() => setState('idle'), 4000)
    }
  }

  return (
    <button
      onClick={handleSend}
      disabled={state === 'sending' || state === 'sent'}
      title={message || 'Email this payment request to the parent'}
      aria-label="Send payment link to parent"
      data-testid="send-pay-link"
      className={`transition-colors disabled:cursor-not-allowed ${
        state === 'sent'
          ? 'text-emerald-400'
          : state === 'error'
            ? 'text-red-400'
            : 'text-white/50 hover:text-[#4ecde6]'
      }`}
    >
      {state === 'sent' ? (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
      )}
    </button>
  )
}
