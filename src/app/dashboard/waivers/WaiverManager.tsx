'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function WaiverManager({ orgId }: { orgId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [required, setRequired] = useState(true)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const supabase = createClient()

    const { error } = await supabase.from('waivers').insert({
      organisation_id: orgId,
      title,
      content,
      required,
      active: true,
      version: 1,
    })

    if (error) {
      alert(error.message)
    } else {
      setSuccess('Waiver created!')
      setTitle('')
      setContent('')
      setRequired(true)
      router.refresh()
      setTimeout(() => setSuccess(''), 3000)
    }
    setLoading(false)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors"
      >
        + Create Waiver
      </button>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Create Waiver</h2>
        <button onClick={() => setOpen(false)} className="text-text-light hover:text-text text-sm">Close</button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Photo Consent Form"
            required
            className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Content *</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Enter the full waiver / consent text here..."
            required
            rows={8}
            className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
          />
          <p className="text-xs text-text-light mt-0.5">Supports plain text. Parents will read this before signing.</p>
        </div>
        <div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
              className="rounded border-border text-primary focus:ring-primary/20"
            />
            Required (parents must sign)
          </label>
        </div>

        {success && <p className="text-sm text-accent font-medium">{success}</p>}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50 transition-colors"
          >
            {loading ? 'Creating...' : 'Create Waiver'}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-surface-dark transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
