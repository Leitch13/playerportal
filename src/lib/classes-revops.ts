// ============================================================================
// classes-revops.ts — Classes Revenue Intelligence, Phase 1A.
//
// Pure helpers + flag for the read-only "Revenue & Capacity" strip on the
// Classes page. Turns capacity + canonical seat counts (get_group_seat_counts)
// + per-class price (subscription_plans matched by class_type) + waitlist counts
// into open-seat £/mo potential, at-risk / low-occupancy / waitlist-demand
// classification, and a "needs attention" list.
//
// No queries here, no writes, no schema. Flag OFF ⇒ nothing is built and the
// Classes page renders byte-identical to today.
// ============================================================================

export const CLASSES_REVOPS_ENABLED = process.env.CLASSES_REVOPS_ENABLED === 'true'

// A class below this active-seat count is "at risk" (not viable). Constant for
// the MVP — a per-class threshold would be a schema change (out of scope).
export const MIN_VIABLE = 8
// Below this occupancy (and not at-risk) = spare capacity worth filling.
export const LOW_OCCUPANCY = 0.5
const DEFAULT_CAPACITY = 20 // mirrors the page's `max_capacity || 20` convention

// Interval-normalise a plan's amount to a MONTHLY figure. Quarterly ÷3, yearly
// ÷12; anything else treated as already-monthly. Never sums raw amounts.
export function monthlyAmount(plan: { amount: number | string | null; interval: string | null }): number {
  const amt = Number(plan.amount || 0)
  if (!Number.isFinite(amt) || amt <= 0) return 0
  switch ((plan.interval || 'month').toLowerCase()) {
    case 'quarter':
    case 'quarterly':
      return amt / 3
    case 'year':
    case 'yearly':
    case 'annual':
      return amt / 12
    default:
      return amt
  }
}

export type ClassStatus = 'at_risk' | 'waitlist_demand' | 'low_occupancy' | 'full' | 'healthy'

export type ClassIntel = {
  id: string
  name: string
  dayLabel: string | null
  capacity: number
  enrolled: number
  openSeats: number
  occupancyPct: number // 0..1
  monthlyPerSeat: number | null // null = no matching plan ⇒ £ shown as "—"
  openSeatValueMo: number | null
  waiting: number
  status: ClassStatus
}

export type ClassesRollup = {
  totalOpenSeats: number
  openSeatValueMo: number // Σ of known per-class open-seat value
  someValueUnknown: boolean // true if any open-seat class has no matching plan
  totalWaitlisted: number
  atRiskCount: number
  avgOccupancyPct: number // 0..1
}

type GroupLike = {
  id: string
  name: string
  day_of_week?: string | null
  time_slot?: string | null
  max_capacity?: number | null
  class_type?: string | null
}

const STATUS_RANK: Record<ClassStatus, number> = {
  at_risk: 0,
  waitlist_demand: 1,
  low_occupancy: 2,
  full: 3,
  healthy: 9,
}

// Build per-class intelligence + rollups + a ranked needs-attention list, all
// from already-derived maps (no I/O here).
export function buildClassIntel(
  groups: GroupLike[],
  seatByGroup: Map<string, number>,
  waitingByGroup: Map<string, number>,
  monthlyByClassType: Map<string, number>,
): { classes: ClassIntel[]; rollup: ClassesRollup; needsAttention: ClassIntel[] } {
  const classes: ClassIntel[] = []

  for (const g of groups) {
    const capacity = (g.max_capacity ?? DEFAULT_CAPACITY) || DEFAULT_CAPACITY
    const enrolled = seatByGroup.get(g.id) ?? 0
    const openSeats = Math.max(0, capacity - enrolled)
    const occupancyPct = capacity > 0 ? enrolled / capacity : 0
    const waiting = waitingByGroup.get(g.id) ?? 0
    const monthlyPerSeat = g.class_type ? monthlyByClassType.get(g.class_type) ?? null : null
    const valueMo = monthlyPerSeat != null ? openSeats * monthlyPerSeat : null

    // Primary reason, ranked (at-risk most urgent → full least).
    let status: ClassStatus = 'healthy'
    if (enrolled < MIN_VIABLE) status = 'at_risk'
    else if (waiting > 0) status = 'waitlist_demand'
    else if (occupancyPct < LOW_OCCUPANCY) status = 'low_occupancy'
    else if (occupancyPct >= 1) status = 'full'

    const dayLabel = g.day_of_week
      ? `${g.day_of_week}${g.time_slot ? ` · ${g.time_slot}` : ''}`
      : g.time_slot || null

    classes.push({
      id: g.id, name: g.name, dayLabel, capacity, enrolled, openSeats,
      occupancyPct, monthlyPerSeat, openSeatValueMo: valueMo, waiting, status,
    })
  }

  const rollup: ClassesRollup = {
    totalOpenSeats: classes.reduce((s, c) => s + c.openSeats, 0),
    openSeatValueMo: classes.reduce((s, c) => s + (c.openSeatValueMo ?? 0), 0),
    someValueUnknown: classes.some((c) => c.openSeats > 0 && c.openSeatValueMo == null),
    totalWaitlisted: classes.reduce((s, c) => s + c.waiting, 0),
    atRiskCount: classes.filter((c) => c.status === 'at_risk').length,
    avgOccupancyPct:
      classes.reduce((s, c) => s + c.capacity, 0) > 0
        ? classes.reduce((s, c) => s + c.enrolled, 0) / classes.reduce((s, c) => s + c.capacity, 0)
        : 0,
  }

  const needsAttention = classes
    .filter((c) => c.status !== 'healthy')
    .sort(
      (a, b) =>
        STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
        (b.openSeatValueMo ?? 0) - (a.openSeatValueMo ?? 0) ||
        b.openSeats - a.openSeats,
    )

  return { classes, rollup, needsAttention }
}
