import { describe, expect, it } from 'vitest'
import { classLabels, deriveActiveClassNames } from './players-derive'

describe('classLabels', () => {
  // No.1 GK, 3 Nov 2026: two classes called the same thing at different times showed as one sheet.
  it('keeps unique names and adds day and time to shared ones', () => {
    const l = classLabels([
      { id: 'a', name: 'Pitreavie 13-15', day_of_week: 'Friday', time_slot: '17:00–18:00' },
      { id: 'b', name: 'Pitreavie 13-15', day_of_week: 'Friday', time_slot: '18:00–19:00' },
      { id: 'c', name: 'Peffermill 7-9', day_of_week: 'Wednesday', time_slot: '18:00–19:00' },
    ])
    expect(l.get('a')).toBe('Pitreavie 13-15 · Friday 17:00–18:00')
    expect(l.get('b')).toBe('Pitreavie 13-15 · Friday 18:00–19:00')
    expect(l.get('c')).toBe('Peffermill 7-9')
    expect(deriveActiveClassNames([{ status: 'active', group: { id: 'b', name: 'Pitreavie 13-15' } }], l)).toBe('Pitreavie 13-15 · Friday 18:00–19:00')
  })
  it('never gives two classes the same label', () => {
    const l = classLabels([{ id: 'aaaa1', name: 'X', day_of_week: 'Mon', time_slot: '5pm' }, { id: 'bbbb2', name: 'X', day_of_week: 'Mon', time_slot: '5pm' }])
    expect(new Set(l.values()).size).toBe(2)
  })
})
