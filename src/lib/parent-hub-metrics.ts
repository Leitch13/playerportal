// ============================================================================
// parent-hub-metrics.ts — Parent Hub MVP (child-centric parent home).
//
// PURE functions only — no DB, no side effects. ParentDashboard does the I/O
// and passes rows in; these helpers define the derivations so the Hub answers
// "how are my kids · what do I pay · what's next · what must I do" from data
// that already exists (see PARENT_HUB_MVP_PHASE0.md).
//
// Display-layer only: nothing here writes, touches Stripe, or changes schema.
// Gated by PARENT_HUB_ENABLED — flag OFF ⇒ none of this is reached and the
// parent dashboard renders exactly as before.
// ============================================================================

export const PARENT_HUB_ENABLED = process.env.PARENT_HUB_ENABLED === 'true'

const DAY_MS = 86_400_000
const DAY_INDEX: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
}

/** £ formatter — whole pounds unless pennies present. */
export function formatGBP(n: number): string {
  return '£' + (Number(n) || 0).toFixed(n % 1 === 0 ? 0 : 2)
}

/**
 * A1 — parent-friendly age label from the raw `age_group` (presentation only).
 *  - birth-year cohort ("2015s" / "2015" / "Born 2015") → "Age 11"
 *  - U-band ("U11", "u 11") → "U11"
 *  - anything else → shown as-is (safe fallback)
 */
export function formatAgeLabel(ageGroup: string | null | undefined, now: number = Date.now()): string | null {
  if (!ageGroup) return null
  const s = String(ageGroup).trim()
  if (!s) return null
  const year = s.match(/(?:19|20)\d{2}/)
  if (year) {
    const age = new Date(now).getFullYear() - parseInt(year[0], 10)
    if (age >= 0 && age <= 25) return `Age ${age}`
  }
  if (/^u\s?\d{1,2}$/i.test(s)) return s.toUpperCase().replace(/\s/g, '')
  return s
}

// ── Progress (coach score) — matches the report / ProgressTrend average ──
const REVIEW_DIMS = [
  'attitude', 'effort', 'technical_quality',
  'game_understanding', 'confidence', 'physical_movement',
] as const

export type ReviewLike = Partial<Record<(typeof REVIEW_DIMS)[number], number | null>> & {
  review_date?: string | null
  parent_summary?: string | null
}

/** Average of the non-null review dimensions, 1dp (null if none). */
export function coachScore(review: ReviewLike | null | undefined): number | null {
  if (!review) return null
  const vals = REVIEW_DIMS.map((k) => review[k]).filter((v): v is number => typeof v === 'number')
  if (vals.length === 0) return null
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
}

/**
 * Progress snapshot from a player's reviews (newest first). Per decision 4:
 * one review ⇒ score only (no delta); two+ ⇒ score + ↑/→/↓ vs previous.
 */
export function progressSnapshot(reviewsNewestFirst: ReviewLike[]): {
  score: number | null
  delta: number | null
  direction: 'up' | 'flat' | 'down' | null
  latestFeedback: string | null
} {
  const latest = reviewsNewestFirst[0]
  const score = coachScore(latest)
  let delta: number | null = null
  let direction: 'up' | 'flat' | 'down' | null = null
  if (reviewsNewestFirst.length >= 2 && score != null) {
    const prev = coachScore(reviewsNewestFirst[1])
    if (prev != null) {
      delta = Math.round((score - prev) * 10) / 10
      direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'
    }
  }
  return { score, delta, direction, latestFeedback: latest?.parent_summary ?? null }
}

// ── Money ──
export interface PaymentLike { amount: number | string; amount_paid?: number | string | null; status?: string | null }

export function paymentOwing(p: PaymentLike): number {
  const owing = Number(p.amount || 0) - Number(p.amount_paid || 0)
  return owing > 0 ? owing : 0
}

/** Σ owed across unpaid / partial / overdue payments. */
export function sumOutstanding(payments: PaymentLike[]): number {
  return payments.reduce((sum, p) => {
    const s = (p.status || '').toLowerCase()
    return sum + (s === 'unpaid' || s === 'partial' || s === 'overdue' ? paymentOwing(p) : 0)
  }, 0)
}

/** Σ monthly amount across active subscriptions. */
export function monthlySpend(activeSubs: { plan?: { amount?: number | string | null } | null }[]): number {
  return activeSubs.reduce((sum, s) => sum + (Number(s.plan?.amount ?? 0) || 0), 0)
}

// ── Attendance ──
/** Present / total → whole-percent (null if no records). */
export function attendancePct(records: { present: boolean }[]): number | null {
  if (!records.length) return null
  const present = records.filter((r) => r.present).length
  return Math.round((present / records.length) * 100)
}

// ── Next session ──
export interface SessionSlot {
  name: string
  dayOfWeek: string | null
  timeSlot: string | null
  location?: string | null
  childName?: string | null
}

/** Parse a "HH:MM", "H:MM AM/PM" (start of a "HH:MM-HH:MM" range) into minutes. */
function startMinutes(timeSlot: string | null | undefined): number | null {
  if (!timeSlot) return null
  const start = timeSlot.split(/[-–]/)[0].trim()
  const m12 = start.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  const m24 = start.match(/^(\d{1,2}):(\d{2})$/)
  let h: number, m: number
  if (m12) {
    h = parseInt(m12[1]); m = parseInt(m12[2])
    if (m12[3].toUpperCase() === 'PM' && h !== 12) h += 12
    if (m12[3].toUpperCase() === 'AM' && h === 12) h = 0
  } else if (m24) {
    h = parseInt(m24[1]); m = parseInt(m24[2])
  } else return null
  return h * 60 + m
}

/** Soonest upcoming weekly session from a list of recurring slots. */
export function nextSession(
  slots: SessionSlot[],
  nowMs: number = Date.now(),
): (SessionSlot & { whenMs: number }) | null {
  const now = new Date(nowMs)
  const nowDay = now.getDay()
  const nowMins = now.getHours() * 60 + now.getMinutes()
  let best: (SessionSlot & { whenMs: number }) | null = null
  for (const s of slots) {
    const di = s.dayOfWeek ? DAY_INDEX[s.dayOfWeek.trim().toLowerCase()] : undefined
    const sm = startMinutes(s.timeSlot)
    if (di === undefined || sm == null) continue
    let daysAhead = (di - nowDay + 7) % 7
    if (daysAhead === 0 && sm <= nowMins) daysAhead = 7 // already passed today → next week
    const whenMs = nowMs + daysAhead * DAY_MS - nowMins * 60_000 + sm * 60_000
    if (!best || whenMs < best.whenMs) best = { ...s, whenMs }
  }
  return best
}

// ── Action Centre ──
export interface ActionSignal { key: string; label: string; detail: string; href: string; tone: 'bad' | 'warn' | 'info' | 'good' }

export function actionSignals(input: {
  outstanding: number
  newReviewCount: number
  unreadCount: number
  anyPastDue: boolean
}): ActionSignal[] {
  const out: ActionSignal[] = []
  if (input.outstanding > 0) out.push({ key: 'outstanding', label: `Outstanding balance ${formatGBP(input.outstanding)}`, detail: 'Settle your balance', href: '/dashboard/payments', tone: 'bad' })
  if (input.newReviewCount > 0) out.push({ key: 'report', label: 'New report available', detail: 'See how your child is doing', href: '/dashboard/feedback', tone: 'info' })
  if (input.unreadCount > 0) out.push({ key: 'message', label: `${input.unreadCount} unread message${input.unreadCount === 1 ? '' : 's'}`, detail: 'From your academy', href: '/dashboard/messages', tone: 'info' })
  if (input.anyPastDue) out.push({ key: 'membership', label: 'Membership needs attention', detail: 'A payment did not go through', href: '/dashboard/payments', tone: 'warn' })
  if (out.length === 0) out.push({ key: 'clear', label: 'Everything is up to date', detail: 'No actions required', href: '#', tone: 'good' })
  return out
}
