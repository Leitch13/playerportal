import type { ActionTrial, AttendanceConcern, ConversionSummary } from '@/lib/enrolments-revops'

// Enrolments Revenue Ops — Phase 1A "Daily Actions" band. Server presentational,
// read-only. Sits above the existing chip row / sections and answers
// "Who needs attention today?" in one glance: trials ending soon + attendance
// concerns (one row PER PLAYER), with a small trial-conversion pulse. No buttons
// (Phase 2 owns actions). Dark theme to match the existing Enrolments page.
//
// Oct 2026 — the calm page. The band is titled "This week", uses one neutral
// surface, and only speaks when there is something to say: it renders nothing
// when there are no trials to act on and nobody has drifted. Red "High" badges
// are gone; a row just says how long since the child was last in.

const CAP = 5 // max rows per list; the rest collapse into a "view all" link

function daysLeftLabel(d: number | null): string {
  if (d == null) return '—'
  if (d < 0) return `${-d} day${-d === 1 ? '' : 's'} overdue`
  if (d === 0) return 'ends today'
  if (d === 1) return 'ends tomorrow'
  return `${d} days left`
}

function lastSeenLabel(d: number | null): string {
  if (d == null) return 'never attended'
  if (d <= 0) return 'seen today'
  if (d === 1) return 'seen yesterday'
  return `${d} days since attended`
}

export default function EnrolmentsActionBand({
  trialsEndingSoon,
  attendanceConcerns,
  conversion,
}: {
  trialsEndingSoon: ActionTrial[]
  attendanceConcerns: AttendanceConcern[]
  conversion: ConversionSummary | null
}) {
  const hasTrials = trialsEndingSoon.length > 0
  const hasConcerns = attendanceConcerns.length > 0
  const nothingUrgent = !hasTrials && !hasConcerns
  // Two columns only when BOTH lists have content — otherwise the single list
  // goes full-width so there's no dead half.
  const twoCol = hasTrials && hasConcerns

  const shownTrials = trialsEndingSoon.slice(0, CAP)
  const moreTrials = trialsEndingSoon.length - shownTrials.length
  const shownConcerns = attendanceConcerns.slice(0, CAP)
  const moreConcerns = attendanceConcerns.length - shownConcerns.length

  // The trial numbers are only worth a row when there is a trial in play.
  const showPulse = !!conversion && (conversion.active > 0 || conversion.endingThisWeek > 0 || conversion.followUpDue > 0)
  if (nothingUrgent && !showPulse) return null

  return (
    <section aria-label="This week" className="rounded-[15px] border border-[#1d2c42] bg-[#0f1a2b] p-4 sm:p-5 space-y-4">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.07em] text-[#5b6c86]">This week</h2>

      {/* ── Trial numbers (only when a trial is in play) ── */}
      {showPulse && conversion && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <PulseChip label="On trial now" value={String(conversion.active)} />
          <PulseChip label="Trials ending this week" value={String(conversion.endingThisWeek)} warn={conversion.endingThisWeek > 0} />
          <PulseChip label="Trial follow-up due" value={String(conversion.followUpDue)} warn={conversion.followUpDue > 0} />
          <PulseChip
            label="Trials that joined"
            value={conversion.grossPct != null ? `${conversion.grossPct}%` : '—'}
            hint={conversion.grossPct != null ? `of ${conversion.grossSampleN} trials` : undefined}
          />
        </div>
      )}

      {!nothingUrgent && (
        <div className={twoCol ? 'grid gap-4 lg:grid-cols-2' : 'space-y-4'}>
          {/* ── Trials ending soon ── */}
          {hasTrials && (
            <div className="space-y-2">
              <SectionHead title="Trials ending soon" count={trialsEndingSoon.length} />
              <ul className="rounded-[12px] border border-[#1d2c42] divide-y divide-[#1d2c42] overflow-hidden">
                {shownTrials.map((t) => {
                  const urgent = (t.daysLeft ?? 99) <= 1
                  return (
                    <li key={t.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{t.playerName}</p>
                        <p className="text-xs text-[#93a2ba] truncate">{t.className}</p>
                      </div>
                      <span className={`shrink-0 text-xs font-semibold tabular-nums ${urgent ? 'text-[#d8a95a]' : 'text-[#93a2ba]'}`}>
                        {daysLeftLabel(t.daysLeft)}
                      </span>
                    </li>
                  )
                })}
              </ul>
              {moreTrials > 0 && (
                <a href="/dashboard/trials" className="block text-xs text-[#5b6c86] hover:text-white transition-colors px-1">
                  +{moreTrials} more · View all trials
                </a>
              )}
            </div>
          )}

          {/* ── Not been in a while (one row per player) ── */}
          {hasConcerns && (
            <div className="space-y-2">
              <SectionHead title="Not been in a while" count={attendanceConcerns.length} />
              <ul className="rounded-[12px] border border-[#1d2c42] divide-y divide-[#1d2c42] overflow-hidden">
                {shownConcerns.map((c) => {
                  const where = c.classCount > 1 ? `${c.classCount} classes` : c.className
                  return (
                    <li key={c.playerId} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{c.playerName}</p>
                        <p className="text-xs text-[#93a2ba] truncate">{where}</p>
                      </div>
                      <span className="shrink-0 text-xs tabular-nums text-[#93a2ba]">{lastSeenLabel(c.daysSinceAttendance)}</span>
                    </li>
                  )
                })}
              </ul>
              {moreConcerns > 0 && (
                <a href="/dashboard/attendance/insights" className="block text-xs text-[#5b6c86] hover:text-white transition-colors px-1">
                  +{moreConcerns} more · View all in Attendance
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function SectionHead({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-baseline gap-2">
      <h3 className="text-[13px] font-semibold text-white">{title}</h3>
      <span className="text-xs tabular-nums text-[#5b6c86]">{count}</span>
    </div>
  )
}

function PulseChip({ label, value, warn, hint }: { label: string; value: string; warn?: boolean; hint?: string }) {
  return (
    <div className="rounded-[12px] border border-[#1d2c42] bg-[#080e18] p-3">
      <div className={`text-xl font-bold leading-none tabular-nums ${warn ? 'text-[#d8a95a]' : 'text-white'}`}>{value}</div>
      <div className="mt-1.5 text-xs text-[#93a2ba]">{label}</div>
      {hint && <div className="mt-0.5 text-[11px] text-[#5b6c86]">{hint}</div>}
    </div>
  )
}
