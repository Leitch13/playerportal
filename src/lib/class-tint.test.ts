import { describe, it, expect } from 'vitest'
import { classTint, classTintMap, NO_CLASS_TINT } from './class-tint'

describe('class tints', () => {
  const names = ['Goalkeeper School', 'Development Squad (7–9 yrs)', 'Development Squad (10–12 yrs)', 'Mini Kickers (4–6 yrs)']
  it('gives every class its own colour', () => {
    const t = classTintMap(names)
    expect(new Set(Object.values(t)).size).toBe(names.length)
  })
  it('does not depend on the order the classes arrive in', () => {
    expect(classTintMap(names)).toEqual(classTintMap([...names].reverse()))
  })
  it('gives no class, or an unknown class, a quiet grey', () => {
    const t = classTintMap(names)
    expect(classTint(t, null)).toBe(NO_CLASS_TINT)
    expect(classTint(t, 'Not a class')).toBe(NO_CLASS_TINT)
  })
  it('ignores blanks and repeats', () => {
    expect(Object.keys(classTintMap(['A', 'A', '', null, ' A ']))).toEqual(['A'])
  })
})
