/**
 * Move a trial to another date or class (John, 28 Oct 2026: "build" — Talent FA's Elena paid £5
 * for a Saturday trial that was cancelled the night before, and there was no way to give her
 * another Saturday). Same for every academy. Nothing about money changes: a paid trial keeps its
 * payment, a free one stays free. The new day must be one the class runs, today or later, with a
 * place free (src/lib/class-places.ts). The family and the academy are both told the new date.
 */

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

/** 0–6 (Sunday = 0) from a class's day_of_week text, or null when it has no set day. */
export function weekdayIndex(dayOfWeek: string | null | undefined): number | null {
  const i = DAYS.indexOf(String(dayOfWeek || '').trim().toLowerCase())
  return i < 0 ? null : i
}

/** The next `count` dates (yyyy-mm-dd) a class runs, from `todayIso` on (today counts). */
export function nextClassDates(dayOfWeek: string | null | undefined, todayIso: string, count = 8): string[] {
  const want = weekdayIndex(dayOfWeek)
  if (want == null) return []
  const d = new Date(`${todayIso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + ((want - d.getUTCDay() + 7) % 7))
  const out: string[] = []
  for (let i = 0; i < count; i++) { out.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 7) }
  return out
}

/** Statuses a trial can be moved from. A trial that happened (attended) or joined can't. */
export const MOVABLE = ['pending', 'confirmed', 'cancelled', 'no_show'] as const

export function moveProblem(t: { status: string | null; converted?: boolean | null }, dayOfWeek: string | null | undefined, dateIso: string, todayIso: string): string | null {
  if (t.converted) return 'This child has already joined.'
  if (!(MOVABLE as readonly string[]).includes(String(t.status || 'pending'))) return 'This trial has already happened. Book a new one instead.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) return 'Pick a date.'
  if (dateIso < todayIso) return 'That date has gone. Pick today or later.'
  const want = weekdayIndex(dayOfWeek)
  if (want != null && new Date(`${dateIso}T12:00:00Z`).getUTCDay() !== want) return `That class runs on ${String(dayOfWeek).trim()}s. Pick one of those.`
  return null
}

/** A moved trial goes back to "booked": cancelled / no-show become confirmed, pending stays pending. */
export function statusAfterMove(status: string | null): 'pending' | 'confirmed' {
  return status === 'pending' ? 'pending' : 'confirmed'
}

export const TRIAL_MOVED = 'trial.moved'
