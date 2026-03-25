'use client'

import { useState } from 'react'

export default function ManageBillingButton() {
  const [loading, setLoading] = useState(false)

  async function handleManage() {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await res.json()

      if (data.url) {
        window.location.href = data.url
      } else {
        alert(data.error || 'Could not open billing portal')
        setLoading(false)
      }
    } catch {
      alert('Failed to open billing portal')
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleManage}
      disabled={loading}
      className="px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-surface-dark disabled:opacity-50 transition-colors flex items-center gap-2"
    >
      {loading ? (
        <>
          <span className="inline-block w-4 h-4 border-2 border-text-light/30 border-t-text-light rounded-full animate-spin" />
          Opening...
        </>
      ) : (
        <>Manage Billing</>
      )}
    </button>
  )
}
