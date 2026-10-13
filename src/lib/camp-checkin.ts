/**
 * Ticking a child in on a camp day.
 *
 * A tick belongs to one booking on one day. Each press is written to the
 * academy's audit log (who pressed it, and when) rather than to a column on the
 * booking, for two reasons: a full-week booking has no row per day to hold a
 * column, and a register is exactly the kind of thing an academy may need to
 * look back on ("who signed him in on Tuesday?"). The latest press wins.
 *
 * This file is the only place that knows where ticks are kept. Move them to a
 * table of their own one day and nothing else changes.
 */
export const CHECKED_IN_ACTION = 'camp.checked_in'
export const CHECK_IN_UNDONE_ACTION = 'camp.check_in_undone'
export const CHECKIN_ACTIONS = [CHECKED_IN_ACTION, CHECK_IN_UNDONE_ACTION]

export interface CheckinRow {
  action: string
  entity_id: string | null
  created_at: string
  details: { camp_day_id?: string; date?: string } | null
}

export const checkinKey = (bookingId: string, dayId: string) => `${bookingId}:${dayId}`

/**
 * A whole-week camp has no day rows of its own, so its register is kept by date.
 * The "day id" for one of its days is this, e.g. "date:2026-10-19".
 */
export const DATE_DAY = 'date:'
export const dateDayId = (iso: string) => `${DATE_DAY}${iso}`
export const isDateDay = (dayId: string) => dayId.startsWith(DATE_DAY)

/** Every date from the first to the last, inclusive, capped so a mistyped year cannot make a thousand days. */
export function datesBetween(start: string | null | undefined, end: string | null | undefined, max = 31): string[] {
  if (!start || !/^\d{4}-\d{2}-\d{2}/.test(start)) return []
  const last = end && /^\d{4}-\d{2}-\d{2}/.test(end) && end >= start ? end.slice(0, 10) : start.slice(0, 10)
  const out: string[] = []
  for (const d = new Date(start.slice(0, 10) + 'T00:00:00Z'); out.length < max; d.setUTCDate(d.getUTCDate() + 1)) {
    const iso = d.toISOString().slice(0, 10)
    out.push(iso)
    if (iso >= last) break
  }
  return out
}

/** Who is ticked in right now: the last press for each child-and-day decides. */
export function checkedInNow(rows: CheckinRow[]): Set<string> {
  const latest = new Map<string, CheckinRow>()
  for (const r of rows) {
    // A camp sold by the day records its day row; a whole-week camp records only the date.
    const dayId = r.details?.camp_day_id || (r.details?.date ? dateDayId(r.details.date) : null)
    if (!r.entity_id || !dayId) continue
    const key = checkinKey(r.entity_id, dayId)
    const prior = latest.get(key)
    if (!prior || r.created_at >= prior.created_at) latest.set(key, r)
  }
  return new Set([...latest].filter(([, r]) => r.action === CHECKED_IN_ACTION).map(([k]) => k))
}
