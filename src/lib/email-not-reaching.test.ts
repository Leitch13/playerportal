import { describe, it, expect } from 'vitest'
import { reachLine } from './email-not-reaching'

describe('reachLine', () => {
  it('blocked', () => expect(reachLine({ event: 'suppressed', at: '2026-11-01T06:00:00Z', subject: null })).toBe("Emails aren't reaching them (blocked 1 Nov). WhatsApp or call instead."))
  it('bounced', () => expect(reachLine({ event: 'bounced', at: '2026-10-20T10:00:00Z', subject: null })).toContain('(bounced 20 Oct)'))
  it('spam', () => expect(reachLine({ event: 'complained', at: '2026-10-20T10:00:00Z', subject: null })).toContain('marked as spam'))
})
