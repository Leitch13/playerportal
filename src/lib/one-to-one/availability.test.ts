import { describe, expect, it } from 'vitest'
import { freeSessions, isFree, type AvailabilityInput, type VenueRow } from './availability'

// No.1 GK shaped fixture. Cammy at Portobello Mon–Fri, Matty at Saughton Tue/Thu.
const portobello: VenueRow = { id: 'v-port', weeklyHours: { mon: [['15:30', '20:00']], tue: [['15:30', '20:00']], wed: [['15:30', '20:00']], thu: [['15:30', '20:00']], fri: [['15:30', '20:00']] } }
const saughton: VenueRow = { id: 'v-saug', weeklyHours: { tue: [['16:00', '19:30']], thu: [['16:00', '19:30']] } }

function base(over: Partial<AvailabilityInput> = {}): AvailabilityInput {
  return {
    from: '2026-10-19', to: '2026-10-25', // Mon 19 – Sun 25 Oct (clock change Sunday)
    durationMinutes: 30,
    venues: [portobello, saughton],
    closures: [],
    coachHours: [
      { coachId: 'cammy', venueId: 'v-port', weekday: 1, startMinutes: 960, endMinutes: 1170, effectiveFrom: '2026-01-01' }, // Mon 16:00–19:30
      { coachId: 'cammy', venueId: 'v-port', weekday: 5, startMinutes: 930, endMinutes: 1140, effectiveFrom: '2026-01-01' }, // Fri 15:30–19:00
      { coachId: 'matty', venueId: 'v-saug', weekday: 4, startMinutes: 960, endMinutes: 1140, effectiveFrom: '2026-01-01' }, // Thu 16:00–19:00
    ],
    exceptions: [],
    sessions: [],
    ...over,
  }
}

const at = (list: ReturnType<typeof freeSessions>, date: string, coach?: string) =>
  list.filter((s) => s.date === date && (!coach || s.coachId === coach)).map((s) => s.startMinutes)

describe('coach hours ∩ venue hours', () => {
  it('steps the open window by the session length', () => {
    const free = freeSessions(base())
    expect(at(free, '2026-10-19', 'cammy')).toEqual([960, 990, 1020, 1050, 1080, 1110, 1140]) // 16:00…19:00 starts, 7 × 30 min
    expect(at(free, '2026-10-22', 'matty')).toEqual([960, 990, 1020, 1050, 1080, 1110])
    expect(at(free, '2026-10-20')).toEqual([]) // nobody works Tuesday
  })
  it('clips coach hours to venue hours', () => {
    const free = freeSessions(base({ venues: [{ id: 'v-port', weeklyHours: { mon: [['16:30', '18:00']] } }, saughton] }))
    expect(at(free, '2026-10-19', 'cammy')).toEqual([990, 1020, 1050])
  })
  it('honours effective_from / effective_to', () => {
    const free = freeSessions(base({ coachHours: [{ coachId: 'cammy', venueId: 'v-port', weekday: 1, startMinutes: 960, endMinutes: 1170, effectiveFrom: '2026-10-20' }] }))
    expect(at(free, '2026-10-19')).toEqual([])
    const free2 = freeSessions(base({ coachHours: [{ coachId: 'cammy', venueId: 'v-port', weekday: 1, startMinutes: 960, endMinutes: 1170, effectiveFrom: '2026-01-01', effectiveTo: '2026-10-18' }] }))
    expect(at(free2, '2026-10-19')).toEqual([])
  })
})

describe('subtractions', () => {
  it('a venue closure removes the whole day', () => {
    const free = freeSessions(base({ closures: [{ venueId: 'v-port', closedOn: '2026-10-19' }] }))
    expect(at(free, '2026-10-19')).toEqual([])
    expect(at(free, '2026-10-23', 'cammy').length).toBeGreaterThan(0)
  })
  it('a whole-day flag pulls everything; a ranged flag pulls the range', () => {
    const whole = freeSessions(base({ exceptions: [{ coachId: 'matty', date: '2026-10-22', kind: 'flag' }] }))
    expect(at(whole, '2026-10-22', 'matty')).toEqual([])
    const part = freeSessions(base({ exceptions: [{ coachId: 'cammy', date: '2026-10-19', kind: 'block', startMinutes: 1020, endMinutes: 1080 }] }))
    expect(at(part, '2026-10-19', 'cammy')).toEqual([960, 990, 1080, 1110, 1140])
  })
  it('a resolved flag no longer subtracts', () => {
    const free = freeSessions(base({ exceptions: [{ coachId: 'matty', date: '2026-10-22', kind: 'flag', status: 'resolved' }] }))
    expect(at(free, '2026-10-22', 'matty').length).toBe(6)
  })
  it('live sessions (regular, held, ad hoc) are never free; declined and cancelled are', () => {
    const free = freeSessions(base({ sessions: [
      { coachId: 'cammy', date: '2026-10-19', startMinutes: 990, durationMinutes: 30, status: 'scheduled' },
      { coachId: 'cammy', date: '2026-10-19', startMinutes: 1020, durationMinutes: 30, status: 'held' },
      { coachId: 'cammy', date: '2026-10-19', startMinutes: 1050, durationMinutes: 30, status: 'declined' },
      { coachId: 'cammy', date: '2026-10-19', startMinutes: 1080, durationMinutes: 30, status: 'cancelled' },
    ] }))
    expect(at(free, '2026-10-19', 'cammy')).toEqual([960, 1050, 1080, 1110, 1140])
  })
  it('a session that straddles two steps blocks both', () => {
    const free = freeSessions(base({ sessions: [{ coachId: 'cammy', date: '2026-10-19', startMinutes: 1005, durationMinutes: 30, status: 'scheduled' }] }))
    expect(at(free, '2026-10-19', 'cammy')).toEqual([960, 1050, 1080, 1110, 1140])
  })
  it('a coach busy at another venue is busy everywhere', () => {
    const free = freeSessions(base({
      coachHours: [
        { coachId: 'cammy', venueId: 'v-port', weekday: 4, startMinutes: 960, endMinutes: 1020, effectiveFrom: '2026-01-01' },
        { coachId: 'cammy', venueId: 'v-saug', weekday: 4, startMinutes: 960, endMinutes: 1020, effectiveFrom: '2026-01-01' },
      ],
      sessions: [{ coachId: 'cammy', date: '2026-10-22', startMinutes: 960, durationMinutes: 30, status: 'scheduled' }],
    }))
    expect(free.filter((s) => s.date === '2026-10-22' && s.coachId === 'cammy').map((s) => [s.venueId, s.startMinutes]))
      .toEqual([['v-port', 990], ['v-saug', 990]])
  })
})

describe('additions and filters', () => {
  it('extra hours go on sale, but not on a closed venue', () => {
    const extra = { coachId: 'cammy', date: '2026-10-24', kind: 'extra' as const, venueId: 'v-port', startMinutes: 600, endMinutes: 660 } // Sat 10–11
    const venuesOpenSat: VenueRow[] = [{ id: 'v-port', weeklyHours: { ...portobello.weeklyHours, sat: [['09:00', '13:00']] } }, saughton]
    expect(at(freeSessions(base({ exceptions: [extra], venues: venuesOpenSat })), '2026-10-24', 'cammy')).toEqual([600, 630])
    expect(at(freeSessions(base({ exceptions: [extra], venues: venuesOpenSat, closures: [{ venueId: 'v-port', closedOn: '2026-10-24' }] })), '2026-10-24')).toEqual([])
  })
  it('filters by coach, venue, weekday and after-time', () => {
    const free = freeSessions(base({ filters: { coachId: 'cammy', weekdays: [5], afterMinutes: 1020 } }))
    expect(free.every((s) => s.coachId === 'cammy' && s.weekday === 5 && s.startMinutes >= 1020)).toBe(true)
    expect(free.length).toBe(4) // Fri 17:00, 17:30, 18:00, 18:30
    expect(freeSessions(base({ filters: { venueIds: ['v-saug'] } })).every((s) => s.venueId === 'v-saug')).toBe(true)
  })
  it('hides the past and the next two hours, in London time', () => {
    // Mon 19 Oct 16:45 BST = 15:45Z. Two hours notice → nothing before 18:45.
    const free = freeSessions(base({ now: new Date('2026-10-19T15:45:00Z') }))
    expect(at(free, '2026-10-19', 'cammy')).toEqual([1140])
    expect(at(free, '2026-10-23', 'cammy').length).toBe(7)
  })
  it('is the same engine used to guard a hold', () => {
    const input = base({ sessions: [{ coachId: 'cammy', date: '2026-10-19', startMinutes: 990, durationMinutes: 30, status: 'scheduled' }] })
    expect(isFree(input, { date: '2026-10-19', startMinutes: 960, coachId: 'cammy', venueId: 'v-port' })).toBe(true)
    expect(isFree(input, { date: '2026-10-19', startMinutes: 990, coachId: 'cammy', venueId: 'v-port' })).toBe(false)
    expect(isFree(input, { date: '2026-10-19', startMinutes: 960, coachId: 'cammy', venueId: 'v-saug' })).toBe(false)
  })
  it('refuses a silly window', () => {
    expect(() => freeSessions(base({ from: '2026-01-01', to: '2026-12-31' }))).toThrow(/too wide/)
    expect(freeSessions(base({ from: '2026-10-25', to: '2026-10-19' }))).toEqual([])
  })
})
