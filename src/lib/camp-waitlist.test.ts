import { describe, it, expect } from 'vitest'
import { parseWaitlistInput, waitlistNote, campMarker, waitingByCamp } from './camp-waitlist'

const CAMP = '11111111-1111-4111-8111-111111111111', OTHER = '22222222-2222-4222-8222-222222222222'
const good = { campId: CAMP, parentName: '  Sarah   Fraser ', email: ' Sarah@Example.com ', phone: '07700 900123', childName: 'Callum', childAge: '7' }

describe('camp waiting list', () => {
  it('tidies a good entry', () => {
    const r = parseWaitlistInput(good)
    expect(r).toEqual({ ok: true, value: { campId: CAMP, firstName: 'Sarah', lastName: 'Fraser', email: 'sarah@example.com', phone: '07700 900123', childName: 'Callum', childAge: 7 } })
  })
  it('says what is wrong in plain words', () => {
    expect(parseWaitlistInput({ ...good, campId: 'nope' })).toMatchObject({ ok: false })
    expect(parseWaitlistInput({ ...good, parentName: '' })).toEqual({ ok: false, error: 'Please enter your name.' })
    expect(parseWaitlistInput({ ...good, email: 'not-an-email' })).toEqual({ ok: false, error: 'Please enter a valid email address.' })
    expect(parseWaitlistInput({ ...good, childName: ' ' })).toMatchObject({ ok: false })
  })
  it('ignores a silly age and an over-long name rather than refusing', () => {
    const r = parseWaitlistInput({ ...good, childAge: 400, childName: 'x'.repeat(300) })
    expect(r.ok && r.value.childAge).toBeNull()
    expect(r.ok && r.value.childName.length).toBe(80)
  })
  it('ties a note to one camp and counts per camp', () => {
    expect(waitlistNote('October Camp', CAMP, '2026-10-19')).toBe(`Waiting list for October Camp (starts 2026-10-19). ${campMarker(CAMP)}`)
    const counts = waitingByCamp([{ notes: waitlistNote('A', CAMP) }, { notes: waitlistNote('A', CAMP) + ' Invited to book 8 Oct.' }, { notes: waitlistNote('B', OTHER) }, { notes: 'a normal lead' }, { notes: null }])
    expect(counts.get(CAMP)).toBe(2)
    expect(counts.get(OTHER)).toBe(1)
    expect(counts.size).toBe(2)
  })
})
