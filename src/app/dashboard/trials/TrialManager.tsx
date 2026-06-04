'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
// Phase 2.4 — reuse the SAME derive layer as Enrolments / Parents / Players.
// No re-implementation; trial-derive is the source of truth.
import {
  deriveTrialStageFromBooking,
  needsFollowUp,
  STAGE_LABEL,
  type TrialStage,
} from '@/lib/trial-derive'
// Phase 2.4 step 5 — DB-only admin actions for the follow-up cohort.
import TrialFollowUpActions from '@/app/dashboard/enrolments/TrialFollowUpActions'
// Sprint 6 — per-row WhatsApp deep-link.
import WhatsAppButton from '@/components/WhatsAppButton'
import { WA_TEMPLATES } from '@/lib/whatsapp'

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
  // Phase 2.4 — added so the client can derive stale_followup from the
  // same fields the loader uses on the server. null when never updated.
  updatedAt?: string | null
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

function getReminderBadge(t: Trial, stage: TrialStage): { label: string; color: string } | null {
  // Phase 2.4 — Trial-derive stages take priority for the action-cued cohorts.
  // Stale and awaiting follow-ups are the ones the academy owner needs to
  // see first; they override "Followed up" / reminder chips below.
  if (stage === 'stale_followup')    return { label: STAGE_LABEL.stale_followup,    color: 'text-rose-300 bg-rose-500/15 border border-rose-500/30' }
  if (stage === 'awaiting_followup') return { label: STAGE_LABEL.awaiting_followup, color: 'text-amber-300 bg-amber-500/15 border border-amber-500/30' }
  if (t.converted) return { label: 'Converted', color: 'text-[#4ecde6] bg-[#4ecde6]/10' }
  if (t.followupSent) return { label: 'Followed up', color: 'text-amber-400 bg-amber-500/10' }
  if (t.reminder2h) return { label: '2h sent', color: 'text-emerald-400 bg-emerald-500/10' }
  if (t.reminder24h) return { label: '24h sent', color: 'text-blue-400 bg-blue-500/10' }
  if (t.reminder48h) return { label: '48h sent', color: 'text-indigo-400 bg-indigo-500/10' }
  return null
}

// Map a Trial row (the client shape used by this component) to the input
// shape expected by `deriveTrialStageFromBooking`. Pure helper kept local
// so the derive layer stays I/O-free.
function trialToBookingInput(t: Trial) {
  return {
    id: t.id,
    status: t.status,
    preferred_date: t.preferredDate,
    followup_sent: t.followupSent,
    converted: t.converted,
    updated_at: t.updatedAt ?? null,
  }
}

export default function TrialManager({ trials, academyName = 'the academy' }: { trials: Trial[]; academyName?: string }) {
  const router = useRouter()
  const [filter, setFilter] = useState<string>('all')
  const [loading, setLoading] = useState<string | null>(null)

  // Phase 2.4 — derive each trial's stage ONCE for the whole component. The
  // `followup` tab filters by needsFollowUp(stage); the funnel column reads
  // the same map so the chip + tab agree.
  const stageById = new Map<string, TrialStage>()
  for (const t of trials) {
    stageById.set(t.id, deriveTrialStageFromBooking(trialToBookingInput(t)))
  }

  // Filter rules:
  //   filter='followup'  → trials where stage is awaiting_followup OR stale_followup
  //   filter='<status>'  → existing literal-status match (pending, confirmed, attended)
  //   filter='all'       → no filter
  const filtered = filter === 'all'
    ? trials
    : filter === 'followup'
      ? trials.filter(t => needsFollowUp(stageById.get(t.id) ?? 'upcoming'))
      : trials.filter(t => t.status === filter)

  const followupCount = trials.filter(t => needsFollowUp(stageById.get(t.id) ?? 'upcoming')).length

  async function updateStatus(id: string, status: string) {
    setLoading(id)
    try {
      // P1 Trial Funnel Reliability — server-side endpoint with proper
      // org auth + service-role write. The previous client-side anon
      // .update() call was silently no-op'd by RLS (HTTP 204, no error
      // surfaced), making the button appear dead.
      const res = await fetch(`/api/admin/trials/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const json = await res.json().catch(() => ({ ok: false }))
      if (!res.ok || !json.ok) {
        const msg = (json && json.error) || `Could not update trial (HTTP ${res.status})`
        // Surface the failure instead of silently no-op'ing.
        if (typeof window !== 'undefined') {
          window.alert(msg)
        }
        setLoading(null)
        return
      }
      router.refresh()
    } finally {
      setLoading(null)
    }
  }

  const tabs = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'confirmed', label: 'Confirmed' },
    { key: 'attended', label: 'Attended' },
    // Phase 2.4 — needs-follow-up cohort. Surfaced inline so the academy
    // owner can switch to it without leaving the page. Read-only — uses
    // the existing per-row "Cancel"/"Attended"/"No Show" actions only.
    { key: 'followup', label: `Follow-up due${followupCount > 0 ? ` (${followupCount})` : ''}` },
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
                  const stage = stageById.get(t.id) ?? 'upcoming'
                  const badge = getReminderBadge(t, stage)
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
                        <div className="flex items-center gap-1 justify-end flex-wrap">
                          {/* Sprint 6 — WhatsApp deep-link. Chooses the right
                              pre-filled template based on funnel stage: a chase
                              for pending/confirmed trials, a follow-up nudge
                              for already-attended trials. */}
                          <WhatsAppButton
                            phone={t.parentPhone}
                            message={
                              t.status === 'attended'
                                ? WA_TEMPLATES.trialFollowUp({
                                    parentName: t.parentName,
                                    academyName,
                                    childName: t.childName,
                                  })
                                : WA_TEMPLATES.trialChase({
                                    parentName: t.parentName,
                                    academyName,
                                    childName: t.childName,
                                  })
                            }
                            iconOnly
                            testId="trial-row-whatsapp"
                          />
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
                          {/* Phase 2.4 step 5 — Convert / Extend / Mark lost.
                              Only shown for the needsFollowUp() cohort so the
                              existing pending/confirmed action cluster stays
                              uncluttered for those rows. */}
                          {needsFollowUp(stage) && (
                            <TrialFollowUpActions
                              source="booking"
                              id={t.id}
                              signupHref="/dashboard/groups"
                              layout="inline"
                            />
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
