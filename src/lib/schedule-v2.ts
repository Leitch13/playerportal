// ============================================================================
// schedule-v2.ts — Parent Schedule 2.0, Phase 1A (Recomposition MVP).
//
// Pure helpers + flag. Computes the parent's NEXT session and THIS WEEK's
// sessions from the recurring weekly templates (training_groups.day_of_week +
// time_slot) the schedule page ALREADY loads — no new queries, no writes, no
// schema. Flag OFF ⇒ the page renders byte-identical to today.
//
// NOTE (in-scope limitation): occurrences are derived from the recurring
// template, so they do NOT reflect one-off cancellations (cancellation-
// awareness is explicitly Phase 2 / class_cancellations).
// ============================================================================

export const PARENT_SCHEDULE_V2_ENABLED = process.env.PARENT_SCHEDULE_V2_ENABLED === 'true'

export type ScheduleSlot = {
  dayOfWeek: string | null
  timeSlot: string | null
  location: string | null
  coachName: string | null
  groupName: string
  groupId: string
  playerId: string
  playerName: string
  enrolmentId: string
}

const DAY_MS = 86_400_000
const DAY_INDEX: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
}

// Parse "HH:MM" / "H:MM AM/PM" (start of a "HH:MM-HH:MM" range) into minutes.
// Mirrors the same parser used by parent-hub-metrics' nextSession.
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

// Next occurrence (ms) of each recurring weekly slot, sorted soonest-first.
// Slots with no parseable day/time are skipped (still shown in My Schedule).
export function upcomingSessions(
  slots: ScheduleSlot[],
  nowMs: number = Date.now(),
): (ScheduleSlot & { whenMs: number })[] {
  const now = new Date(nowMs)
  const nowDay = now.getDay()
  const nowMins = now.getHours() * 60 + now.getMinutes()
  const out: (ScheduleSlot & { whenMs: number })[] = []
  for (const s of slots) {
    const di = s.dayOfWeek ? DAY_INDEX[s.dayOfWeek.trim().toLowerCase()] : undefined
    const sm = startMinutes(s.timeSlot)
    if (di === undefined || sm == null) continue
    let daysAhead = (di - nowDay + 7) % 7
    if (daysAhead === 0 && sm <= nowMins) daysAhead = 7 // already passed today → next week
    const whenMs = nowMs + daysAhead * DAY_MS - nowMins * 60_000 + sm * 60_000
    out.push({ ...s, whenMs })
  }
  return out.sort((a, b) => a.whenMs - b.whenMs)
}

// Exclusive end of the current calendar week (next Monday 00:00 local).
export function endOfWeekMs(nowMs: number = Date.now()): number {
  const d = new Date(nowMs)
  const monIdx = (d.getDay() + 6) % 7 // Mon=0 … Sun=6
  const daysToNextMon = 7 - monIdx
  const startOfToday = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  return startOfToday + daysToNextMon * DAY_MS
}

export function isThisWeek(whenMs: number, nowMs: number = Date.now()): boolean {
  return whenMs < endOfWeekMs(nowMs)
}

// Parent-friendly relative label for a session start.
export function relativeLabel(whenMs: number, nowMs: number = Date.now()): string {
  const startOfDay = (ms: number) => { const d = new Date(ms); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() }
  const days = Math.round((startOfDay(whenMs) - startOfDay(nowMs)) / DAY_MS)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return `In ${days} days`
}
