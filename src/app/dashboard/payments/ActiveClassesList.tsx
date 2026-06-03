/**
 * §3 Active Classes — current participation only. NO upgrade products here.
 *
 * Per-class row:
 *   • class name + day + time + location + coach
 *   • assigned child
 *   • actions: View Schedule (deep link) · Cancel Class (reuses existing
 *     CancelBookingButton — same modal the Schedule page uses, props
 *     read from org retention config)
 *
 * "Change class" is intentionally NOT here — that's a Schedule-page
 * action (parent un-enrols then re-enrols elsewhere). The "View Schedule"
 * link covers that route.
 */
import Link from 'next/link'
import CancelBookingButton from '../schedule/CancelBookingButton'

export interface ActiveClass {
  id: string                  // enrolment id
  player_id: string
  group_id: string
  group: {
    name: string
    day_of_week: string | null
    time_slot: string | null
    location: string | null
    coach: { full_name: string } | null
  } | null
  child: {
    first_name: string
    last_name: string
  } | null
}

export default function ActiveClassesList({
  classes,
  retentionEnabled,
  retentionPercent,
  retentionMonths,
}: {
  classes: ActiveClass[]
  retentionEnabled: boolean
  retentionPercent: number
  retentionMonths: number | null
}) {
  if (classes.length === 0) {
    return (
      <section className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 text-center" data-testid="active-classes-empty">
        <h2 className="text-sm font-bold uppercase tracking-wider text-white/50 mb-2">Active classes</h2>
        <p className="text-sm text-white/70 mb-4">You&apos;re not enrolled in any classes yet.</p>
        <Link
          href="/dashboard/schedule"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-[#4ecde6] text-[#0a0a0a] hover:bg-[#5edcf6] transition-colors"
        >
          Browse the schedule →
        </Link>
      </section>
    )
  }

  return (
    <section className="space-y-3" data-testid="active-classes-list">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-white/50">Active classes</h2>
        <span className="text-xs text-white/40">{classes.length} {classes.length === 1 ? 'class' : 'classes'}</span>
      </div>
      <div className="bg-[#141414] border border-[#1e1e1e] rounded-2xl overflow-hidden divide-y divide-[#1e1e1e]">
        {classes.map(c => (
          <div key={c.id} className="p-4 flex items-center justify-between gap-3 flex-wrap" data-testid="active-classes-row">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h3 className="text-sm font-bold text-white truncate">{c.group?.name || '(Class name unavailable)'}</h3>
                {c.child && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/50 px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06]">
                    {c.child.first_name}
                  </span>
                )}
              </div>
              <p className="text-xs text-white/55 leading-relaxed">
                {c.group?.day_of_week || 'Day TBA'}
                {c.group?.time_slot && <> · {c.group.time_slot}</>}
                {c.group?.location && <> · {c.group.location}</>}
                {c.group?.coach?.full_name && <> · Coach {c.group.coach.full_name}</>}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href="/dashboard/schedule"
                className="text-xs font-semibold text-white/70 hover:text-white px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] hover:border-white/20 transition-all"
              >
                View schedule
              </Link>
              <CancelBookingButton
                enrolmentId={c.id}
                playerId={c.player_id}
                className={c.group?.name}
                retentionEnabled={retentionEnabled}
                retentionPercent={retentionPercent}
                retentionMonths={retentionMonths}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
