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
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: 'text-yellow-700', bg: 'bg-yellow-50' },
  confirmed: { label: 'Confirmed', color: 'text-blue-700', bg: 'bg-blue-50' },
  attended: { label: 'Attended', color: 'text-emerald-700', bg: 'bg-emerald-50' },
  no_show: { label: 'No Show', color: 'text-red-600', bg: 'bg-red-50' },
  cancelled: { label: 'Cancelled', color: 'text-gray-500', bg: 'bg-gray-50' },
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
      <div className="flex gap-1 mb-4 bg-surface rounded-lg p-1 w-fit">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              filter === tab.key ? 'bg-white shadow-sm text-primary' : 'text-text-light hover:text-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-border p-12 text-center">
          <p className="text-text-light">No trial bookings {filter !== 'all' ? `with status "${filter}"` : 'yet'}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface/30">
                  <th className="text-left px-4 py-3 font-semibold text-text-light">Child</th>
                  <th className="text-left px-4 py-3 font-semibold text-text-light">Parent</th>
                  <th className="text-left px-4 py-3 font-semibold text-text-light hidden md:table-cell">Class</th>
                  <th className="text-left px-4 py-3 font-semibold text-text-light hidden lg:table-cell">Date</th>
                  <th className="text-left px-4 py-3 font-semibold text-text-light">Status</th>
                  <th className="text-right px-4 py-3 font-semibold text-text-light">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => {
                  const cfg = STATUS_CONFIG[t.status] || STATUS_CONFIG.pending
                  return (
                    <tr key={t.id} className="border-b border-border/30 hover:bg-surface/20">
                      <td className="px-4 py-3">
                        <p className="font-medium">{t.childName}</p>
                        {t.childAge && <p className="text-xs text-text-light">Age {t.childAge}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{t.parentName}</p>
                        <p className="text-xs text-text-light">{t.parentEmail}</p>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-text-light">
                        {t.groupName || 'Any'}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-text-light">
                        {t.preferredDate
                          ? new Date(t.preferredDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                          : 'Flexible'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.color}`}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center gap-1 justify-end">
                          {t.status === 'pending' && (
                            <button
                              onClick={() => updateStatus(t.id, 'confirmed')}
                              disabled={loading === t.id}
                              className="px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors disabled:opacity-50"
                            >
                              Confirm
                            </button>
                          )}
                          {t.status === 'confirmed' && (
                            <>
                              <button
                                onClick={() => updateStatus(t.id, 'attended')}
                                disabled={loading === t.id}
                                className="px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                              >
                                Attended
                              </button>
                              <button
                                onClick={() => updateStatus(t.id, 'no_show')}
                                disabled={loading === t.id}
                                className="px-2.5 py-1 rounded-md text-xs font-semibold bg-red-50 text-red-500 hover:bg-red-100 transition-colors disabled:opacity-50"
                              >
                                No Show
                              </button>
                            </>
                          )}
                          {['pending', 'confirmed'].includes(t.status) && (
                            <button
                              onClick={() => updateStatus(t.id, 'cancelled')}
                              disabled={loading === t.id}
                              className="px-2.5 py-1 rounded-md text-xs font-semibold text-text-light hover:text-red-500 transition-colors disabled:opacity-50"
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
