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

// ─── regulars' money (phase 4) ──────────────────────────────────────────

export async function sendSetupLink(f: { academy: string; to: string; parentName: string | null; childName: string; slotLabel: string; pricePence: number; sessionsThisMonth: number; amountPence: number; creditPence: number; url: string }) {
  return sendEmail({
    to: f.to, fromName: f.academy,
    subject: `${f.childName}'s slot: ${f.slotLabel.split(' at ')[0]}`,
    html: shell(f.academy, `
      <h1 style="font-size:22px;margin:12px 0 4px">${esc(f.childName)}'s regular slot</h1>
      <p style="margin:0 0 12px;color:#5b6674">Hi ${esc(f.parentName || 'there')}, ${esc(f.academy)} has set up ${esc(f.childName)}'s slot: <b style="color:#141a22">${esc(f.slotLabel)}, ${gbp(f.pricePence)} a session.</b> It rolls on month to month until you tell the academy otherwise.</p>
      <table style="border-collapse:collapse;width:100%;font-size:15px">
        <tr><td style="padding:6px 0;color:#5b6674">This month</td><td style="padding:6px 0;font-weight:600">${f.sessionsThisMonth} session${f.sessionsThisMonth === 1 ? '' : 's'}${f.creditPence > 0 ? `, ${gbp(f.creditPence)} credit applied` : ''} · ${gbp(f.amountPence)}</td></tr>
        <tr><td style="padding:6px 0;color:#5b6674">After that</td><td style="padding:6px 0;font-weight:600">Charged on the 1st for the sessions in the month</td></tr>
        <tr><td style="padding:6px 0;color:#5b6674">Can't make one?</td><td style="padding:6px 0;font-weight:600">7+ days' notice is a full credit. You'll see the full cancellation policy and accept it before you pay.</td></tr>
      </table>
      <p style="margin:18px 0 6px"><a href="${f.url}" style="display:inline-block;background:#0b8299;color:#fff;font-weight:600;padding:11px 16px;border-radius:8px;text-decoration:none">${f.amountPence > 0 ? `Pay ${gbp(f.amountPence)} and save my card` : 'Save my card for the 1st'}</a></p>
      <p style="font-size:13px;color:#5b6674">Your card is kept by Stripe for the monthly charge. Nothing else is set up in the background. This link works for 24 hours; ask the academy for a fresh one if it's expired.</p>
    `),
  })
}

export async function sendMonthNotice(f: { academy: string; to: string; parentName: string | null; monthLabel: string; lines: { date: string; time: string; coach: string; venue: string; pricePence: number }[]; creditPence: number; amountPence: number; chargeDate: string; url: string }) {
  const rows = f.lines.map((l) => `<tr><td style="padding:5px 0;color:#5b6674">${esc(fmtDate(l.date))}</td><td style="padding:5px 0;font-weight:600">${esc(l.time)} · ${esc(l.venue)} · ${esc(l.coach)}</td></tr>`).join('')
  const total = f.lines.reduce((a, l) => a + l.pricePence, 0)
  return sendEmail({
    to: f.to, fromName: f.academy,
    subject: `${f.monthLabel.split(' ')[0]}: ${f.lines.length} session${f.lines.length === 1 ? '' : 's'}, ${gbp(f.amountPence)} on the 1st`,
    html: shell(f.academy, `
      <h1 style="font-size:22px;margin:12px 0 4px">${esc(f.monthLabel.split(' ')[0])}'s sessions</h1>
      <p style="margin:0 0 12px;color:#5b6674">Hi ${esc(f.parentName || 'there')}, same slot, same coach. Here's what's booked and what comes off your card on ${esc(f.chargeDate)}. Nothing to do.</p>
      <table style="border-collapse:collapse;width:100%;font-size:14px">${rows}
        <tr><td style="padding:8px 0 4px;color:#5b6674;border-top:1px solid #e1e5ea">${f.lines.length} session${f.lines.length === 1 ? '' : 's'}</td><td style="padding:8px 0 4px;font-weight:600;border-top:1px solid #e1e5ea">${gbp(total)}</td></tr>
        ${f.creditPence !== 0 ? `<tr><td style="padding:4px 0;color:#5b6674">${f.creditPence > 0 ? 'Credit on account' : 'Owed from last month'}</td><td style="padding:4px 0;font-weight:600">${f.creditPence > 0 ? '−' : '+'}${gbp(Math.abs(f.creditPence))}</td></tr>` : ''}
        <tr><td style="padding:4px 0;color:#5b6674"><b>On ${esc(f.chargeDate)}</b></td><td style="padding:4px 0;font-weight:700">${gbp(f.amountPence)}</td></tr>
      </table>
      <p style="margin:16px 0 6px"><a href="${f.url}" style="display:inline-block;background:#eef1f4;color:#141a22;font-weight:600;padding:10px 14px;border-radius:8px;text-decoration:none">See the month</a></p>
      <p style="font-size:13px;color:#5b6674">If a date doesn't work, tap it on the page and tell us 7+ days ahead for a full credit. To stop the slot altogether, reply to this email and the academy will release it.</p>
    `),
  })
}

export async function sendMonthReceipt(f: { academy: string; to: string; parentName: string | null; monthLabel: string; sessionsPence: number; creditPence: number; amountPence: number; count: number }) {
  return sendEmail({
    to: f.to, fromName: f.academy,
    subject: `Receipt · ${f.monthLabel.split(' ')[0]} sessions · ${gbp(f.amountPence)}`,
    html: shell(f.academy, `
      <h1 style="font-size:22px;margin:12px 0 4px">Paid, ${gbp(f.amountPence)}</h1>
      <p style="margin:0 0 12px;color:#5b6674">Hi ${esc(f.parentName || 'there')}, ${f.count} session${f.count === 1 ? '' : 's'} for ${esc(f.monthLabel)}.</p>
      <table style="border-collapse:collapse;width:100%;font-size:15px">
        <tr><td style="padding:6px 0;color:#5b6674">Sessions</td><td style="padding:6px 0;font-weight:600">${gbp(f.sessionsPence)}</td></tr>
        ${f.creditPence !== 0 ? `<tr><td style="padding:6px 0;color:#5b6674">${f.creditPence > 0 ? 'Credit used' : 'Owed from last month'}</td><td style="padding:6px 0;font-weight:600">${f.creditPence > 0 ? '−' : '+'}${gbp(Math.abs(f.creditPence))}</td></tr>` : ''}
        <tr><td style="padding:6px 0;color:#5b6674">Charged</td><td style="padding:6px 0;font-weight:700">${gbp(f.amountPence)}</td></tr>
      </table>
      <p style="font-size:13px;color:#5b6674">Your card statement shows ${esc(f.academy)}.</p>
    `),
  })
}

export async function sendPaymentFailed(f: { academy: string; to: string; parentName: string | null; monthLabel: string; amountPence: number; attempts: number; url: string; lastTry: string | null }) {
  return sendEmail({
    to: f.to, fromName: f.academy,
    subject: `${f.monthLabel.split(' ')[0]}'s payment didn't go through`,
    html: shell(f.academy, `
      <h1 style="font-size:22px;margin:12px 0 4px">We couldn't take ${esc(f.monthLabel.split(' ')[0])}'s ${gbp(f.amountPence)}</h1>
      <p style="margin:0 0 12px;color:#5b6674">Hi ${esc(f.parentName || 'there')}, your card was declined ${f.attempts} time${f.attempts === 1 ? '' : 's'}. The sessions are still booked. Pay now, or use a different card, and it's sorted.</p>
      <p style="margin:6px 0"><a href="${f.url}" style="display:inline-block;background:#0b8299;color:#fff;font-weight:600;padding:11px 16px;border-radius:8px;text-decoration:none">Pay ${gbp(f.amountPence)} now</a></p>
      <p style="font-size:13px;color:#5b6674">This opens a normal payment page. If your bank wants an extra check, it happens there.${f.lastTry ? ` We'll try the saved card once more on ${esc(f.lastTry)}.` : ' After this the academy will be in touch.'}</p>
    `),
  })
}

export async function sendDeclined(f: { academy: string; to: string; parentName: string | null; date: string; startMinutes: number; message: string }) {
  return sendEmail({
    to: f.to, fromName: f.academy,
    subject: `Released: ${fmtDate(f.date)} ${hhmm(f.startMinutes)}`,
    html: shell(f.academy, `
      <h1 style="font-size:22px;margin:12px 0 4px">${esc(fmtDate(f.date))} released</h1>
      <p style="margin:0 0 12px;color:#5b6674">Hi ${esc(f.parentName || 'there')}, the ${esc(hhmm(f.startMinutes))} session on ${esc(fmtDate(f.date))} is released and back on sale. ${esc(f.message)} Your regular slot stays yours.</p>
    `),
  })
}

export async function sendSessionMoved(f: { academy: string; to: string; fromDate: string; fromMinutes: number; toDate: string; toMinutes: number; coach: string | null; venue: string | null }) {
  return sendEmail({
    to: f.to, fromName: f.academy,
    subject: `Moved: ${fmtDate(f.fromDate)} is now ${fmtDate(f.toDate)} ${hhmm(f.toMinutes)}`,
    html: shell(f.academy, `
      <h1 style="font-size:22px;margin:12px 0 4px">Your session has moved</h1>
      <p style="margin:0 0 12px;color:#5b6674">${esc(f.academy)} has moved the ${esc(fmtDate(f.fromDate))} ${esc(hhmm(f.fromMinutes))} session to <b>${esc(fmtDate(f.toDate))} at ${esc(hhmm(f.toMinutes))}</b>${f.venue ? ` at ${esc(f.venue)}` : ''}${f.coach ? ` with ${esc(f.coach)}` : ''}. The price is the same and nothing else changes.</p>
    `),
  })
}

export async function sendAcademyCancelled(f: { academy: string; to: string; date: string; startMinutes: number; creditedPence: number; refundedPence?: number; reason: string | null }) {
  return sendEmail({
    to: f.to, fromName: f.academy,
    subject: `Cancelled: ${fmtDate(f.date)} ${hhmm(f.startMinutes)}`,
    html: shell(f.academy, `
      <h1 style="font-size:22px;margin:12px 0 4px">Sorry, ${esc(fmtDate(f.date))} is off</h1>
      <p style="margin:0 0 12px;color:#5b6674">${esc(f.academy)} has had to cancel the ${esc(hhmm(f.startMinutes))} session${f.reason ? ` (${esc(f.reason)})` : ''}. ${f.refundedPence ? `${gbp(f.refundedPence)} has been refunded to your card; it usually shows within 5 to 10 working days.` : f.creditedPence > 0 ? `${gbp(f.creditedPence)} has been credited to your account and comes off your next month.` : 'It won\'t be charged.'} Everything else stays as it was.</p>
    `),
  })
}

/**
 * The academy changed a regular's price (John, 15 Oct 2026: "so if Matty/Cammy need to email").
 * Sent the moment it is saved, so the family hears it from the academy before the monthly
 * notice or the card charge shows a different number.
 */
export async function sendPriceChanged(f: { academy: string; to: string; parentName: string | null; childName: string; slotLabel: string; oldPence: number; newPence: number; fromDate: string; monthLabel: string; dates: { date: string; startMinutes: number }[] }) {
  const up = f.newPence > f.oldPence
  return sendEmail({
    to: f.to, fromName: f.academy,
    subject: `${f.childName}'s sessions: new price ${gbp(f.newPence)} from ${fmtDate(f.fromDate)}`,
    html: shell(f.academy, `
      <h1 style="font-size:22px;margin:12px 0 4px">A change to ${esc(f.childName)}'s price</h1>
      <p style="margin:0 0 12px;color:#5b6674">Hi ${esc((f.parentName || '').split(' ')[0] || 'there')}, ${esc(f.academy)} has ${up ? 'changed' : 'lowered'} the price of ${esc(f.childName)}'s ${esc(f.slotLabel)} sessions.</p>
      <table style="width:100%;border-collapse:collapse;font-size:15px;margin:8px 0 14px">
        <tr><td style="padding:8px 0;color:#5b6674;border-top:1px solid #e6e9ee">Was</td><td style="padding:8px 0;text-align:right;border-top:1px solid #e6e9ee">${gbp(f.oldPence)} a session</td></tr>
        <tr><td style="padding:8px 0;color:#5b6674;border-top:1px solid #e6e9ee">Now</td><td style="padding:8px 0;text-align:right;font-weight:700;border-top:1px solid #e6e9ee">${gbp(f.newPence)} a session</td></tr>
        <tr><td style="padding:8px 0;color:#5b6674;border-top:1px solid #e6e9ee">From</td><td style="padding:8px 0;text-align:right;border-top:1px solid #e6e9ee">${esc(fmtDate(f.fromDate))}</td></tr>
      </table>
      ${f.dates.length ? `<p style="margin:0 0 6px;font-weight:600">${esc(f.monthLabel)} at the new price</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin:0 0 14px">
        ${f.dates.map((d) => `<tr><td style="padding:6px 0;border-top:1px solid #e6e9ee">${esc(fmtDate(d.date))} · ${esc(hhmm(d.startMinutes))}</td><td style="padding:6px 0;text-align:right;border-top:1px solid #e6e9ee">${gbp(f.newPence)}</td></tr>`).join('')}
        <tr><td style="padding:8px 0;border-top:2px solid #141a22;font-weight:700">${f.dates.length} session${f.dates.length === 1 ? '' : 's'}</td><td style="padding:8px 0;text-align:right;border-top:2px solid #141a22;font-weight:700">${gbp(f.dates.length * f.newPence)}</td></tr>
      </table>` : ''}
      <p style="margin:0;color:#5b6674">Sessions already paid for stay at the old price. Nothing else changes: same day, time and coach. Your card is charged as usual on the 1st.</p>
    `),
  })
}
