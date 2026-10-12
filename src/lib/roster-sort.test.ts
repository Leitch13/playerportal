import { describe, it, expect } from 'vitest'
import { sortRoster, agesPresent, onlyAge } from './roster-sort'

const kids = [{ n: 'tyler smith', a: 8 }, { n: 'Adam Majid', a: 9 }, { n: 'Jacob', a: null }, { n: 'JohnGabriel Marino', a: 10 }, { n: 'Adam James Irvine', a: 9 }]
const names = (l: typeof kids) => l.map((k) => k.n)
const N = (k: (typeof kids)[number]) => k.n, A = (k: (typeof kids)[number]) => k.a

describe('ordering a register', () => {
  it('A–Z ignores capitals', () => { expect(names(sortRoster(kids, 'name', N, A))).toEqual(['Adam James Irvine', 'Adam Majid', 'Jacob', 'JohnGabriel Marino', 'tyler smith']) })
  it('youngest first, same age by name, no age last', () => { expect(names(sortRoster(kids, 'youngest', N, A))).toEqual(['tyler smith', 'Adam James Irvine', 'Adam Majid', 'JohnGabriel Marino', 'Jacob']) })
  it('oldest first, no age still last', () => { expect(names(sortRoster(kids, 'oldest', N, A))).toEqual(['JohnGabriel Marino', 'Adam James Irvine', 'Adam Majid', 'tyler smith', 'Jacob']) })
  it('booked order is left as it came, and the original list is never changed', () => { const before = names(kids); expect(names(sortRoster(kids, 'booked', N, A))).toEqual(before); sortRoster(kids, 'name', N, A); expect(names(kids)).toEqual(before) })
})

describe('narrowing to one age', () => {
  it('lists the ages on the register with a count', () => { expect(agesPresent(kids, A)).toEqual([{ age: 8, count: 1 }, { age: 9, count: 2 }, { age: 10, count: 1 }]) })
  it('shows only that age, or everyone', () => { expect(names(onlyAge(kids, 9, A))).toEqual(['Adam Majid', 'Adam James Irvine']); expect(onlyAge(kids, 'all', A)).toHaveLength(5) })
})
