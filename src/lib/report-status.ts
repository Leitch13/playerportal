/**
 * What an academy is told about a player report after it is written.
 *
 * Until 13 Oct 2026 the coach saw "Review published" whether or not the
 * parent's email went, and the list showed neither "sent" nor "seen". John:
 * "does it update the academy to say they've sent it?" It didn't.
 *
 * Reads the two times the report already keeps: emailed_at (set when the
 * parent's email is accepted for delivery) and viewed_at (set the first time
 * the parent opens the report). Pure, so the page and its tests agree.
 */
export interface ReportStatusInput { emailed_at?: string | null; viewed_at?: string | null; parentEmail?: string | null; parentName?: string | null }

const short = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/London' })
const firstName = (n: string | null | undefined) => (n || '').trim().split(/\s+/)[0] || 'the parent'

export function reportStatus(r: ReportStatusInput) {
  const hasEmail = (r.parentEmail || '').includes('@')
  const who = firstName(r.parentName)
  const sent = r.emailed_at
    ? { ok: true, text: `Emailed to ${who} ${short(r.emailed_at)}` }
    : hasEmail
      ? { ok: false, text: `Not emailed to ${who} yet` }
      : { ok: false, text: 'Not emailed: no email address for this parent' }
  const seen = r.viewed_at ? { ok: true, text: `Seen by ${who} ${short(r.viewed_at)}` } : { ok: false, text: 'Not opened yet' }
  return { sent, seen, canSend: hasEmail }
}

/** What the coach reads the moment they save a report. Never claims an email that did not go. */
export function savedReportMessage(childName: string, email: { emailed: boolean; reason?: string | null }): { ok: boolean; text: string } {
  if (email.emailed) return { ok: true, text: `Report saved for ${childName} and emailed to the parent.` }
  const why = /no parent email/i.test(email.reason || '') ? 'there is no email address for this parent' : 'the email could not be sent'
  return { ok: false, text: `Report saved for ${childName}, but ${why}. It is on their parent portal. You can send the email again from the list below.` }
}
