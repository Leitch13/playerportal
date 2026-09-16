/**
 * 1-2-1 Slots · emails. Plain, short, in the academy's name.
 * Uses the shared sender; no template from the class side is imported.
 */

import { sendEmail } from '@/lib/email'
import { fmtDate, hhmm } from './db'

const shell = (academy: string, body: string) => `
<div style="font-family:Inter,system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#141a22;line-height:1.5">
  <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#8a95a3;font-weight:600">${esc(academy)}</div>
  ${body}
  <p style="margin-top:28px;font-size:12px;color:#8a95a3">Sent by ${esc(academy)} via Player Portal.</p>
</div>`

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))
const gbp = (p: number) => `£${(p / 100).toFixed(2).replace(/\.00$/, '')}`

export interface SessionEmailFacts {
  academy: string; to: string; parentName: string | null; childName: string
  date: string; startMinutes: number; durationMinutes: number; coach: string; venue: string; venueAddress?: string | null
  pricePence: number
}

export async function sendAdhocReceipt(f: SessionEmailFacts) {
  const when = `${fmtDate(f.date)} at ${hhmm(f.startMinutes)}`
  return sendEmail({
    to: f.to, fromName: f.academy,
    subject: `Booked: ${f.childName}, ${when}`,
    html: shell(f.academy, `
      <h1 style="font-size:22px;margin:12px 0 4px">You're booked</h1>
      <p style="margin:0 0 16px;color:#5b6674">Hi ${esc(f.parentName || 'there')}, ${esc(f.childName)}'s session is confirmed and paid.</p>
      <table style="border-collapse:collapse;width:100%;font-size:15px">
        <tr><td style="padding:6px 0;color:#5b6674">When</td><td style="padding:6px 0;font-weight:600">${esc(when)}, ${f.durationMinutes} minutes</td></tr>
        <tr><td style="padding:6px 0;color:#5b6674">Coach</td><td style="padding:6px 0;font-weight:600">${esc(f.coach)}</td></tr>
        <tr><td style="padding:6px 0;color:#5b6674">Where</td><td style="padding:6px 0;font-weight:600">${esc(f.venue)}${f.venueAddress ? `<br><span style="font-weight:400;color:#5b6674">${esc(f.venueAddress)}</span>` : ''}</td></tr>
        <tr><td style="padding:6px 0;color:#5b6674">Paid</td><td style="padding:6px 0;font-weight:600">${gbp(f.pricePence)}</td></tr>
      </table>
      <p style="margin-top:16px;font-size:13px;color:#5b6674">Need to change it? Reply to this email and the academy will sort it. More than 7 days' notice is a full credit, 7 days to 48 hours is half, under 48 hours is charged.</p>
    `),
  })
}

export async function sendSessionReminder(f: Omit<SessionEmailFacts, 'pricePence'>) {
  const when = `${fmtDate(f.date)} at ${hhmm(f.startMinutes)}`
  return sendEmail({
    to: f.to, fromName: f.academy,
    subject: `Tomorrow: ${f.childName}, ${hhmm(f.startMinutes)} with ${f.coach}`,
    html: shell(f.academy, `
      <h1 style="font-size:22px;margin:12px 0 4px">See you tomorrow</h1>
      <p style="margin:0 0 16px;color:#5b6674">${esc(f.childName)}'s session is ${esc(when)} with ${esc(f.coach)} at ${esc(f.venue)}${f.venueAddress ? `, ${esc(f.venueAddress)}` : ''}.</p>
      <p style="font-size:13px;color:#5b6674">Can't make it? Reply to this email. Under 48 hours' notice the session is charged.</p>
    `),
  })
}
