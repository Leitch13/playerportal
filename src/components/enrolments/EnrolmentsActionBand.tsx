import { ATTENDANCE_LEVEL_DISPLAY } from '@/lib/attendance-risk-derive'
import type { ActionTrial, AttendanceConcern, ConversionSummary } from '@/lib/enrolments-revops'

// Enrolments Revenue Ops — Phase 1A "Daily Actions" band. Server presentational,
// read-only. Sits above the existing chip row / sections and answers
// "Who needs attention today?" in one glance: trials ending soon + attendance
// concerns, with a small trial-conversion pulse. No buttons (Phase 2 owns
// actions). Dark theme to match the existing Enrolments page.

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
  const nothingUrgent = trialsEndingSoon.length === 0 && attendanceConcerns.length === 0

  return (
    <section aria-label="Actions required" className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 sm:p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-white/70">Actions required</h2>
        <span className="text-[11px] text-white/40">Who needs attention today</span>
      </div>

      {/* ── Trial conversion pulse ── */}
      {conversion && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <PulseChip label="Active trials" value={String(conversion.active)} tone="sky" />
          <PulseChip label="Ending this week" value={String(conversion.endingThisWeek)} tone={conversion.endingThisWeek > 0 ? 'amber' : 'muted'} />
          <PulseChip label="Follow-up due" value={String(conversion.followUpDue)} tone={conversion.followUpDue > 0 ? 'rose' : 'muted'} />
          <PulseChip
            label="Conversion"
            value={conversion.grossPct != null ? `${conversion.grossPct}%` : '—'}
            tone="emerald"
            hint={conversion.grossPct != null ? `${conversion.grossSampleN} trials` : 'no data yet'}
          />
        </div>
      )}

      {nothingUrgent ? (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-5 text-center">
          <p className="text-sm font-semibold text-emerald-300">No urgent enrolment actions today ✅</p>
          <p className="text-xs text-white/50 mt-1">No trials ending this week and no attendance concerns.</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* ── Trials ending soon ── */}
          <div className="space-y-2">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-sky-300">Trials ending soon</h3>
            {trialsEndingSoon.length === 0 ? (
              <p className="text-xs text-white/40 px-1">No trials ending this week.</p>
            ) : (
              <ul className="rounded-xl border border-white/[0.06] divide-y divide-white/[0.05] overflow-hidden">
                {trialsEndingSoon.map((t) => {
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
            )}
          </div>

          {/* ── Attendance risk ── */}
          <div className="space-y-2">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-amber-300">Attendance risk</h3>
            {attendanceConcerns.length === 0 ? (
              <p className="text-xs text-white/40 px-1">No attendance concerns.</p>
            ) : (
              <ul className="rounded-xl border border-white/[0.06] divide-y divide-white/[0.05] overflow-hidden">
                {attendanceConcerns.map((c) => {
                  const disp = ATTENDANCE_LEVEL_DISPLAY[c.level]
                  return (
                    <li key={c.playerId} className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{c.playerName}</p>
                        <p className="text-[11px] text-white/50 truncate">{c.className} · {lastSeenLabel(c.daysSinceAttendance)}</p>
                      </div>
                      <span className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-bold border ${LEVEL_TONE[disp.tone]}`}>
                        {disp.emoji} {disp.label}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
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
