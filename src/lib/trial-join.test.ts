import { describe, it, expect } from 'vitest'
import { trialJoinPath, trialSignupPath, splitChildName, joinLinkProblem } from './trial-join'

describe('the joining link', () => {
  it('is one address per trial and carries no personal details', () => {
    const link = trialJoinPath('talentfa', '531523e0-383f-4e37-9bb7-0ee7e79b0a8c')
    expect(link).toBe('/book/talentfa/join/531523e0-383f-4e37-9bb7-0ee7e79b0a8c')
    expect(link).not.toMatch(/@|email|name/)
  })
  it('opens sign-up for that academy with the trial class chosen', () => {
    expect(trialSignupPath('JSL', 't1', 'c1')).toBe('/auth/signup?org=JSL&class=c1&tj=t1')
  })
  it('still opens sign-up when the trial had no class, or the class is closed', () => {
    expect(trialSignupPath('JSL', 't1', null)).toBe('/auth/signup?org=JSL&tj=t1')
  })
})

describe('filling in the child', () => {
  it('splits a full name, tidying spaces', () => { expect(splitChildName(' Henrique  de Freitas ')).toEqual({ first: 'Henrique', last: 'de Freitas' }) })
  it('a single name is a first name', () => { expect(splitChildName('Archie')).toEqual({ first: 'Archie', last: '' }) })
  it('nothing in, nothing out', () => { expect(splitChildName(null)).toEqual({ first: '', last: '' }) })
})

describe('who can be sent the link', () => {
  it('an attended trial with an email', () => { expect(joinLinkProblem({ status: 'attended', converted: false, parent_email: 'a@b.com' })).toBeNull() })
  it('not a family that has already joined', () => { expect(joinLinkProblem({ converted: true, parent_email: 'a@b.com' })).toMatch(/already joined/) })
  it('not a trial with no email — the academy is told to text it', () => { expect(joinLinkProblem({ converted: false, parent_email: '' })).toMatch(/by text/) })
  it('not a trial that does not exist', () => { expect(joinLinkProblem(null)).toMatch(/could not be found/) })
})
