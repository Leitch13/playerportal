import { describe, it, expect } from 'vitest'
import { reportStatus, savedReportMessage } from './report-status'

describe('what the academy sees on a report', () => {
  it('emailed and opened', () => {
    const s = reportStatus({ emailed_at: '2026-10-13T09:00:00Z', viewed_at: '2026-10-14T18:30:00Z', parentEmail: 'amy@example.com', parentName: 'Amy Freitas' })
    expect(s.sent).toEqual({ ok: true, text: 'Emailed to Amy 13 Oct' })
    expect(s.seen).toEqual({ ok: true, text: 'Seen by Amy 14 Oct' })
  })
  it('emailed, not opened yet', () => { expect(reportStatus({ emailed_at: '2026-10-13T09:00:00Z', parentEmail: 'a@b.com', parentName: 'Amy' }).seen).toEqual({ ok: false, text: 'Not opened yet' }) })
  it('never says emailed when it was not', () => {
    const s = reportStatus({ emailed_at: null, parentEmail: 'a@b.com', parentName: 'Amy' })
    expect(s.sent).toEqual({ ok: false, text: 'Not emailed to Amy yet' }); expect(s.canSend).toBe(true)
  })
  it('says why when the parent has no email, and offers no send button', () => {
    const s = reportStatus({ emailed_at: null, parentEmail: null, parentName: 'Amy' })
    expect(s.sent.text).toBe('Not emailed: no email address for this parent'); expect(s.canSend).toBe(false)
  })
  it('copes with no parent name', () => { expect(reportStatus({ emailed_at: '2026-10-13T09:00:00Z', parentEmail: 'a@b.com' }).sent.text).toBe('Emailed to the parent 13 Oct') })
  it('uses the UK date for a late-evening send', () => { expect(reportStatus({ emailed_at: '2026-07-13T23:30:00Z', parentEmail: 'a@b.com', parentName: 'Amy' }).sent.text).toBe('Emailed to Amy 14 Jul') })
})

describe('what the coach is told on saving', () => {
  it('sent', () => { expect(savedReportMessage('Oscar Milne', { emailed: true })).toEqual({ ok: true, text: 'Report saved for Oscar Milne and emailed to the parent.' }) })
  it('no email address', () => { const m = savedReportMessage('Oscar Milne', { emailed: false, reason: 'No parent email' }); expect(m.ok).toBe(false); expect(m.text).toMatch(/no email address for this parent/) })
  it('send failed', () => { expect(savedReportMessage('Oscar Milne', { emailed: false, reason: 'boom' }).text).toMatch(/could not be sent/) })
})
