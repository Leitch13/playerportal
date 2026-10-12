import { describe, it, expect } from 'vitest'
import { campDetailsProblem, validChildDob, validPhone, hasMedicalNote, NOTHING_TO_REPORT } from './camp-booking-details'

const T = '2026-10-12'
const ok = { childDob: '2017-05-05', parentPhone: '07700 900123', medicalInfo: 'Asthma, has inhaler', collectMedical: true, today: T }

describe('what a camp booking must include', () => {
  it('a complete booking goes ahead', () => { expect(campDetailsProblem(ok)).toBeNull() })
  it('no date of birth is refused (61 of 108 day bookings had none)', () => {
    expect(campDetailsProblem({ ...ok, childDob: '' })).toMatch(/date of birth/)
    expect(campDetailsProblem({ ...ok, childDob: null })).toMatch(/date of birth/)
  })
  it('no phone number is refused', () => {
    expect(campDetailsProblem({ ...ok, parentPhone: '' })).toMatch(/phone number/)
    expect(campDetailsProblem({ ...ok, parentPhone: '0770' })).toMatch(/phone number/)
  })
  it('a blank medical answer is refused, "Nothing to report" is an answer', () => {
    expect(campDetailsProblem({ ...ok, medicalInfo: '   ' })).toMatch(/medical/)
    expect(campDetailsProblem({ ...ok, medicalInfo: NOTHING_TO_REPORT })).toBeNull()
  })
  it('a camp that does not ask for medical information does not demand it', () => {
    expect(campDetailsProblem({ ...ok, medicalInfo: '', collectMedical: false })).toBeNull()
  })
})

describe('date of birth', () => {
  it('accepts a child', () => { expect(validChildDob('2024-03-16', T)).toBe(true); expect(validChildDob('2008-01-01', T)).toBe(true) })
  it('refuses today, the future, an adult, and nonsense', () => {
    expect(validChildDob(T, T)).toBe(false)
    expect(validChildDob('2027-01-01', T)).toBe(false)
    expect(validChildDob('1990-06-01', T)).toBe(false)
    expect(validChildDob('2017-02-31', T)).toBe(false)
    expect(validChildDob('05/05/2017', T)).toBe(false)
  })
})

describe('phone number', () => {
  it('accepts the ways parents type one', () => { for (const p of ['07700 900123', '+44 7700 900123', '(01224) 123456', '07700-900-123']) expect(validPhone(p)).toBe(true) })
  it('refuses too short, too long, or no digits', () => { for (const p of ['12345', 'n/a', '', '1234567890123456']) expect(validPhone(p)).toBe(false) })
})

describe('the register only flags a real medical note', () => {
  it('"Nothing to report" is not a note', () => { expect(hasMedicalNote(NOTHING_TO_REPORT)).toBe(false); expect(hasMedicalNote(' nothing to report ')).toBe(false); expect(hasMedicalNote(null)).toBe(false) })
  it('anything else is', () => { expect(hasMedicalNote('Nut allergy')).toBe(true) })
})
