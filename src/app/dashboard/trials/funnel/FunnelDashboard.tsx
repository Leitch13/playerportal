'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Trial {
  id: string
  parentName: string
  parentEmail: string
  childName: string
  status: string
  preferredDate: string | null
  createdAt: string
  reminder48h: boolean
  reminder24h: boolean
  reminder2h: boolean
  followupSent: boolean
  conversionOfferSent: boolean
  converted: boolean
  discountCode: string | null
}

type TimeFilter = 'week' | 'month' | 'all'

const STAGES = [
  { key: 'booked', label: 'Booked', color: '#6366f1', desc: 'Trial booked' },
  { key: 'reminded', label: 'Reminded', color: '#3b82f6', desc: 'At least 1 reminder sent' },
  { key: 'attended', label: 'Attended', color: '#10b981', desc: 'Attended the session' },
  { key: 'followedup', label: 'Followed Up', color: '#f59e0b', desc: 'Received conversion email' },
  { key: 'converted', label: 'Converted', color: '#4ecde6', desc: 'Signed up for regular classes' },
] as const

export default function FunnelDashboard({ trials }: { trials: Trial[] }) {
  const router = useRouter()
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all')
  const [nudging, setNudging] = useState<string | null>(null)
  const [expandedStage, setExpandedStage] = useState<string | null>(null)

  const filtered = trials.filter((t) => {
    if (timeFilter === 'all') return true
    const created = new Date(t.createdAt)
    const now = new Date()
    if (timeFilter === 'week') {
      const weekAgo = new Date(now)
      weekAgo.setDate(weekAgo.getDate() - 7)
      return created >= weekAgo
    }
    if (timeFilter === 'month') {
      const monthAgo = new Date(now)
      monthAgo.setMonth(monthAgo.getMonth() - 1)
      return created >= monthAgo
    }
    return true
  })

  // Categorize trials into funnel stages
  const booked = filtered.length
  const reminded = filtered.filter(t => t.reminder48h || t.reminder24h || t.reminder2h).length
  const attended = filtered.filter(t => t.status === 'attended').length
  const followedup = filtered.filter(t => t.followupSent).length
  const converted = filtered.filter(t => t.converted).length

  const counts: Record<string, number> = { booked, reminded, attended, followedup, converted }

  function getTrialsInStage(stageKey: string): Trial[] {
    switch (stageKey) {
      case 'booked': return filtered
      case 'reminded': return filtered.filter(t => t.reminder48h || t.reminder24h || t.reminder2h)
      case 'attended': return filtered.filter(t => t.status === 'attended')
      case 'followedup': return filtered.filter(t => t.followupSent)
      case 'converted': return filtered.filter(t => t.converted)
      default: return []
    }
  }

  function getReminderStage(t: Trial): string {
    if (t.converted) return 'Converted'
    if (t.conversionOfferSent) return 'Offer sent'
    if (t.followupSent) return 'Followed up'
    if (t.status === 'attended') return 'Attended'
    if (t.reminder2h) return '2h reminder sent'
    if (t.reminder24h) return '24h reminder sent'
    if (t.reminder48h) return '48h reminder sent'
    if (t.status === 'confirmed') return 'Confirmed'
    return 'Booked'
  }

  async function nudgeTrial(trialId: string) {
    setNudging(trialId)
    try {
      const supabase = createClient()
      const trial = filtered.find(t => t.id === trialId)
      if (!trial) return

      // Determine next action based on current state
      if (trial.status === 'attended' && !trial.followupSent) {
        // Trigger conversion email via the API
        await fetch('/api/trials/nudge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trialId, action: 'conversion' }),
        })
      } else if (!trial.reminder48h) {
        await supabase.from('trial_bookings').update({ reminder_48h_sent: false }).eq('id', trialId)
        await fetch('/api/trials/nudge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trialId, action: 'reminder' }),
        })
      }
      router.refresh()
    } finally {
      setNudging(null)
    }
  }

  const maxCount = booked || 1

  return (
    <div className="space-y-6">
      {/* Time filter */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-[#141414] rounded-lg p-1 border border-[#1e1e1e]">
          {([
            { key: 'week', label: 'This Week' },
            { key: 'month', label: 'This Month' },
            { key: 'all', label: 'All Time' },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setTimeFilter(tab.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                timeFilter === tab.key
                  ? 'bg-[#1e1e1e] text-white shadow-sm'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <p className="text-white/40 text-xs">{filtered.length} trials</p>
      </div>

      {/* Funnel visualization */}
      <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] p-6">
        <h2 className="text-lg font-bold text-white mb-6">Conversion Funnel</h2>
        <div className="space-y-3">
          {STAGES.map((stage, i) => {
            const count = counts[stage.key]
            const pct = booked > 0 ? Math.round((count / booked) * 100) : 0
            const barWidth = Math.max((count / maxCount) * 100, 4)
            const prevCount = i > 0 ? counts[STAGES[i - 1].key] : count
            const dropoff = prevCount > 0 ? Math.round(((prevCount - count) / prevCount) * 100) : 0

            return (
              <button
                key={stage.key}
                onClick={() => setExpandedStage(expandedStage === stage.key ? null : stage.key)}
                className="w-full text-left group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-28 shrink-0">
                    <p className="text-sm font-semibold text-white">{stage.label}</p>
                    <p className="text-xs text-white/40">{stage.desc}</p>
                  </div>
                  <div className="flex-1 relative">
                    <div className="h-10 bg-[#1a1a1a] rounded-xl overflow-hidden">
                      <div
                        className="h-full rounded-xl transition-all duration-500 flex items-center px-3"
                        style={{ width: `${barWidth}%`, backgroundColor: stage.color }}
                      >
                        <span className="text-sm font-bold text-white drop-shadow-sm whitespace-nowrap">
                          {count}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="w-16 text-right shrink-0">
                    <p className="text-sm font-bold text-white">{pct}%</p>
                    {i > 0 && dropoff > 0 && (
                      <p className="text-[10px] text-red-400">-{dropoff}%</p>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Conversion rate summary */}
        <div className="mt-6 pt-4 border-t border-[#1e1e1e] flex items-center gap-6">
          <div>
            <p className="text-xs text-white/40">Overall conversion</p>
            <p className="text-2xl font-bold text-[#4ecde6]">
              {booked > 0 ? Math.round((converted / booked) * 100) : 0}%
            </p>
          </div>
          <div>
            <p className="text-xs text-white/40">Attended-to-converted</p>
            <p className="text-2xl font-bold text-emerald-500">
              {attended > 0 ? Math.round((converted / attended) * 100) : 0}%
            </p>
          </div>
          <div>
            <p className="text-xs text-white/40">No-show rate</p>
            <p className="text-2xl font-bold text-red-400">
              {booked > 0
                ? Math.round(
                    (filtered.filter(t => t.status === 'no_show').length / booked) * 100
                  )
                : 0}%
            </p>
          </div>
        </div>
      </div>

      {/* Expanded stage list */}
      {expandedStage && (
        <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1e1e1e] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">
              {STAGES.find(s => s.key === expandedStage)?.label} — {getTrialsInStage(expandedStage).length} trials
            </h3>
            <button onClick={() => setExpandedStage(null)} className="text-xs text-white/40 hover:text-white">
              Close
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1e1e1e]">
                  <th className="text-left px-4 py-2 font-medium text-white/50 text-xs">Child</th>
                  <th className="text-left px-4 py-2 font-medium text-white/50 text-xs">Parent</th>
                  <th className="text-left px-4 py-2 font-medium text-white/50 text-xs hidden md:table-cell">Date</th>
                  <th className="text-left px-4 py-2 font-medium text-white/50 text-xs">Stage</th>
                  <th className="text-right px-4 py-2 font-medium text-white/50 text-xs">Action</th>
                </tr>
              </thead>
              <tbody>
                {getTrialsInStage(expandedStage).map(t => (
                  <tr key={t.id} className="border-b border-[#1e1e1e]/50 hover:bg-white/[0.02]">
                    <td className="px-4 py-2.5 text-white font-medium">{t.childName}</td>
                    <td className="px-4 py-2.5">
                      <p className="text-white/80">{t.parentName}</p>
                      <p className="text-[11px] text-white/40">{t.parentEmail}</p>
                    </td>
                    <td className="px-4 py-2.5 text-white/60 hidden md:table-cell">
                      {t.preferredDate
                        ? new Date(t.preferredDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                        : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-white/5 text-white/70">
                        {getReminderStage(t)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {(t.status === 'attended' && !t.followupSent) ||
                      (t.status === 'confirmed' && !t.reminder48h) ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); nudgeTrial(t.id) }}
                          disabled={nudging === t.id}
                          className="px-2.5 py-1 rounded-md text-xs font-semibold bg-[#4ecde6]/10 text-[#4ecde6] hover:bg-[#4ecde6]/20 transition-colors disabled:opacity-50"
                        >
                          {nudging === t.id ? 'Sending...' : 'Nudge'}
                        </button>
                      ) : (
                        <span className="text-xs text-white/30">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
