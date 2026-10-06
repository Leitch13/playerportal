import { describe, expect, it } from 'vitest'
import { seatForNewSlot, seatForSession } from './seats'
import { seatClashMessage } from './seats'

const one = (id: string) => ({ id, session_type: 'one_to_one' as const, pair_seat: 0 })
const two = (id: string, seat: number) => ({ id, session_type: 'two_to_one' as const, pair_seat: seat })

describe('seatForNewSlot', () => {
  it('puts a 1-to-1 on a free time in seat 0', () => {
    expect(seatForNewSlot([], 'one_to_one')).toEqual({ ok: true, seat: 0, pairWith: null })
  })
  it('refuses a second 1-to-1 on the same time', () => {
    expect(seatForNewSlot([one('a')], 'one_to_one').ok).toBe(false)
  })
  it('puts the first 2-to-1 keeper in seat 1', () => {
    expect(seatForNewSlot([], 'two_to_one')).toEqual({ ok: true, seat: 1, pairWith: null })
  })
  it('puts the second 2-to-1 keeper in the other seat and pairs them', () => {
    expect(seatForNewSlot([two('a', 1)], 'two_to_one')).toEqual({ ok: true, seat: 2, pairWith: 'a' })
    expect(seatForNewSlot([two('a', 2)], 'two_to_one')).toEqual({ ok: true, seat: 1, pairWith: 'a' })
  })
  it('refuses a third keeper', () => {
    expect(seatForNewSlot([two('a', 1), two('b', 2)], 'two_to_one').ok).toBe(false)
  })
  it('never mixes a 1-to-1 and a 2-to-1 on one time', () => {
    expect(seatForNewSlot([one('a')], 'two_to_one').ok).toBe(false)
    expect(seatForNewSlot([two('a', 1)], 'one_to_one').ok).toBe(false)
  })
})

describe('seatForSession', () => {
  it('gives a moved or one-off session a free seat, or none', () => {
    expect(seatForSession([], 'one_to_one')).toBe(0)
    expect(seatForSession([two('a', 1)], 'two_to_one')).toBe(2)
    expect(seatForSession([two('a', 2)], 'two_to_one')).toBe(1)
    expect(seatForSession([two('a', 1), two('b', 2)], 'two_to_one')).toBeNull()
    expect(seatForSession([one('a')], 'two_to_one')).toBeNull()
    expect(seatForSession([two('a', 1)], 'one_to_one')).toBeNull()
  })
})

describe('seatClashMessage: the refusal, with the names in it', () => {
  const when = 'Fri 15:45'
  it('a full pair names the coach, the time and both keepers, and says to pick another coach', () => {
    const m = seatClashMessage({ coachName: 'Calum', when, type: 'two_to_one', taken: [{ session_type: 'two_to_one', keeper: 'Alex' }, { session_type: 'two_to_one', keeper: 'Oliver' }] })
    expect(m).toBe('Calum already has two keepers at Fri 15:45: Alex and Oliver. Nothing was saved. Choose a different coach for this pair. The same day, time and venue are fine.')
  })
  it('a 1-to-1 in the way names who it is with', () => {
    expect(seatClashMessage({ coachName: 'Brodie', when, type: 'two_to_one', taken: [{ session_type: 'one_to_one', keeper: 'Zack' }] })).toContain('Brodie already has a 1-to-1 at Fri 15:45 with Zack. Nothing was saved.')
    expect(seatClashMessage({ coachName: 'Brodie', when, type: 'one_to_one', taken: [{ session_type: 'one_to_one', keeper: 'Zack' }] })).toContain('Choose a different coach or a different time.')
  })
  it('adding a 1-to-1 where a 2-to-1 runs explains how to join the pair', () => {
    expect(seatClashMessage({ coachName: 'Matthew', when, type: 'one_to_one', taken: [{ session_type: 'two_to_one', keeper: 'Archie' }] })).toContain('choose 2-to-1 as the type')
  })
  it('still reads properly with no names to hand', () => {
    expect(seatClashMessage({ coachName: '', when, type: 'two_to_one', taken: [{ session_type: 'two_to_one' }, { session_type: 'two_to_one', keeper: null }] })).toBe('That coach already has two keepers at Fri 15:45. Nothing was saved. Choose a different coach for this pair. The same day, time and venue are fine.')
  })
})
