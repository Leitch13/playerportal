import { describe, it, expect } from 'vitest'
import { countSessionsBetween, tonightBridge, sessionsPerMonthFor, estimateBridgePence } from './sessions'

// The billing anchor is always the 1st of the next calendar month (exclusive).
const SEP1 = '2026-09-01'

describe('countSessionsBetween', () => {
  it('counts class-day occurrences in [start, anchor)', () => {
    // Fridays 14, 21, 28 Aug before 1 Sep
    expect(countSessionsBetween('2026-08-14', SEP1, 'Friday')).toBe(3)
    // inclusive of start day when it is a class day
    expect(countSessionsBetween('2026-08-28', SEP1, 'Friday')).toBe(1)
    // exclusive of the anchor day itself
    expect(countSessionsBetween('2026-09-01', SEP1, 'Tuesday')).toBe(0)
    // no more class days left this month
    expect(countSessionsBetween('2026-08-29', SEP1, 'Friday')).toBe(0)
  })
  it('returns 0 for null/invalid day', () => {
    expect(countSessionsBetween('2026-08-14', SEP1, null)).toBe(0)
    expect(countSessionsBetween('2026-08-14', SEP1, 'Notaday')).toBe(0)
  })
})

describe('tonightBridge — charge the sessions left this month, capped at a month', () => {
  it('Matthew case: £32/mo, join Fri 14 Aug, 3 Fridays left → £24 (not the old £8)', () => {
    const b = tonightBridge(32, '2026-08-14', SEP1, 'Friday')
    expect(b.sessions).toBe(3)
    expect(b.perSessionPence).toBe(800) // £32 ÷ 4
    expect(b.pence).toBe(2400) // 3 × £8
  })

  it('caps at one full month when 5 class-days remain', () => {
    // Saturdays 1,8,15,22,29 Aug = 5; 5 × £8 = £40 > £32 → capped
    const b = tonightBridge(32, '2026-08-01', SEP1, 'Saturday')
    expect(b.sessions).toBe(5)
    expect(b.pence).toBe(3200) // capped at £32, never more than a month
  })

  it('never charges LESS than before: single-session fallback when no more sessions left', () => {
    const b = tonightBridge(32, '2026-08-29', SEP1, 'Friday')
    expect(b.sessions).toBe(0)
    expect(b.pence).toBe(800) // falls back to one session
  })

  it('single-session fallback when the class has no set day', () => {
    const b = tonightBridge(32, '2026-08-14', SEP1, null)
    expect(b.sessions).toBe(0)
    expect(b.pence).toBe(800)
  })

  it('handles non-round monthly amounts (£42/mo, 3 sessions)', () => {
    const b = tonightBridge(42, '2026-08-14', SEP1, 'Friday')
    expect(b.perSessionPence).toBe(1050) // round(£42/4) = £10.50
    expect(b.pence).toBe(3150) // 3 × £10.50 = £31.50 < £42
  })

  it('preview and charge use THIS function → they cannot diverge (identity check)', () => {
    // Same inputs the route and the picker pass must give the same pence.
    const inputs = { m: 32, start: '2026-08-14', anchor: SEP1, day: 'Friday' as const }
    const a = tonightBridge(inputs.m, inputs.start, inputs.anchor, inputs.day)
    const b = tonightBridge(inputs.m, inputs.start, inputs.anchor, inputs.day)
    expect(a.pence).toBe(b.pence)
  })
})

describe('sessionsPerMonthFor — counting instead of asking', () => {
  it('counts the weekday occurrences in the month', () => {
    // September 2026 has 5 Tuesdays (1, 8, 15, 22, 29)
    expect(sessionsPerMonthFor('Tuesday', new Date('2026-09-02T00:00:00Z'))).toBe(5)
    // and 4 Thursdays (3, 10, 17, 24)
    expect(sessionsPerMonthFor('Thursday', new Date('2026-09-02T00:00:00Z'))).toBe(4)
  })

  it('is stable wherever in the month you ask from', () => {
    const first = sessionsPerMonthFor('Saturday', new Date('2026-09-01T00:00:00Z'))
    const last = sessionsPerMonthFor('Saturday', new Date('2026-09-30T00:00:00Z'))
    expect(first).toBe(last)
  })

  it('returns null only when there is no class day to count', () => {
    expect(sessionsPerMonthFor(null, new Date('2026-09-02T00:00:00Z'))).toBeNull()
    expect(sessionsPerMonthFor('Funday', new Date('2026-09-02T00:00:00Z'))).toBeNull()
  })
})

describe('estimateBridgePence — a blank sessions_per_month no longer disables session billing', () => {
  // The case that sent Gold & Gray to calendar billing: 27 plans, none with
  // sessions_per_month, so every mid-month joiner was charged by day.
  it('derives the per-session price when the plan has not set one', () => {
    const b = estimateBridgePence({
      monthlyPence: 9600,             // £96 Intensity Membership
      sessionsPerMonth: null,         // never filled in
      classDayOfWeek: 'Saturday',
      startDate: new Date('2026-09-02T00:00:00Z'),
    })
    expect(b).not.toBeNull()
    // September 2026 has 4 Saturdays → £24 a session
    expect(b!.perSessionPence).toBe(2400)
    // 4 remain from 2 Sep → £96, capped at the month
    expect(b!.sessionsRemaining).toBe(4)
    expect(b!.bridgePence).toBe(9600)
  })

  it('charges only the sessions left, not the whole month', () => {
    const b = estimateBridgePence({
      monthlyPence: 9600,
      sessionsPerMonth: null,
      classDayOfWeek: 'Saturday',
      startDate: new Date('2026-09-20T00:00:00Z'),   // 2 Saturdays left (26 Sep... and 20th is a Sunday)
    })
    expect(b).not.toBeNull()
    expect(b!.bridgePence).toBeLessThan(9600)
  })

  it('an explicit sessions_per_month still wins over the derived count', () => {
    const derived = estimateBridgePence({
      monthlyPence: 12000, sessionsPerMonth: null,
      classDayOfWeek: 'Tuesday', startDate: new Date('2026-09-01T00:00:00Z'),
    })
    const explicit = estimateBridgePence({
      monthlyPence: 12000, sessionsPerMonth: 4,
      classDayOfWeek: 'Tuesday', startDate: new Date('2026-09-01T00:00:00Z'),
    })
    // 5 Tuesdays in September → derived is £24, the academy's stated figure is £30
    expect(derived!.perSessionPence).toBe(2400)
    expect(explicit!.perSessionPence).toBe(3000)
  })

  it('still refuses when there is no class day — nothing to count', () => {
    expect(estimateBridgePence({
      monthlyPence: 9600, sessionsPerMonth: null,
      classDayOfWeek: null, startDate: new Date('2026-09-02T00:00:00Z'),
    })).toBeNull()
  })

  it('never charges more than a full month', () => {
    const b = estimateBridgePence({
      monthlyPence: 4200, sessionsPerMonth: 2,   // £21 a session, but 5 Tuesdays
      classDayOfWeek: 'Tuesday', startDate: new Date('2026-09-01T00:00:00Z'),
    })
    expect(b!.uncappedPence).toBeGreaterThan(4200)
    expect(b!.bridgePence).toBe(4200)
    expect(b!.capApplied).toBe(true)
  })
})
