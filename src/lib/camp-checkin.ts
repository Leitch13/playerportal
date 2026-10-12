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
  details: { camp_day_id?: string } | null
}

export const checkinKey = (bookingId: string, dayId: string) => `${bookingId}:${dayId}`

/** Who is ticked in right now: the last press for each child-and-day decides. */
export function checkedInNow(rows: CheckinRow[]): Set<string> {
  const latest = new Map<string, CheckinRow>()
  for (const r of rows) {
    const dayId = r.details?.camp_day_id
    if (!r.entity_id || !dayId) continue
    const key = checkinKey(r.entity_id, dayId)
    const prior = latest.get(key)
    if (!prior || r.created_at >= prior.created_at) latest.set(key, r)
  }
  return new Set([...latest].filter(([, r]) => r.action === CHECKED_IN_ACTION).map(([k]) => k))
}
