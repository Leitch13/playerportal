/**
 * After a trial: the joining link.
 *
 * Until 13 Oct 2026 the only way to turn a trial into a member was "Convert",
 * which ticked a box and did nothing else, and "Copy link", which dropped the
 * parent on the academy's general booking page with nothing filled in and
 * "Book a trial" as the first thing they saw. John: "how easy is it for
 * academies to use and book people in after". It wasn't.
 *
 * Now there is ONE link per trial, /book/<academy>/join/<trial id>. It opens
 * sign-up with the trial's class chosen and the parent's and child's details
 * filled in, and it ties the payment back to the trial so the trial marks
 * itself as joined when the parent pays. The academy sends it with one tap;
 * the two automatic follow-up emails use the same link.
 *
 * Payment itself is untouched: the parent goes through the normal sign-up
 * (class required, sessions left this month). See BILLING_RULES.md.
 */
export const TRIAL_JOIN_SENT_ACTION = 'trial.join_link_sent'

/** The one joining link for a trial. Carries no personal details. */
export function trialJoinPath(slug: string, trialId: string): string {
  return `/book/${encodeURIComponent(slug)}/join/${encodeURIComponent(trialId)}`
}

/** "Henrique  de Freitas" → first "Henrique", last "de Freitas". A single name is a first name. */
export function splitChildName(full: string | null | undefined): { first: string; last: string } {
  const parts = (full || '').trim().split(/\s+/).filter(Boolean)
  return { first: parts[0] || '', last: parts.slice(1).join(' ') }
}

export interface JoinableTrial { status?: string | null; converted?: boolean | null; parent_email?: string | null }

/** Can the academy send this trial a joining link, and if not, why (in words an academy reads). */
export function joinLinkProblem(t: JoinableTrial | null | undefined): string | null {
  if (!t) return 'That trial could not be found.'
  if (t.converted) return 'This family has already joined.'
  if (!(t.parent_email || '').includes('@')) return 'There is no email address for this parent. Copy the link and send it by text instead.'
  return null
}

/** Where the joining link sends the parent: sign-up, with the trial's class chosen when it is open for booking. */
export function trialSignupPath(slug: string, trialId: string, classId: string | null | undefined): string {
  const q = new URLSearchParams({ org: slug })
  if (classId) q.set('class', classId)
  q.set('tj', trialId)
  return `/auth/signup?${q}`
}
