'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Trial {
  id: string
  parentName: string
  parentEmail: string
  parentPhone: string | null
  childName: string
  childAge: number | null
  groupName: string | null
  preferredDate: string | null
  notes: string | null
  status: string
  createdAt: string
  reminder48h: boolean
  reminder24h: boolean
  reminder2h: boolean
  followupSent: boolean
  converted: boolean
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  confirmed: { label: 'Confirmed', color: 'text-blue-400', bg: 'bg-blue-500/10' },
  attended: { label: 'Attended', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  no_show: { label: 'No Show', color: 'text-red-400', bg: 'bg-red-500/10' },
  cancelled: { label: 'Cancelled', color: 'text-white/40', bg: 'bg-white/5' },
}

function getReminderBadge(t: Trial): { label: string; color: string } | null {
  if (t.converted) return { label: 'Converted', color: 'text-[#4ecde6] bg-[#4ecde6]/10' }
  if (t.followupSent) return { label: 'Followed up', color: 'text-amber-400 bg-amber-500/10' }
  if (t.reminder2h) return { label: '2h sent', color: 'text-emerald-400 bg-emerald-500/10' }
  if (t.reminder24h) return { label: '24h sent', color: 'text-blue-400 bg-blue-500/10' }
  if (t.reminder48h) return { label: '48h sent', color: 'text-indigo-400 bg-indigo-500/10' }
  return null
}

export default function TrialManager({ trials }: { trials: Trial[] }) {
  const router = useRouter()
  const [filter, setFilter] = useState<string>('all')
  const [loading, setLoading] = useState<string | null>(null)

  const filtered = filter === 'all' ? trials : trials.filter(t => t.status === filter)

  async function updateStatus(id: string, status: string) {
    setLoading(id)
    const supabase = createClient()
    const update: Record<string, unknown> = { status }
    if (status === 'confirmed') update.confirmed_at = new Date().toISOString()
    await supabase.from('trial_bookings').update(update).eq('id', id)
    router.refresh()
    setLoading(null)
  }

  const tabs = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'confirmed', label: 'Confirmed' },
    { key: 'attended', label: 'Attended' },
  ]

  return (
    <div>
      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 bg-[#141414] rounded-lg p-1 w-fit border border-[#1e1e1e]">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              filter === tab.key ? 'bg-[#1e1e1e] text-white shadow-sm' : 'text-white/40 hover:text-white/70'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] p-12 text-center">
          <p className="text-white/40">No trial bookings {filter !== 'all' ? `with status "${filter}"` : 'yet'}</p>
        </div>
      ) : (
        <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1e1e1e]">
                  <th className="text-left px-4 py-3 font-semibold text-white/50 text-xs">Child</th>
                  <th className="text-left px-4 py-3 font-semibold text-white/50 text-xs">Parent</th>
                  <th className="text-left px-4 py-3 font-semibold text-white/50 text-xs hidden md:table-cell">Class</th>
                  <th className="text-left px-4 py-3 font-semibold text-white/50 text-xs hidden lg:table-cell">Date</th>
                  <th className="text-left px-4 py-3 font-semibold text-white/50 text-xs">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-white/50 text-xs hidden lg:table-cell">Funnel</th>
                  <th className="text-right px-4 py-3 font-semibold text-white/50 text-xs">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => {
                  const cfg = STATUS_CONFIG[t.status] || STATUS_CONFIG.pending
                  const badge = getReminderBadge(t)
                  return (
                    <tr key={t.id} className="border-b border-[#1e1e1e]/50 hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <p className="font-medium text-white">{t.childName}</p>
                        {t.childAge && <p className="text-xs text-white/40">Age {t.childAge}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-white/80">{t.parentName}</p>
                        <p className="text-xs text-white/40">{t.parentEmail}</p>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-white/50">
                        {t.groupName || 'Any'}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-white/50">
                        {t.preferredDate
                          ? new Date(t.preferredDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                          : 'Flexible'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.color}`}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {badge ? (
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${badge.color}`}>
                            {badge.label}
                          </span>
                        ) : (
                          <span className="text-xs text-white/20">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center gap-1 justify-end">
                          {t.status === 'pending' && (
                            <button
                              onClick={() => updateStatus(t.id, 'confirmed')}
                              disabled={loading === t.id}
                              className="px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors disabled:opacity-50"
                            >
                              Confirm
                            </button>
                          )}
                          {t.status === 'confirmed' && (
                            <>
                              <button
                                onClick={() => updateStatus(t.id, 'attended')}
                                disabled={loading === t.id}
                                className="px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                              >
                                Attended
                              </button>
                              <button
                                onClick={() => updateStatus(t.id, 'no_show')}
                                disabled={loading === t.id}
                                className="px-2.5 py-1 rounded-md text-xs font-semibold bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                              >
                                No Show
                              </button>
                            </>
                          )}
                          {['pending', 'confirmed'].includes(t.status) && (
                            <button
                              onClick={() => updateStatus(t.id, 'cancelled')}
                              disabled={loading === t.id}
                              className="px-2.5 py-1 rounded-md text-xs font-semibold text-white/30 hover:text-red-400 transition-colors disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
