'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { DOC_TYPES } from '@/lib/types'

interface Player {
  id: string
  first_name: string
  last_name: string
  parent_id: string
}

export default function DocumentManager({
  players,
  userId,
  autoOpen,
  defaultPlayerId,
  orgId,
}: {
  players: Player[]
  userId: string
  autoOpen: boolean
  defaultPlayerId: string
  orgId: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(autoOpen)

  useEffect(() => {
    if (autoOpen) setOpen(true)
  }, [autoOpen])

  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [description, setDescription] = useState('')
  const [docType, setDocType] = useState('link')
  const [playerId, setPlayerId] = useState(defaultPlayerId)
  const [folder, setFolder] = useState('General')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')

  // Auto-detect doc type from URL
  function detectDocType(inputUrl: string) {
    if (inputUrl.includes('canva.com')) return 'canva'
    if (inputUrl.match(/\.pdf$/i)) return 'pdf'
    if (inputUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i)) return 'image'
    if (inputUrl.match(/\.(mp4|mov|avi|webm)$/i) || inputUrl.includes('youtube') || inputUrl.includes('vimeo')) return 'video'
    return 'link'
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const supabase = createClient()

    const { error } = await supabase.from('documents').insert({
      organisation_id: orgId,
      title,
      url,
      description: description || null,
      doc_type: docType,
      player_id: playerId || null,
      parent_id: playerId ? players.find((p) => p.id === playerId)?.parent_id || null : null,
      uploaded_by: userId,
      folder,
    })

    if (error) {
      alert(error.message)
    } else {
      setSuccess('Document added!')
      setTitle('')
      setUrl('')
      setDescription('')
      setDocType('link')
      setPlayerId(defaultPlayerId)
      setFolder('General')
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
        + Add Document
      </button>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Add Document / Link</h2>
        <button onClick={() => setOpen(false)} className="text-text-light hover:text-text text-sm">Close</button>
      </div>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Player Notes - March"
            required
            className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">URL *</label>
          <input
            type="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value)
              setDocType(detectDocType(e.target.value))
            }}
            placeholder="https://canva.com/..."
            required
            className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Type</label>
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            {DOC_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <p className="text-xs text-text-light mt-0.5">Auto-detected from URL</p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Player (optional)</label>
          <select
            value={playerId}
            onChange={(e) => setPlayerId(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="">General (no player)</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Folder</label>
          <input
            type="text"
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
            placeholder="e.g. Player Notes, Reports"
            className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description..."
            className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>

        {success && <p className="text-sm text-accent font-medium md:col-span-3">{success}</p>}

        <div className="md:col-span-3 flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50 transition-colors"
          >
            {loading ? 'Adding...' : 'Add Document'}
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
