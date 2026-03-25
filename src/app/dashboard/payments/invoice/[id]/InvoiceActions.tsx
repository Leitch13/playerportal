'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function InvoiceActions({ paymentId }: { paymentId: string }) {
  const [emailing, setEmailing] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [emailError, setEmailError] = useState('')

  async function handleEmailReceipt() {
    setEmailing(true)
    setEmailError('')
    try {
      const res = await fetch('/api/payments/email-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Failed to send email' }))
        throw new Error(data.error || 'Failed to send email')
      }
      setEmailSent(true)
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : 'Failed to send email')
    } finally {
      setEmailing(false)
    }
  }

  return (
    <div className="no-print flex flex-wrap items-center gap-3">
      <button
        onClick={() => window.print()}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-light transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
          />
        </svg>
        Print / Save as PDF
      </button>

      <button
        onClick={handleEmailReceipt}
        disabled={emailing || emailSent}
        className="inline-flex items-center gap-2 px-5 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-surface-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
        {emailSent ? 'Receipt Sent' : emailing ? 'Sending...' : 'Email Receipt'}
      </button>

      <Link
        href="/dashboard/payments"
        className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-text-light hover:text-text transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Payments
      </Link>

      {emailSent && (
        <span className="text-xs text-accent font-medium">Receipt emailed successfully.</span>
      )}
      {emailError && <span className="text-xs text-danger font-medium">{emailError}</span>}
    </div>
  )
}
