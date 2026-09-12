/**
 * 1-2-1 Slots · availability engine.
 *
 *   AVAILABLE  =  coach hours  ∩  venue hours
 *                 − venue closures − coach flags − academy blocks
 *                 + coach extras
 *                 − any live session for that coach at that time
 *                 − the past
 *
 * Regulars are live sessions, so they are subtracted like everything else and
 * never appear as free. A declined regular date is no longer live, so it comes
 * back as free by itself.
 *
 * Pure function over plain rows. The route loads rows for the window with the
 * service role and calls this. No imports from src/lib/billing, ever.
 */

import {
  addDays, daysBetween, hhmmToMinutes, instantToLondon, isoWeekday,
  WEEKDAY_KEYS, type Weekday,
} from './time'

export type WeeklyHours = Partial<Record<(typeof WEEKDAY_KEYS)[Weekday], [string, string][]>>

export interface VenueRow { id: string; weeklyHours: WeeklyHours; isActive?: boolean }
export interface ClosureRow { venueId: string; closedOn: string }
export interface CoachHoursRow {
  coachId: string; venueId: string; weekday: Weekday
  startMinutes: number; endMinutes: number
  effectiveFrom: string; effectiveTo?: string | null
}
export interface ExceptionRow {
  coachId: string; date: string; kind: 'flag' | 'extra' | 'block'
  venueId?: string | null; startMinutes?: number | null; endMinutes?: number | null
  status?: 'open' | 'resolved'
}
export interface SessionRow {
  coachId: string; date: string; startMinutes: number; durationMinutes: number
  status: 'held' | 'scheduled' | 'declined' | 'cancelled' | 'attended' | 'no_show'
}

export interface FreeSession {
  date: string; weekday: Weekday; startMinutes: number; durationMinutes: number
  coachId: string; venueId: string
}

export interface AvailabilityInput {
  from: string; to: string            // inclusive ISO dates
  durationMinutes: number
  venues: VenueRow[]
  closures: ClosureRow[]
  coachHours: CoachHoursRow[]
  exceptions: ExceptionRow[]
  sessions: SessionRow[]
  now?: Date                          // anything before this is gone
  minNoticeMinutes?: number           // default 120: can't book a session starting in the next 2h
  filters?: {
    coachId?: string; venueIds?: string[]; weekdays?: Weekday[]
    afterMinutes?: number; beforeMinutes?: number
  }
}

const LIVE = new Set<SessionRow['status']>(['held', 'scheduled', 'attended', 'no_show'])

type Range = [number, number]

function intersect(a: Range[], b: Range[]): Range[] {
  const out: Range[] = []
  for (const [as, ae] of a) for (const [bs, be] of b) {
    const s = Math.max(as, bs), e = Math.min(ae, be)
    if (e > s) out.push([s, e])
  }
  return merge(out)
}

function subtract(a: Range[], cuts: Range[]): Range[] {
  let cur = a
  for (const [cs, ce] of cuts) {
    const next: Range[] = []
    for (const [s, e] of cur) {
      if (ce <= s || cs >= e) { next.push([s, e]); continue }
      if (cs > s) next.push([s, cs])
      if (ce < e) next.push([ce, e])
    }
    cur = next
  }
  return cur
}

function merge(r: Range[]): Range[] {
  const sorted = [...r].sort((x, y) => x[0] - y[0])
  const out: Range[] = []
  for (const [s, e] of sorted) {
    const last = out[out.length - 1]
    if (last && s <= last[1]) last[1] = Math.max(last[1], e)
    else out.push([s, e])
  }
  return out
}

function venueRangesFor(v: VenueRow, weekday: Weekday): Range[] {
  const list = v.weeklyHours[WEEKDAY_KEYS[weekday]] ?? []
  return merge(list.map(([a, b]) => [hhmmToMinutes(a), hhmmToMinutes(b)] as Range).filter(([a, b]) => b > a))
}

export function freeSessions(input: AvailabilityInput): FreeSession[] {
  const { durationMinutes: dur } = input
  if (dur <= 0) throw new Error('durationMinutes must be positive')
  const span = daysBetween(input.from, input.to)
  if (span < 0) return []
  if (span > 92) throw new Error('window too wide (max 92 days)')

  const venues = new Map(input.venues.filter((v) => v.isActive !== false).map((v) => [v.id, v]))
  const closed = new Set(input.closures.map((c) => `${c.venueId}|${c.closedOn}`))
  const notice = input.minNoticeMinutes ?? 120
  const cutoff = input.now ? instantToLondon(new Date(input.now.getTime() + notice * 60_000)) : null
  const f = input.filters ?? {}
  const venueFilter = f.venueIds && f.venueIds.length ? new Set(f.venueIds) : null
  const weekdayFilter = f.weekdays && f.weekdays.length ? new Set<Weekday>(f.weekdays) : null

  // Index the subtractions once.
  const sessionsByCoachDate = new Map<string, Range[]>()
  for (const s of input.sessions) {
    if (!LIVE.has(s.status)) continue
    const k = `${s.coachId}|${s.date}`
    const arr = sessionsByCoachDate.get(k) ?? []
    arr.push([s.startMinutes, s.startMinutes + s.durationMinutes])
    sessionsByCoachDate.set(k, arr)
  }
  const exByCoachDate = new Map<string, ExceptionRow[]>()
  for (const e of input.exceptions) {
    if (e.status === 'resolved' && e.kind !== 'extra') continue
    const k = `${e.coachId}|${e.date}`
    const arr = exByCoachDate.get(k) ?? []
    arr.push(e)
    exByCoachDate.set(k, arr)
  }

  const out: FreeSession[] = []

  for (let i = 0; i <= span; i++) {
    const date = addDays(input.from, i)
    if (cutoff && date < cutoff.date) continue
    const weekday = isoWeekday(date)
    if (weekdayFilter && !weekdayFilter.has(weekday)) continue

    // coach → venue → open ranges for this date
    const windows = new Map<string, Map<string, Range[]>>()
    const put = (coachId: string, venueId: string, ranges: Range[]) => {
      if (!ranges.length) return
      const byVenue = windows.get(coachId) ?? new Map<string, Range[]>()
      byVenue.set(venueId, merge([...(byVenue.get(venueId) ?? []), ...ranges]))
      windows.set(coachId, byVenue)
    }

    for (const h of input.coachHours) {
      if (h.weekday !== weekday) continue
      if (date < h.effectiveFrom) continue
      if (h.effectiveTo && date > h.effectiveTo) continue
      if (f.coachId && h.coachId !== f.coachId) continue
      const venue = venues.get(h.venueId)
      if (!venue) continue
      if (closed.has(`${h.venueId}|${date}`)) continue
      put(h.coachId, h.venueId, intersect([[h.startMinutes, h.endMinutes]], venueRangesFor(venue, weekday)))
    }

    // Extras: explicit, date-specific, still need an open venue that day.
    for (const [k, list] of exByCoachDate) {
      const [coachId, d] = k.split('|')
      if (d !== date) continue
      if (f.coachId && coachId !== f.coachId) continue
      for (const e of list) {
        if (e.kind !== 'extra' || !e.venueId || e.startMinutes == null || e.endMinutes == null) continue
        if (!venues.has(e.venueId) || closed.has(`${e.venueId}|${date}`)) continue
        put(coachId, e.venueId, [[e.startMinutes, e.endMinutes]])
      }
    }

    for (const [coachId, byVenue] of windows) {
      // Flags and blocks cut across every venue for that coach.
      const cuts: Range[] = []
      for (const e of exByCoachDate.get(`${coachId}|${date}`) ?? []) {
        if (e.kind === 'extra') continue
        cuts.push(e.startMinutes == null || e.endMinutes == null ? [0, 1440] : [e.startMinutes, e.endMinutes])
      }
      const busy = sessionsByCoachDate.get(`${coachId}|${date}`) ?? []

      for (const [venueId, ranges] of byVenue) {
        if (venueFilter && !venueFilter.has(venueId)) continue
        // Step the ORIGINAL window on its own rhythm (16:00, 16:30, …) and keep a
        // step only if the whole of it survives the cuts. A session at 16:45 must
        // not shift the rest of the evening to 17:15, 17:45, …
        const open = subtract(subtract(ranges, cuts), busy)
        for (const [ws, we] of ranges) {
          for (let start = ws; start + dur <= we; start += dur) {
            if (!open.some(([s, e]) => start >= s && start + dur <= e)) continue
            if (cutoff && date === cutoff.date && start < cutoff.minutes) continue
            if (f.afterMinutes != null && start < f.afterMinutes) continue
            if (f.beforeMinutes != null && start + dur > f.beforeMinutes) continue
            out.push({ date, weekday, startMinutes: start, durationMinutes: dur, coachId, venueId })
          }
        }
      }
    }
  }

  out.sort((a, b) => a.date.localeCompare(b.date) || a.startMinutes - b.startMinutes || a.coachId.localeCompare(b.coachId))
  return out
}

/** True when this exact session would be returned by freeSessions — the check before hold_session. */
export function isFree(input: AvailabilityInput, want: Pick<FreeSession, 'date' | 'startMinutes' | 'coachId' | 'venueId'>): boolean {
  const hits = freeSessions({ ...input, from: want.date, to: want.date, filters: { ...(input.filters ?? {}), coachId: want.coachId, venueIds: [want.venueId] } })
  return hits.some((h) => h.startMinutes === want.startMinutes)
}
