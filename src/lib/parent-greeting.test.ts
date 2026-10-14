import { describe, it, expect } from 'vitest'
import { greetingFor, ukDateLabel, todayLine, directionsUrl } from './parent-greeting'

describe('the greeting', () => {
  it('never uses a name, so a family account is never greeted by its surname', () => { for (const h of [6, 13, 20]) expect(greetingFor(new Date(Date.UTC(2026, 9, 14, h)))).not.toMatch(/Milne|,/) })
  it('morning, afternoon and evening in UK time (BST in October)', () => {
    expect(greetingFor(new Date('2026-10-14T10:30:00Z'))).toBe('Good morning') // 11:30 UK
    expect(greetingFor(new Date('2026-10-14T11:30:00Z'))).toBe('Good afternoon') // 12:30 UK
    expect(greetingFor(new Date('2026-10-14T17:30:00Z'))).toBe('Good evening') // 18:30 UK
  })
  it('uses GMT in winter', () => { expect(greetingFor(new Date('2026-12-14T11:30:00Z'))).toBe('Good morning') })
  it('the date reads like a person wrote it', () => { expect(ukDateLabel(new Date('2026-10-14T08:00:00Z'))).toBe('Wednesday 14 October') })
})

describe('the line about today', () => {
  it('an evening session today is tonight, with the child’s first name', () => { expect(todayLine({ label: 'Today, 17:30', child: 'Oscar Milne' })).toBe('Oscar has training tonight.') })
  it('a morning session today is today', () => { expect(todayLine({ label: 'Today, 09:30', child: 'Oscar Milne' })).toBe('Oscar has training today.') })
  it('another day says which', () => { expect(todayLine({ label: 'Sat, 10:00', child: 'Ava Reid' })).toBe("Ava's next session is Sat at 10:00.") })
  it('nothing booked says nothing', () => { expect(todayLine(null)).toBeNull() })
})

describe('directions', () => {
  it('a venue becomes a maps link', () => { expect(directionsUrl('Aberdeen Sports Village')).toBe('https://www.google.com/maps/search/?api=1&query=Aberdeen%20Sports%20Village') })
  it('no venue, no link', () => { expect(directionsUrl('  ')).toBeNull() })
})
