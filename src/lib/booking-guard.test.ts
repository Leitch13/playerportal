import { describe, it, expect } from 'vitest'
import { checkBookingDetails, phoneLooksReal } from './booking-guard'

const ok = { parentName: 'Courtney', childName: 'Blake Smith', email: 'courtney.s@gmail.com', phone: '07700 900123' }

// 5 Nov 2026: "A / a@gmail.com / no phone" reached Pro Football Coaching; same at Talent 7 Sep, WLFA 7 Oct.
describe('booking door check', () => {
  it('turns away the fake bookings we actually got', () => {
    expect(checkBookingDetails({ parentName: 'A', childName: 'A', email: 'a@gmail.com', phone: '' })).not.toBeNull()
    expect(checkBookingDetails({ parentName: 'a', childName: 'b', email: 'ab@gmail.com', phone: '' })).not.toBeNull()
    expect(checkBookingDetails({ ...ok, email: 'da@gmail.com' })).not.toBeNull()
    expect(checkBookingDetails({ ...ok, phone: 'a' })).not.toBeNull()
  })
  it('lets real families through, including first-name-only parents', () => {
    expect(checkBookingDetails(ok)).toBeNull()
    expect(checkBookingDetails({ ...ok, parentName: 'Kieran ' })).toBeNull()
    expect(checkBookingDetails({ ...ok, parentName: 'Weronika', email: 'jo@tiscali.co.uk' })).toBeNull()
    expect(checkBookingDetails({ ...ok, parentName: "Siobhán O'Neill" })).toBeNull()
  })
  it('asks for a name when the email was typed into the name box', () => {
    expect(checkBookingDetails({ ...ok, parentName: 'nadinecurran7@hotmail.com' })).toBe('Please enter your name.')
  })
  it('needs a real phone number', () => {
    expect(phoneLooksReal('07700 900123')).toBe(true)
    expect(phoneLooksReal('+44 (0)7700-900123')).toBe(true)
    expect(phoneLooksReal('0000000000')).toBe(false)
    expect(phoneLooksReal('0123456789')).toBe(false)
    expect(phoneLooksReal('123')).toBe(false)
    expect(phoneLooksReal('')).toBe(false)
  })

  it('accepts numbers and names with invisible marks or Arabic digits (Rosa Sports, 21 Nov 2026)', () => {
    expect(phoneLooksReal('\u200f07700900123')).toBe(true)
    expect(phoneLooksReal('\u202a+44 7700 900123\u202c')).toBe(true)
    expect(phoneLooksReal('٠٧٧٠٠٩٠٠١٢٣')).toBe(true)
    expect(phoneLooksReal('۰۷۷۰۰۹۰۰۱۲۳')).toBe(true)
    expect(checkBookingDetails({ ...ok, parentName: '\u200fsajeda', childName: 'hosen', phone: '\u200f447700900123' })).toBeNull()
    expect(phoneLooksReal('\u200f\u200f')).toBe(false)
  })
})
