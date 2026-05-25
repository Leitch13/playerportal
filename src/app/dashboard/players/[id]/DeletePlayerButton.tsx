'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Props {
  playerId: string
  playerName: string
}

export default function DeletePlayerButton({ playerId, playerName }: Props) {
  const router = useRouter()
  const [showConfirm, setShowConfirm] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (confirmText !== playerName) return
    setDeleting(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('players')
      .delete()
      .eq('id', playerId)

    if (error) {
      alert(error.message)
      setDeleting(false)
    } else {
      router.push('/dashboard/players')
    }
  }

  if (!showConfirm) {
    return (
      <button
        onClick={() => setShowConfirm(true)}
        className="px-4 py-2 text-sm font-medium rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors"
      >
        Delete Player
      </button>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-white/70">
        Type <span className="font-bold text-red-400">{playerName}</span> to confirm deletion. This action cannot be undone.
      </p>
      <input
        type="text"
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        placeholder="Type player name to confirm"
        className="w-full px-3 py-2 text-sm rounded-lg bg-[#0a0a0a] border border-[#1e1e1e] text-white placeholder-white/40 focus:border-red-500 focus:outline-none"
      />
      <div className="flex gap-2">
        <button
          onClick={handleDelete}
          disabled={confirmText !== playerName || deleting}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-red-700 transition-colors"
        >
          {deleting ? 'Deleting...' : 'Permanently Delete'}
        </button>
        <button
          onClick={() => { setShowConfirm(false); setConfirmText('') }}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-white/10 text-white hover:bg-white/15 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
