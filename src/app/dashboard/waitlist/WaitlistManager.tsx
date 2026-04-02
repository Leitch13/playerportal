'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface WaitlistEntry {
  id: string
  position: number
  status: string
  created_at: string
  offered_at: string | null
  expires_at: string | null
  playerName: string
  parentName: string
  parentEmail: string
}

const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  waiting: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'Waiting' },
  offered: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Offered' },
  accepted: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Accepted' },
  declined: { bg: 'bg-orange-500/20', text: 'text-orange-400', label: 'Declined' },
  expired: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Expired' },
}

function CountdownTimer({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState('')
  const [urgent, setUrgent] = useState(false)

  const calcRemaining = useCallback(() => {
    const diff = new Date(expiresAt).getTime() - Date.now()
    if (diff <= 0) {
      setRemaining('Expired')
      setUrgent(true)
      return
    }
    const hours = Math.floor(diff / 3600000)
    const mins = Math.floor((diff % 3600000) / 60000)
    const secs = Math.floor((diff % 60000) / 1000)
    setRemaining(`${hours}h ${mins}m ${secs}s`)
    setUrgent(hours < 6)
  }, [expiresAt])

  useEffect(() => {
    calcRemaining()
    const interval = setInterval(calcRemaining, 1000)
    return () => clearInterval(interval)
  }, [calcRemaining])

  return (
    <span className={`text-[11px] font-mono ${urgent ? 'text-red-400' : 'text-blue-400'}`}>
      {remaining}
    </span>
  )
}

export default function WaitlistManager({ entries, groupId }: { entries: WaitlistEntry[]; groupId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)

  async function handlePromote() {
    setLoading('promote')
    try {
      const res = await fetch('/api/waitlist/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: groupId }),
      })
      if (!res.ok) {
        const data = await res.json()
        console.error('Promote failed:', data.error)
      }
    } catch (err) {
      console.error('Promote error:', err)
    }
    router.refresh()
    setLoading(null)
  }

  async function handleRemove(id: string) {
    setLoading(id)
    const supabase = createClient()
    await supabase.from('waitlist').update({ status: 'cancelled' }).eq('id', id)
    router.refresh()
    setLoading(null)
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const days = Math.floor(diff / 86400000)
    if (days > 0) return `${days}d ago`
    const hours = Math.floor(diff / 3600000)
    if (hours > 0) return `${hours}h ago`
    return 'Just now'
  }

  const hasWaiting = entries.some((e) => e.status === 'waiting')
  const hasOffered = entries.some((e) => e.status === 'offered')

  return (
    <div>
      {/* Active offer banner */}
      {hasOffered && (
        <div className="mx-6 mt-4 mb-2 bg-blue-500/10 border border-blue-500/30 rounded-xl px-4 py-3 flex items-center gap-3">
          <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
          <p className="text-sm text-blue-300">
            A spot is currently being offered. Waiting for response.
          </p>
        </div>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/[0.08]">
            <th className="text-left px-6 py-2.5 font-semibold text-white/60">#</th>
            <th className="text-left px-3 py-2.5 font-semibold text-white/60">Player</th>
            <th className="text-left px-3 py-2.5 font-semibold text-white/60 hidden sm:table-cell">Parent</th>
            <th className="text-left px-3 py-2.5 font-semibold text-white/60 hidden md:table-cell">Waiting</th>
            <th className="text-left px-3 py-2.5 font-semibold text-white/60">Status</th>
            <th className="text-right px-6 py-2.5 font-semibold text-white/60">Actions</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => {
            const config = statusConfig[e.status] || statusConfig.waiting
            return (
              <tr key={e.id} className="border-b border-white/[0.05] hover:bg-white/[0.03]">
                <td className="px-6 py-3">
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/[0.08] text-sm font-bold text-white/70">
                    {e.position}
                  </span>
                </td>
                <td className="px-3 py-3 font-medium">{e.playerName}</td>
                <td className="px-3 py-3 hidden sm:table-cell">
                  <p className="font-medium">{e.parentName}</p>
                  <p className="text-xs text-white/60">{e.parentEmail}</p>
                </td>
                <td className="px-3 py-3 text-white/60 hidden md:table-cell">{timeAgo(e.created_at)}</td>
                <td className="px-3 py-3">
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${config.bg} ${config.text}`}>
                    {config.label}
                  </span>
                  {e.status === 'offered' && e.expires_at && (
                    <div className="mt-1">
                      <CountdownTimer expiresAt={e.expires_at} />
                    </div>
                  )}
                </td>
                <td className="px-6 py-3 text-right">
                  {e.status === 'waiting' && (
                    <button
                      onClick={() => handleRemove(e.id)}
                      disabled={loading === e.id}
                      className="text-xs text-red-400 hover:text-red-300 font-medium transition-colors disabled:opacity-50"
                    >
                      {loading === e.id ? '...' : 'Remove'}
                    </button>
                  )}
                  {e.status === 'offered' && (
                    <span className="text-xs text-blue-400 font-medium">Awaiting response</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="px-6 py-4 border-t border-white/[0.08] flex items-center gap-3">
        <button
          onClick={handlePromote}
          disabled={loading === 'promote' || !hasWaiting}
          className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#4ecde6] text-[#0a0a0a] hover:opacity-90 disabled:opacity-40 transition-all"
        >
          {loading === 'promote' ? 'Promoting...' : 'Promote Next'}
        </button>
        {!hasWaiting && (
          <span className="text-xs text-white/40">No one waiting to promote</span>
        )}
      </div>
    </div>
  )
}
