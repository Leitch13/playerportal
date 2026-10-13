import { describe, it, expect } from 'vitest'
import { backupContactProblem, samePhone, latestBackups, backupContactPath, tidyBackup } from './camp-backup-contact'

describe('a backup contact on a camp booking', () => {
  const ok = { name: 'Gran Milne', phone: '07700 900456', parentPhone: '07700 900123' }
  it('a second adult with their own number is fine', () => { expect(backupContactProblem(ok)).toBeNull() })
  it('needs a name', () => { expect(backupContactProblem({ ...ok, name: ' ' })).toMatch(/name of a second adult/) })
  it('needs a real number', () => { expect(backupContactProblem({ ...ok, phone: '123' })).toMatch(/phone number for your backup/) })
  it('cannot be the parent’s own number', () => { expect(backupContactProblem({ ...ok, phone: '07700 900123' })).toMatch(/same as your own/) })
  it('cannot be the parent’s own number written the international way', () => { expect(backupContactProblem({ ...ok, phone: '+44 7700 900123' })).toMatch(/same as your own/) })
  it('is still checked when the parent gave no number', () => { expect(backupContactProblem({ name: 'Gran', phone: '07700 900456', parentPhone: '' })).toBeNull() })
})

describe('telling two numbers apart', () => {
  it('07… and +44 7… are the same phone', () => { expect(samePhone('07700 900123', '+447700900123')).toBe(true) })
  it('different phones are different', () => { expect(samePhone('07700 900123', '07700 900124')).toBe(false) })
  it('an empty number matches nothing', () => { expect(samePhone('', '')).toBe(false) })
})

describe('what the register reads', () => {
  it('the latest contact for each booking wins', () => {
    const m = latestBackups([
      { entity_id: 'b1', created_at: '2026-10-13T10:00:00Z', details: { name: 'Gran', phone: '1' + '0'.repeat(7) } },
      { entity_id: 'b1', created_at: '2026-10-14T10:00:00Z', details: { name: 'Uncle Rab', phone: '07700 900999' } },
      { entity_id: 'b2', created_at: '2026-10-13T10:00:00Z', details: {} },
    ])
    expect(m.get('b1')).toEqual({ name: 'Uncle Rab', phone: '07700 900999' }); expect(m.has('b2')).toBe(false)
  })
  it('the link carries no personal details', () => { expect(backupContactPath('wlfa', 'abc')).toBe('/book/wlfa/camps/backup/abc') })
  it('tidies spacing and length', () => { expect(tidyBackup({ name: '  Gran   Milne ', phone: ' 07700 900456 ' })).toEqual({ name: 'Gran Milne', phone: '07700 900456' }) })
})
