/**
 * Plain facts about a trial booking, with nothing server-side in them, so the
 * Trials page in the browser and the server routes read a booking the same way.
 * The alerting itself lives in trial-alerts.ts.
 */

/** "Paid trial — £5.00 via Stripe (cs_live_…)" → 500. Null for a free trial. */
export function paidTrialPence(notes: string | null | undefined): number | null {
  const m = /^Paid trial\s+[—-]\s+£(\d+(?:\.\d{1,2})?)/.exec(notes || '')
  return m ? Math.round(Number(m[1]) * 100) : null
}

/** The Stripe Checkout session a paid trial came from, if any. */
export function paidTrialSessionId(notes: string | null | undefined): string | null {
  return /\((cs_[A-Za-z0-9_]+)\)/.exec(notes || '')?.[1] ?? null
}

const norm = (s: string | null | undefined) => (s || '').trim().replace(/\s+/g, ' ').toLowerCase()

/**
 * Is this the same child, on the same class, on the same date, from the same
 * parent? Names are compared loosely: the double booking at Talent FA was
 * "Henrique  Freitas" then "Henrique Freitas", from "Amy Freitas" then "Amy Freitas ".
 */
export function sameTrial(
  a: { training_group_id?: string | null; preferred_date?: string | null; parent_email?: string | null; child_name?: string | null },
  b: { training_group_id?: string | null; preferred_date?: string | null; parent_email?: string | null; child_name?: string | null },
): boolean {
  return !!a.training_group_id && a.training_group_id === b.training_group_id
    && (a.preferred_date || '') === (b.preferred_date || '')
    && norm(a.parent_email) !== '' && norm(a.parent_email) === norm(b.parent_email)
    && norm(a.child_name) === norm(b.child_name)
}

export const TRIAL_ALREADY_BOOKED_MESSAGE =
  'This child is already booked and paid for that session, so there is nothing more to pay. Check your email for the confirmation, or contact the academy if you need to change it.'
