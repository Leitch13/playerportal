import { describe, it, expect } from 'vitest'
import { plansForClass, plansForClasses } from './plans-for-class'

const P = (id: string, g: string | null = null, t: string | null = null) => ({ id, training_group_id: g, class_type: t })

describe('plansForClasses', () => {
  const plans = [P('own-a', 'a'), P('own-b', 'b'), P('elite-1', null, 'elite'), P('elite-2', null, 'elite'), P('any')]

  it('a class with its own plan offers only that plan', () => {
    expect(plansForClasses(plans, [{ id: 'a', class_type: 'elite' }]).map((p) => p.id)).toEqual(['own-a'])
  })
  it('no own plan: the plans for that class type', () => {
    expect(plansForClasses(plans, [{ id: 'z', class_type: 'elite' }]).map((p) => p.id)).toEqual(['elite-1', 'elite-2'])
  })
  it('no own plan and no type plan: the any-class plans', () => {
    expect(plansForClasses(plans, [{ id: 'z', class_type: 'gk' }]).map((p) => p.id)).toEqual(['any'])
    expect(plansForClasses(plans, [{ id: 'z', class_type: null }]).map((p) => p.id)).toEqual(['any'])
  })
  it('two classes: the plans of both, in the academy order', () => {
    expect(plansForClasses(plans, [{ id: 'b' }, { id: 'a' }]).map((p) => p.id)).toEqual(['own-a', 'own-b'])
  })
  it('never empty: no class, or nothing fits, offers every plan', () => {
    expect(plansForClasses(plans, [])).toHaveLength(5)
    const onlyOwn = [P('own-a', 'a'), P('own-b', 'b')]
    expect(plansForClass(onlyOwn, { id: 'z' })).toEqual([])
    expect(plansForClasses(onlyOwn, [{ id: 'z' }])).toHaveLength(2)
  })
})
