'use client'

import { useState } from 'react'

export default function PayNowButton({
  paymentId,
  remaining,
}: {
  paymentId: string
  remaining: number
}) {
  const [loading, setLoading] = useState(false)

  async function handlePay() {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId }),
      })

      const text = await res.text()
      console.error('Checkout response:', res.status, text)

      let data
      try {
        data = JSON.parse(text)
      } catch {
        alert(`Server error (${res.status}): ${text.slice(0, 200)}`)
        setLoading(false)
        return
      }

      if (data.url) {
        window.location.href = data.url
      } else {
        alert(`Error: ${data.error || 'Something went wrong'} (Status: ${res.status})`)
        setLoading(false)
      }
    } catch (err) {
      alert(`Failed to start payment: ${err}`)
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handlePay}
      disabled={loading}
      className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2"
    >
      {loading ? (
        <>
          <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          Redirecting...
        </>
      ) : (
        <>Pay £{remaining.toFixed(2)}</>
      )}
    </button>
  )
}
