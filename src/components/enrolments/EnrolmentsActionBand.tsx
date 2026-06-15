import { ATTENDANCE_LEVEL_DISPLAY } from '@/lib/attendance-risk-derive'
import type { ActionTrial, AttendanceConcern, ConversionSummary } from '@/lib/enrolments-revops'

// Enrolments Revenue Ops — Phase 1A "Daily Actions" band. Server presentational,
// read-only. Sits above the existing chip row / sections and answers
// "Who needs attention today?" in one glance: trials ending soon + attendance
// concerns (one row PER PLAYER), with a small trial-conversion pulse. No buttons
// (Phase 2 owns actions). Dark theme to match the existing Enrolments page.

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

const LEVEL_TONE: Record<string, string> = {
  rose: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
  amber: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  emerald: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  sky: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
  muted: 'bg-white/[0.04] text-white/60 border-white/[0.08]',
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

  return (
    <section aria-label="Actions required" className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 sm:p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-white/70">Actions required</h2>
        <span className="text-[11px] text-white/40">Who needs attention today</span>
      </div>

      {/* ── Trial conversion pulse (conversion first; zeros muted) ── */}
      {conversion && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <PulseChip
            label="Conversion"
            value={conversion.grossPct != null ? `${conversion.grossPct}%` : '—'}
            tone="emerald"
            hint={conversion.grossPct != null ? `${conversion.grossSampleN} trials` : 'no data yet'}
          />
          <PulseChip label="Active trials" value={String(conversion.active)} tone={conversion.active > 0 ? 'sky' : 'muted'} />
          <PulseChip label="Ending this week" value={String(conversion.endingThisWeek)} tone={conversion.endingThisWeek > 0 ? 'amber' : 'muted'} />
          <PulseChip label="Follow-up due" value={String(conversion.followUpDue)} tone={conversion.followUpDue > 0 ? 'rose' : 'muted'} />
        </div>
      )}

      {nothingUrgent ? (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-5 text-center">
          <p className="text-sm font-semibold text-emerald-300">No urgent enrolment actions today ✅</p>
          <p className="text-xs text-white/50 mt-1">No trials ending this week and no attendance concerns.</p>
        </div>
      ) : (
        <div className={twoCol ? 'grid gap-4 lg:grid-cols-2' : 'space-y-4'}>
          {/* ── Trials ending soon ── */}
          {hasTrials && (
            <div className="space-y-2">
              <SectionHead title="Trials ending soon" tone="text-sky-300" count={trialsEndingSoon.length} />
              <ul className="rounded-xl border border-white/[0.06] divide-y divide-white/[0.05] overflow-hidden">
                {shownTrials.map((t) => {
                  const urgent = (t.daysLeft ?? 99) <= 3
                  return (
                    <li key={t.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{t.playerName}</p>
                        <p className="text-[11px] text-white/50 truncate">{t.className}</p>
                      </div>
                      <span className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-bold border ${urgent ? 'bg-rose-500/10 text-rose-300 border-rose-500/30' : 'bg-sky-500/10 text-sky-300 border-sky-500/30'}`}>
                        {daysLeftLabel(t.daysLeft)}
                      </span>
                    </li>
                  )
                })}
              </ul>
              {moreTrials > 0 && (
                <a href="/dashboard/trials" className="block text-[11px] text-white/40 hover:text-white/70 transition-colors px-1">
                  +{moreTrials} more · View all trials →
                </a>
              )}
            </div>
          )}

          {/* ── Attendance risk (one row per player) ── */}
          {hasConcerns && (
            <div className="space-y-2">
              <SectionHead title="Attendance risk" tone="text-amber-300" count={attendanceConcerns.length} />
              <ul className="rounded-xl border border-white/[0.06] divide-y divide-white/[0.05] overflow-hidden">
                {shownConcerns.map((c) => {
                  const disp = ATTENDANCE_LEVEL_DISPLAY[c.level]
                  const where = c.classCount > 1 ? `${c.classCount} classes` : c.className
                  return (
                    <li key={c.playerId} className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{c.playerName}</p>
                        <p className="text-[11px] text-white/50 truncate">{where} · {lastSeenLabel(c.daysSinceAttendance)}</p>
                      </div>
                      <span className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-bold border ${LEVEL_TONE[disp.tone]}`}>
                        {disp.emoji} {disp.label}
                      </span>
                    </li>
                  )
                })}
              </ul>
              {moreConcerns > 0 && (
                <a href="/dashboard/attendance/insights" className="block text-[11px] text-white/40 hover:text-white/70 transition-colors px-1">
                  +{moreConcerns} more · View all in Attendance →
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function SectionHead({ title, tone, count }: { title: string; tone: string; count: number }) {
  return (
    <div className="flex items-center gap-2">
      <h3 className={`text-[11px] font-bold uppercase tracking-wider ${tone}`}>{title}</h3>
      <span className="text-[10px] font-bold text-white/40 bg-white/[0.06] px-1.5 py-0.5 rounded-full">{count}</span>
    </div>
  )
}

function PulseChip({ label, value, tone, hint }: { label: string; value: string; tone: keyof typeof LEVEL_TONE; hint?: string }) {
  return (
    <div className={`rounded-xl border p-3 ${LEVEL_TONE[tone]}`}>
      <div className="text-xl font-extrabold leading-none">{value}</div>
      <div className="text-[10px] uppercase tracking-wider mt-1 opacity-80">{label}</div>
      {hint && <div className="text-[10px] text-white/40 mt-0.5">{hint}</div>}
    </div>
  )
}
