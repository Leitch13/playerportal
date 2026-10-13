import { describe, it, expect } from 'vitest'
import { packFolder, classOfFolder, isPackFolder, packPath, packIdOfPath, pathBelongsTo, groupPacks, packsForFamily, packCoverage, packProblem, packEmailRecipients, PACK_MAX_BYTES } from './welcome-pack'

const ORG = '11111111-1111-4111-8111-111111111111', OTHER = '22222222-2222-4222-8222-222222222222'
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const row = (id: string, packId: string, folder: string, org = ORG) => ({ id, organisation_id: org, title: 'Goalscorers', description: 'Welcome', url: packPath(org, packId), folder })

describe('where a pack is kept', () => {
  it('one key per class, one for every class', () => { expect(classOfFolder(packFolder('c1'))).toBe('c1'); expect(classOfFolder(packFolder(null))).toBeNull() })
  it('an ordinary document is not a pack', () => { expect(isPackFolder('General')).toBe(false); expect(isPackFolder(null)).toBe(false) })
  it('a file path carries its academy and its pack', () => { expect(packIdOfPath(packPath(ORG, A))).toBe(A); expect(pathBelongsTo(packPath(ORG, A), ORG)).toBe(true) })
  it('a path can never reach into another academy', () => {
    expect(pathBelongsTo(packPath(OTHER, A), ORG)).toBe(false)
    expect(pathBelongsTo(`${ORG}/../${OTHER}/${A}.pdf`, ORG)).toBe(false)
    expect(pathBelongsTo(`${ORG}/notes.txt`, ORG)).toBe(false)
  })
})

describe('which packs a family sees', () => {
  const packs = groupPacks([row('r1', A, packFolder('goalscorers')), row('r2', A, packFolder('friday')), row('r3', B, packFolder(null)), row('r4', A, packFolder(null), OTHER)])
  it('rows for the same file are one pack', () => { expect(packs).toHaveLength(3); expect(packs.find((p) => p.packId === A && p.orgId === ORG)!.classIds).toEqual(['goalscorers', 'friday']) })
  it('a child in the class gets the class pack and the every-class pack', () => { expect(packsForFamily(packs, [{ orgId: ORG, classId: 'goalscorers' }]).map((p) => p.packId).sort()).toEqual([A, B].sort()) })
  it('a child in another class gets only the every-class pack', () => { expect(packsForFamily(packs, [{ orgId: ORG, classId: 'tots' }]).map((p) => p.packId)).toEqual([B]) })
  it('a family at another academy gets only that academy\'s pack', () => { expect(packsForFamily(packs, [{ orgId: OTHER, classId: 'goalscorers' }]).map((p) => p.orgId)).toEqual([OTHER]) })
  it('a family with no class place gets nothing', () => { expect(packsForFamily(packs, [])).toEqual([]) })
})

describe('who has opened it', () => {
  it('counts each parent once and names who has not', () => { expect(packCoverage(['p1', 'p2', 'p2', 'p3'], ['p2', 'someone-else'])).toEqual({ total: 3, opened: 1, notOpened: ['p1', 'p3'] }) })
  it('nobody entitled', () => { expect(packCoverage([], ['p1'])).toEqual({ total: 0, opened: 0, notOpened: [] }) })
})

describe('what an academy is told when a pack will not save', () => {
  const ok = { title: 'Goalscorers', classIds: ['c1'], fileName: 'pack.pdf', fileSize: 11_000_000, fileType: 'application/pdf' }
  it('a good pack', () => { expect(packProblem(ok)).toBeNull() })
  it('no name', () => { expect(packProblem({ ...ok, title: ' ' })).toMatch(/name/) })
  it('no class chosen', () => { expect(packProblem({ ...ok, classIds: [] })).toMatch(/classes/) })
  it('every class needs no class list', () => { expect(packProblem({ ...ok, classIds: [], everyClass: true })).toBeNull() })
  it('not a PDF', () => { expect(packProblem({ ...ok, fileName: 'pack.docx', fileType: 'application/msword' })).toMatch(/PDF/) })
  it('too big', () => { expect(packProblem({ ...ok, fileSize: PACK_MAX_BYTES + 1 })).toMatch(/30MB/) })
})

describe('who is emailed a pack', () => {
  const parents = [{ id: 'p1', email: 'amy@gmail.com' }, { id: 'p2', email: 'ben@gmail.com' }, { id: 'p2', email: 'ben@gmail.com' }, { id: 'p3', email: null }, { id: 'p4', email: 'AMY@gmail.com ' }]
  it('each parent once, even with two children in the class', () => { expect(packEmailRecipients(parents, []).map((p) => p.id)).toEqual(['p1', 'p2']) })
  it('never a parent who has already opened it', () => { expect(packEmailRecipients(parents, ['p1']).map((p) => p.id)).toEqual(['p2', 'p4']) })
  it('never a parent with no email address', () => { expect(packEmailRecipients([{ id: 'p3', email: '' }], [])).toEqual([]) })
  it('two accounts sharing one address get one email', () => { expect(packEmailRecipients([{ id: 'a', email: 'x@y.org' }, { id: 'b', email: 'X@Y.org' }], [])).toHaveLength(1) })
  it('never a demo or test address', () => { expect(packEmailRecipients([{ id: 'a', email: 'demo.oscar.milne@example.com' }, { id: 'b', email: 'test.parent1@playerportal-test.invalid' }, { id: 'c', email: 'real@outlook.com' }], []).map((p) => p.id)).toEqual(['c']) })
  it('the automatic sends never email a parent the system has already emailed', () => { expect(packEmailRecipients(parents, [], ['p1']).map((p) => p.id)).toEqual(['p2', 'p4']) })
  it('the academy pressing the button does remind them', () => { expect(packEmailRecipients(parents, []).map((p) => p.id)).toEqual(['p1', 'p2']) })
  it('nobody left to email once everyone has opened it', () => { expect(packEmailRecipients(parents, ['p1', 'p2', 'p4'])).toEqual([]) })
})
