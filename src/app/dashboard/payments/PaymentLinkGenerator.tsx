'use client'

import { useState } from 'react'

export default function PaymentLinkGenerator() {
  const [open, setOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [link, setLink] = useState('')
  const [copied, setCopied] = useState(false)

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setLink('')

    try {
      const res = await fetch('/api/stripe/payment-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, amount: parseFloat(amount) }),
      })

      const data = await res.json()

      if (data.url) {
        setLink(data.url)
      } else {
        alert(data.error || 'Failed to create link')
      }
    } catch {
      alert('Failed to create payment link')
    }
    setLoading(false)
  }

  async function copyLink() {
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-surface-dark transition-colors"
      >
        Generate Payment Link
      </button>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-border p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Generate Payment Link</h3>
        <button onClick={() => { setOpen(false); setLink('') }} className="text-text-light hover:text-text text-sm">
          Close
        </button>
      </div>
      <p className="text-xs text-text-light">
        Create a shareable link that any parent can use to pay. Accepts card or bank transfer.
      </p>

      {!link ? (
        <form onSubmit={handleGenerate} className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-medium mb-1">Description *</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Spring Term Fees"
              required
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div className="w-[120px]">
            <label className="block text-xs font-medium mb-1">Amount (&pound;) *</label>
            <input
              type="number"
              step="0.01"
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="40.00"
              required
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Creating...' : 'Generate'}
          </button>
        </form>
      ) : (
        <div className="space-y-3">
          <div className="bg-surface rounded-lg p-3">
            <p className="text-xs text-text-light mb-1">Share this link with parents:</p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={link}
                className="flex-1 px-3 py-2 border border-border rounded-lg text-sm bg-white font-mono text-xs"
              />
              <button
                onClick={copyLink}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  copied
                    ? 'bg-accent text-white'
                    : 'bg-primary text-white hover:bg-primary/90'
                }`}
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
          <button
            onClick={() => { setLink(''); setDescription(''); setAmount('') }}
            className="text-xs text-accent hover:underline"
          >
            Create another link
          </button>
        </div>
      )}
    </div>
  )
}
