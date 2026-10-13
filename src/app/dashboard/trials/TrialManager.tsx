'use client'

import { paidTrialPence } from '@/lib/trial-booking'
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
import TrialJoinActions from './TrialJoinActions'
import { trialJoinPath } from '@/lib/trial-join'
// Sprint 6 — per-row WhatsApp deep-link.
import WhatsAppButton from '@/components/WhatsAppButton'
import { WA_TEMPLATES } from '@/lib/whatsapp'

interface Trial {
  id: string
  parentName: string
  parentEmail: string
  parentPhone: string | null
  /** When the academy last emailed this family their joining link (audit_log). */
  joinLinkSentAt?: string | null
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
  if (t.converted) return { label: 'Joined', color: 'text-[#4ecde6] bg-[#4ecde6]/10' }
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

export default function TrialManager({
  trials,
  academyName = 'the academy',
  academySlug = '',
}: {
  trials: Trial[]
  academyName?: string
  academySlug?: string
}) {
  const router = useRouter()
  const [filter, setFilter] = useState<string>('all')
  // Trial Conversion 1A — Phase 4: track which row just had its signup link
  // copied so we can show a transient "Copied!" pill on that row only.
  const [copiedTrialId, setCopiedTrialId] = useState<string | null>(null)
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''

  async function copySignupLink(trial: Trial) {
    if (!academySlug) return
    const personalisedUrl = `${baseUrl}${trialJoinPath(academySlug, trial.id)}`
    try {
      await navigator.clipboard.writeText(personalisedUrl)
      setCopiedTrialId(trial.id)
      setTimeout(() => setCopiedTrialId(null), 2000)
    } catch {
      // Last-ditch fallback for clipboard-blocked contexts: open a prompt
      window.prompt('Copy this joining link:', personalisedUrl)
    }
  }
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
      // P1.3 — fire trial-confirmed email to the parent.  Fire-and-forget;
      // flag-gated server-side by TRIAL_CONFIRMED_EMAIL_ENABLED.  Server
      // also guards idempotency (60s window on confirmed_at — set by the
      // /api/admin/trials/[id]/status route above) so a double-click or
      // browser retry doesn't double-send.  The status POST above is the
      // source of truth — if this fetch fails, the trial is still
      // confirmed in the DB.
      if (status === 'confirmed') {
        fetch('/api/email/trial-confirmed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trialId: id }),
        }).catch(() => {})
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

  // The buttons for one trial. Shared by the table (wide screens) and the cards (phones),
  // so a phone gets every action the table has.
  // Phone-card button looks: one cyan primary per card, bordered secondaries. The table keeps its small chips.
  const CARD_PRIMARY = 'order-first w-full rounded-xl bg-[#4ecde6] px-4 py-3 text-sm font-bold text-[#06121c] transition-opacity hover:opacity-90 disabled:opacity-50'
  const CARD_SECOND = 'flex-1 whitespace-nowrap rounded-xl border border-[#243652] bg-white/[0.02] px-3 py-2.5 text-sm font-semibold text-white/80 transition-colors hover:border-white/30 hover:text-white disabled:opacity-50'
  const rowActions = (t: Trial, card = false) => {
    const stage = stageById.get(t.id) ?? 'upcoming'
    return (
      <>
                          {/* Sprint 6 — WhatsApp deep-link. Chooses the right
                              pre-filled template based on funnel stage: a chase
                              for pending/confirmed trials, a follow-up nudge
                              for already-attended trials. */}
                          {!card && <WhatsAppButton
                            phone={t.parentPhone}
                            message={
                              t.status === 'attended'
                                ? WA_TEMPLATES.trialFollowUp({
                                    parentName: t.parentName,
                                    academyName,
                                    childName: t.childName,
                                  }) + (academySlug ? ` You can join here: ${baseUrl}${trialJoinPath(academySlug, t.id)}` : '')
                                : WA_TEMPLATES.trialChase({
                                    parentName: t.parentName,
                                    academyName,
                                    childName: t.childName,
                                  })
                            }
                            iconOnly
                            testId="trial-row-whatsapp"
                          />}
                          {/* Trial Conversion 1A — Phase 4: per-row copyable
                              personalised signup link. Includes ?trial=<id> +
                              ?email=<encoded> so the booking page can write
                              an attribution row for webhook primary-match. */}
                          {/* On a card the joining link is only offered once the trial has happened. */}
                          {academySlug && !t.converted && (!card || t.status === 'attended') && (
                            <button
                              onClick={() => copySignupLink(t)}
                              className={card ? CARD_SECOND : "px-2.5 py-1 rounded-md text-xs font-semibold bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 transition-colors"}
                              title="Copy this family's joining link, to send by text"
                            >
                              {copiedTrialId === t.id ? 'Copied' : card ? 'Copy joining link' : 'Copy link'}
                            </button>
                          )}
                          {t.status === 'pending' && (
                            <button
                              data-testid="trial-confirm"
                              onClick={() => updateStatus(t.id, 'confirmed')}
                              disabled={loading === t.id}
                              className={card ? CARD_PRIMARY : "px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors disabled:opacity-50"}
                            >
                              {card ? 'Confirm trial' : 'Confirm'}
                            </button>
                          )}
                          {t.status === 'confirmed' && (
                            <>
                              <button
                                onClick={() => updateStatus(t.id, 'attended')}
                                disabled={loading === t.id}
                                className={card ? CARD_PRIMARY : "px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"}
                              >
                                {card ? 'They came' : 'Attended'}
                              </button>
                              <button
                                onClick={() => updateStatus(t.id, 'no_show')}
                                disabled={loading === t.id}
                                className={card ? CARD_SECOND : "px-2.5 py-1 rounded-md text-xs font-semibold bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"}
                              >
                                {card ? 'Did not come' : 'No Show'}
                              </button>
                            </>
                          )}
                          {['pending', 'confirmed'].includes(t.status) && (
                            <button
                              onClick={() => updateStatus(t.id, 'cancelled')}
                              disabled={loading === t.id}
                              className={card ? CARD_SECOND : "px-2.5 py-1 rounded-md text-xs font-semibold text-white/30 hover:text-red-400 transition-colors disabled:opacity-50"}
                            >
                              {card ? 'Cancel trial' : 'Cancel'}
                            </button>
                          )}
                          {/* Phase 2.4 step 5 — Convert / Extend / Mark lost.
                              Only shown for the needsFollowUp() cohort so the
                              existing pending/confirmed action cluster stays
                              uncluttered for those rows. */}
                          {/* Every trial that has happened and has not joined keeps these, whatever
                              follow-up emails have gone out. (They used to vanish for a week once
                              the automatic follow-up was sent.) */}
                          {t.status === 'attended' && !t.converted && (
                            <TrialJoinActions card={card} id={t.id} childName={t.childName} hasEmail={!!t.parentEmail} sentAt={t.joinLinkSentAt ?? null} />
                          )}
      </>
    )
  }

  return (
    <div>
      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 bg-[#0f1a2b] rounded-full p-1 w-fit max-w-full overflow-x-auto border border-[#1d2c42] [scrollbar-width:none]" data-testid="trial-tabs">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`shrink-0 whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
              filter === tab.key ? 'bg-[#4ecde6] text-[#06121c] shadow-sm' : 'text-white/40 hover:text-white/70'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-[#0f1a2b] rounded-2xl border border-[#1d2c42] p-12 text-center">
          <p className="text-white/40">No trial bookings {filter !== 'all' ? `with status "${filter}"` : 'yet'}</p>
        </div>
      ) : (
        <>
        {/* Phones: one card per trial. The table hid the class and the date below 768px and
            pushed its buttons off the right-hand edge, so on a phone a trial was a name and
            a status with nothing to press (reported Oct 2026). */}
        <ul className="space-y-4 md:hidden" data-testid="trial-cards">
          {filtered.map((t) => {
            const cfg = STATUS_CONFIG[t.status] || STATUS_CONFIG.pending
            const stage = stageById.get(t.id) ?? 'upcoming'
            const badge = getReminderBadge(t, stage)
            const paid = paidTrialPence(t.notes)
            const when = t.preferredDate
              ? new Date(t.preferredDate.slice(0, 10) + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
              : 'Any date'
            const initials = t.childName.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('')
            const live = !t.converted && ['pending', 'confirmed', 'attended'].includes(t.status)
            // One line that tells the academy what to do next with this trial.
            const next = t.converted ? null
              : t.status === 'pending' ? 'New booking. Confirm it so the parent knows to come.'
              : t.status === 'confirmed' ? 'After the session, say whether they came.'
              : t.status === 'attended' ? (t.joinLinkSentAt ? 'Joining link sent. Waiting for them to pay.' : 'They came. Invite them to join.')
              : null
            return (
              <li key={t.id} className="relative overflow-hidden rounded-3xl border border-[#243652] bg-gradient-to-b from-[#132238] to-[#0d1726] p-5 shadow-[0_18px_40px_-24px_rgba(0,0,0,0.9)]" data-testid="trial-card">
                <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-44 w-44 rounded-full bg-[#4ecde6]/10 blur-3xl" />
                <div className="relative flex items-center gap-3.5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#0b1524] text-sm font-bold text-[#4ecde6] ring-2 ring-[#4ecde6]/40">{initials || '?'}</div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 break-words text-[17px] font-bold leading-tight text-white">{t.childName}</p>
                    <p className="mt-0.5 text-[13px] text-white/50">{t.childAge ? `Age ${t.childAge}` : 'Age not given'}</p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-semibold text-white/85">
                    <span className={`h-1.5 w-1.5 rounded-full ${t.converted ? 'bg-[#4ecde6]' : live ? 'bg-[#4ecde6]' : 'bg-white/30'}`} />{t.converted ? 'Joined' : cfg.label}
                  </span>
                </div>

                <div className="relative mt-4 grid grid-cols-2 divide-x divide-white/[0.07] rounded-2xl border border-white/[0.07] bg-[#0b1524]/70">
                  <div className="min-w-0 px-3.5 py-3"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">Class</p><p className="mt-1 truncate text-sm font-semibold text-white">{t.groupName || 'Any class'}</p></div>
                  <div className="min-w-0 px-3.5 py-3"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">Trial date</p><p className="mt-1 truncate text-sm font-semibold text-white">{when}</p></div>
                </div>

                <div className="relative mt-3 flex items-center gap-3">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-white/35" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.8-3.6 3.5-5.5 7-5.5s6.2 1.9 7 5.5" /></svg>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white/90">{t.parentName}</p>
                    {t.parentPhone && <p className="text-xs text-white/45">{t.parentPhone}</p>}
                  </div>
                  {t.parentPhone && (
                    <a href={`tel:${t.parentPhone.replace(/\s+/g, '')}`} aria-label={`Call ${t.parentName}`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#243652] text-[#4ecde6] transition-colors hover:border-[#4ecde6]/60" data-testid="trial-call">
                      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6.5 3.5h3l1.5 4-2 1.5a11 11 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2Z" /></svg>
                    </a>
                  )}
                  <WhatsAppButton
                    phone={t.parentPhone}
                    message={(t.status === 'attended' ? WA_TEMPLATES.trialFollowUp : WA_TEMPLATES.trialChase)({ parentName: t.parentName, academyName, childName: t.childName }) + (t.status === 'attended' && academySlug ? ` You can join here: ${baseUrl}${trialJoinPath(academySlug, t.id)}` : '')}
                    iconOnly
                    testId="trial-card-whatsapp"
                    className="!h-10 !w-10 shrink-0 !justify-center !rounded-full !border-[#243652] !bg-transparent !p-0 !text-[#4ecde6] hover:!border-[#4ecde6]/60 [&_svg]:!h-[18px] [&_svg]:!w-[18px]"
                  />
                </div>

                {(paid != null || (badge && !t.converted)) && (
                  <div className="relative mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/55">
                    {paid != null && <span data-testid="trial-paid"><span className="font-semibold text-white/85">Paid £{(paid / 100).toFixed(2)}</span> online</span>}
                    {badge && !t.converted && <span>{badge.label}</span>}
                  </div>
                )}

                {next && (
                  <div className="relative mt-4 rounded-2xl border border-[#4ecde6]/25 bg-[#4ecde6]/[0.06] px-3.5 py-3" data-testid="trial-next-step">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#4ecde6]">Next step</p>
                    <p className="mt-1 text-sm text-white/90">{next}</p>
                  </div>
                )}
                <div className="relative mt-4 flex flex-wrap items-center gap-2" data-testid="trial-card-actions">{rowActions(t, true)}</div>
              </li>
            )
          })}
        </ul>
        <div className="hidden bg-[#0f1a2b] rounded-2xl border border-[#1d2c42] overflow-hidden md:block" data-testid="trial-table">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1d2c42]">
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
                    <tr key={t.id} className="border-b border-[#1d2c42]/50 hover:bg-white/[0.02]">
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
                        {/* A paid trial's money never showed anywhere an academy looks, so it read as unpaid (Talent FA, Oct 2026). */}
                        {paidTrialPence(t.notes) != null && (
                          <span data-testid="trial-paid" className="ml-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300">
                            Paid £{(paidTrialPence(t.notes)! / 100).toFixed(2)}
                          </span>
                        )}
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
                        <div className="flex items-center gap-1 justify-end flex-wrap">{rowActions(t)}</div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
        </>
      )}
    </div>
  )
}
