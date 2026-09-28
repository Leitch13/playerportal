// Seats: how several keepers share one coach's time.
//
// A 1-to-1 is one keeper in seat 0. A 2-to-1 is up to two keepers, seats 1 and 2,
// each with their own slot, their own dated sessions and their own charge.
// The database enforces the same rule (migration 119): one live session per
// coach · date · time · seat, and never a 1-to-1 and a 2-to-1 on the same time.
// These helpers decide the seat BEFORE anything is written, so the academy gets
// a plain answer instead of a database error.

export type SessionType = 'one_to_one' | 'two_to_one'

export interface SeatHolder {
  id: string
  session_type: SessionType
  pair_seat: number
}

export type SeatDecision =
  | { ok: true; seat: 0 | 1 | 2; pairWith: string | null }
  | { ok: false; reason: string }

/**
 * A new regular slot for `type` at a coach · day · time already held by `taken`
 * (the live slots there: pending, active or paused).
 */
export function seatForNewSlot(taken: SeatHolder[], type: SessionType): SeatDecision {
  if (type === 'one_to_one') {
    if (taken.length === 0) return { ok: true, seat: 0, pairWith: null }
    return {
      ok: false,
      reason: taken.some((t) => t.session_type === 'two_to_one')
        ? 'That coach has a 2-to-1 at that time. To add this keeper to it, choose 2-to-1 as the type.'
        : 'That coach already has a 1-to-1 at that time.',
    }
  }
  if (taken.some((t) => t.session_type === 'one_to_one')) {
    return { ok: false, reason: 'That coach already has a 1-to-1 at that time.' }
  }
  if (taken.length >= 2) return { ok: false, reason: 'That 2-to-1 already has two keepers.' }
  if (taken.length === 0) return { ok: true, seat: 1, pairWith: null }
  const other = taken[0]
  return { ok: true, seat: other.pair_seat === 1 ? 2 : 1, pairWith: other.id }
}

/** The seat a one-off or moved session takes, given the live sessions already on that coach · date · time. */
export function seatForSession(taken: { session_type: SessionType; pair_seat: number }[], type: SessionType): 0 | 1 | 2 | null {
  if (type === 'one_to_one') return taken.length === 0 ? 0 : null
  if (taken.some((t) => t.session_type === 'one_to_one')) return null
  const used = new Set(taken.map((t) => t.pair_seat))
  if (!used.has(1)) return 1
  if (!used.has(2)) return 2
  return null
}
