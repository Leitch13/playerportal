'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function QuickLinkCanva({
  playerId,
  parentId,
  userId,
  orgId,
}: {
  playerId: string
  parentId: string
  userId: string
  orgId: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.from('documents').insert({
      organisation_id: orgId,
      title: title || 'Canva Player Notes',
      url,
      doc_type: 'canva',
      player_id: playerId,
      parent_id: parentId,
      uploaded_by: userId,
      folder: 'Player Notes',
    })

    if (error) {
      alert(error.message)
    } else {
      setUrl('')
      setTitle('')
      setOpen(false)
      router.refresh()
    }
    setLoading(false)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-xs font-medium hover:bg-purple-100 transition-colors"
      >
        <span>🎨</span> Link Canva Doc
      </button>
    )
  }

  return (
    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-purple-800">Link Canva Document</h4>
        <button onClick={() => setOpen(false)} className="text-purple-400 hover:text-purple-600 text-sm">&times;</button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs text-purple-700 mb-0.5">Canva URL *</label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.canva.com/design/..."
            required
            className="w-full px-3 py-1.5 text-sm border border-purple-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-300 focus:border-purple-400 bg-white"
          />
          <p className="text-xs text-purple-500 mt-0.5">
            Open your Canva doc → Share → Copy link
          </p>
        </div>
        <div>
          <label className="block text-xs text-purple-700 mb-0.5">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Player Notes - March 2026"
            className="w-full px-3 py-1.5 text-sm border border-purple-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-300 focus:border-purple-400 bg-white"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700 disabled:opacity-50"
          >
            {loading ? 'Linking...' : 'Link Document'}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="px-3 py-1.5 border border-purple-200 rounded-lg text-xs font-medium text-purple-600 hover:bg-purple-100"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
