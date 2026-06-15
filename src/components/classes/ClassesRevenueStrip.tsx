import type { ClassIntel, ClassesRollup, ClassStatus } from '@/lib/classes-revops'

// Classes Revenue Intelligence — Phase 1A "Revenue & Capacity" strip. Server
// presentational, read-only. Sits above the existing Classes stat cards / grid
// and answers "where's the money, what's dying, where's the demand?" in one
// glance: open-seat £/mo potential + at-risk + waitlist + occupancy, then a
// ranked "classes needing attention" list. No buttons (Phase 2 owns actions).
// Dark theme to match the existing Classes page.

const CAP = 6

function gbp(n: number): string {
  return `£${Math.round(n).toLocaleString('en-GB')}`
}
function pct(n: number): string {
  return `${Math.round(n * 100)}%`
}

const STATUS_META: Record<Exclude<ClassStatus, 'healthy'>, { label: string; chip: string }> = {
  at_risk: { label: 'Below viable', chip: 'bg-rose-500/10 text-rose-300 border-rose-500/30' },
  waitlist_demand: { label: 'Waitlist demand', chip: 'bg-amber-500/10 text-amber-300 border-amber-500/30' },
  low_occupancy: { label: 'Low occupancy', chip: 'bg-orange-500/10 text-orange-300 border-orange-500/30' },
  full: { label: 'Full', chip: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' },
}

function rightDetail(c: ClassIntel): string {
  if (c.status === 'waitlist_demand') return `${c.waiting} waiting`
  if (c.status === 'full') return 'at capacity'
  if (c.openSeats > 0) {
    return c.openSeatValueMo != null ? `${c.openSeats} seats · ${gbp(c.openSeatValueMo)}/mo` : `${c.openSeats} seats`
  }
  return `${c.enrolled}/${c.capacity}`
}

export default function ClassesRevenueStrip({
  rollup,
  needsAttention,
}: {
  rollup: ClassesRollup
  needsAttention: ClassIntel[]
}) {
  const shown = needsAttention.slice(0, CAP)
  const more = needsAttention.length - shown.length
  const occTone = rollup.avgOccupancyPct >= 0.8 ? 'text-orange-400' : 'text-emerald-400'

  return (
    <section aria-label="Revenue and capacity" className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 sm:p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-white/70">Revenue &amp; capacity</h2>
        <span className="text-[11px] text-white/40">Where&rsquo;s the money today</span>
      </div>

      {/* ── Headline metrics ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <div className="rounded-xl border border-[#4ecde6]/20 bg-[#4ecde6]/[0.06] p-3">
          <div className="text-2xl font-extrabold text-[#4ecde6] leading-none">{rollup.totalOpenSeats}</div>
          <div className="text-[10px] uppercase tracking-wider text-white/60 mt-1">Open seats</div>
          <div className="text-[11px] text-white/50 mt-0.5">
            {gbp(rollup.openSeatValueMo)}/mo potential{rollup.someValueUnknown ? '+' : ''}
          </div>
        </div>
        <Metric value={String(rollup.atRiskCount)} label="Classes at risk" tone={rollup.atRiskCount > 0 ? 'text-rose-400' : 'text-white/50'} hint="below viable" />
        <Metric value={String(rollup.totalWaitlisted)} label="Waitlist demand" tone={rollup.totalWaitlisted > 0 ? 'text-amber-400' : 'text-white/50'} hint="players waiting" />
        <Metric value={pct(rollup.avgOccupancyPct)} label="Avg occupancy" tone={occTone} hint="across classes" />
      </div>

      {/* ── Classes needing attention ── */}
      {shown.length === 0 ? (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-4 text-center">
          <p className="text-sm font-semibold text-emerald-300">All classes are healthy ✅</p>
          <p className="text-xs text-white/50 mt-1">No at-risk, underfilled, or waitlisted classes right now.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-white/70">Classes needing attention</h3>
            <span className="text-[10px] font-bold text-white/40 bg-white/[0.06] px-1.5 py-0.5 rounded-full">{needsAttention.length}</span>
          </div>
          <ul className="rounded-xl border border-white/[0.06] divide-y divide-white/[0.05] overflow-hidden">
            {shown.map((c) => {
              const meta = STATUS_META[c.status as Exclude<ClassStatus, 'healthy'>]
              return (
                <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{c.name}</p>
                    <p className="text-[11px] text-white/50 truncate">
                      {c.dayLabel ? `${c.dayLabel} · ` : ''}{c.enrolled}/{c.capacity} · {pct(c.occupancyPct)} full
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] text-white/50 hidden sm:inline">{rightDetail(c)}</span>
                    {meta && <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${meta.chip}`}>{meta.label}</span>}
                  </div>
                </li>
              )
            })}
          </ul>
          {more > 0 && <p className="text-[11px] text-white/40 px-1">+{more} more in the list below</p>}
          {rollup.someValueUnknown && (
            <p className="text-[10px] text-white/30 px-1">£ potential covers classes with a matching membership plan; classes without one are excluded from the total.</p>
          )}
        </div>
      )}
    </section>
  )
}

function Metric({ value, label, tone, hint }: { value: string; label: string; tone: string; hint: string }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
      <div className={`text-2xl font-extrabold leading-none ${tone}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-white/60 mt-1">{label}</div>
      <div className="text-[11px] text-white/50 mt-0.5">{hint}</div>
    </div>
  )
}
