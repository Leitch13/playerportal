'use client'

import { useState } from 'react'
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

export default function WaitlistManager({ entries, groupId }: { entries: WaitlistEntry[]; groupId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)

  async function handleOffer() {
    setLoading('offer')
    const supabase = createClient()
    await supabase.rpc('promote_waitlist', { group_id: groupId })
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

  const statusColors: Record<string, string> = {
    waiting: 'bg-yellow-500/20 text-yellow-400',
    offered: 'bg-blue-500/20 text-blue-400',
    expired: 'bg-red-500/20 text-red-400',
  }

  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/[0.08]/50">
            <th className="text-left px-6 py-2.5 font-semibold text-white/60">#</th>
            <th className="text-left px-3 py-2.5 font-semibold text-white/60">Player</th>
            <th className="text-left px-3 py-2.5 font-semibold text-white/60 hidden sm:table-cell">Parent</th>
            <th className="text-left px-3 py-2.5 font-semibold text-white/60 hidden md:table-cell">Waiting</th>
            <th className="text-left px-3 py-2.5 font-semibold text-white/60">Status</th>
            <th className="text-right px-6 py-2.5 font-semibold text-white/60">Actions</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id} className="border-b border-white/[0.08]/30 hover:bg-white/[0.03]">
              <td className="px-6 py-3 font-bold text-white/60">{e.position}</td>
              <td className="px-3 py-3 font-medium">{e.playerName}</td>
              <td className="px-3 py-3 hidden sm:table-cell">
                <p className="font-medium">{e.parentName}</p>
                <p className="text-xs text-white/60">{e.parentEmail}</p>
              </td>
              <td className="px-3 py-3 text-white/60 hidden md:table-cell">{timeAgo(e.created_at)}</td>
              <td className="px-3 py-3">
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${statusColors[e.status] || ''}`}>
                  {e.status}
                </span>
                {e.status === 'offered' && e.expires_at && (
                  <p className="text-[10px] text-white/60 mt-0.5">
                    Expires {new Date(e.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </td>
              <td className="px-6 py-3 text-right">
                <button
                  onClick={() => handleRemove(e.id)}
                  disabled={loading === e.id}
                  className="text-xs text-red-400 hover:text-red-600 font-medium transition-colors disabled:opacity-50"
                >
                  {loading === e.id ? '...' : 'Remove'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-6 py-4 border-t border-white/[0.08]/50">
        <button
          onClick={handleOffer}
          disabled={loading === 'offer' || entries.filter((e) => e.status === 'waiting').length === 0}
          className="px-4 py-2 rounded-lg text-sm font-semibold bg-accent text-white hover:opacity-90 disabled:opacity-40 transition-all"
        >
          {loading === 'offer' ? 'Offering...' : 'Offer Spot to Next in Line'}
        </button>
      </div>
    </div>
  )
}
