import { describe, it, expect } from 'vitest'
import { sellsSingleDays, wholeCampDiscount, wholeCampSeatsLeft, daySeatsLeft, busiestDaySeats } from './flexible-camps'

describe('sellsSingleDays', () => {
  it('a whole-camp camp with a day price sells days too', () => {
    expect(sellsSingleDays({ booking_mode: 'whole_camp', flex_price_per_day: 25 })).toBe(true)
    expect(sellsSingleDays({ booking_mode: 'whole_camp', flex_price_per_day: '25.00' })).toBe(true)
  })
  it('a plain whole-camp camp or a flexible camp does not', () => {
    expect(sellsSingleDays({ booking_mode: 'whole_camp', flex_price_per_day: null })).toBe(false)
    expect(sellsSingleDays({ booking_mode: 'flexible_days', flex_price_per_day: 25 })).toBe(false)
  })
})

describe('wholeCampDiscount', () => {
  const five = [25, 25, 25, 25, 25]
  it('every day picked and the week is cheaper → the difference comes off', () => {
    expect(wholeCampDiscount({ perDayGross: five, bookableDayCount: 5, wholeCampPrice: 99 })).toBe(26)
  })
  it('not every day → per-day pricing', () => {
    expect(wholeCampDiscount({ perDayGross: [25, 25], bookableDayCount: 5, wholeCampPrice: 99 })).toBe(0)
  })
  it('no week price, or the week costs more → nothing changes', () => {
    expect(wholeCampDiscount({ perDayGross: five, bookableDayCount: 5, wholeCampPrice: null })).toBe(0)
    expect(wholeCampDiscount({ perDayGross: five, bookableDayCount: 5, wholeCampPrice: 140 })).toBe(0)
  })
  it('rounds to pence and rejects nonsense', () => {
    expect(wholeCampDiscount({ perDayGross: [33.33, 33.33, 33.33], bookableDayCount: 3, wholeCampPrice: 90 })).toBe(9.99)
    expect(wholeCampDiscount({ perDayGross: [], bookableDayCount: 0, wholeCampPrice: 99 })).toBe(0)
  })
})

describe('seats on a camp that sells weeks and days', () => {
  const ids = ['mon', 'tue', 'wed', 'thu', 'fri']
  const ryan = { maxCapacity: 30, wholeCampBookings: 6, dayBookingsByDayId: { mon: 10, tue: 3 }, dayIds: ids }
  it('a day booking sees week bookings plus that day', () => {
    expect(daySeatsLeft(ryan, 'mon')).toBe(14)
    expect(daySeatsLeft(ryan, 'wed')).toBe(24)
  })
  it('a week booking needs a seat on the busiest day', () => {
    expect(busiestDaySeats(ryan)).toBe(16)
    expect(wholeCampSeatsLeft(ryan)).toBe(14)
  })
  it('full on one day means no week places, other days still sell', () => {
    const full = { ...ryan, dayBookingsByDayId: { mon: 24 } }
    expect(wholeCampSeatsLeft(full)).toBe(0)
    expect(daySeatsLeft(full, 'tue')).toBe(24)
  })
  it('uncapped camp → null', () => {
    expect(wholeCampSeatsLeft({ ...ryan, maxCapacity: null })).toBeNull()
  })
})
