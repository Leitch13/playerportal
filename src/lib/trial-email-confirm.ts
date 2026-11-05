/**
 * Free trials are confirmed by email before they count (John, 5 Nov 2026: "2.").
 *
 * The booking form passes the door check (src/lib/booking-guard.ts), then the
 * parent is emailed a link. Nothing reaches the academy until it's tapped: no
 * trial row, no alert, no lead. A made-up email can never tap, so a fake trial
 * never reaches an academy.
 *
 * Kept simple on purpose:
 *  - The waiting booking lives in audit_log ('trial.awaiting_email', no academy
 *    on the row so it never shows on an academy's Audit page). No new tables.
 *  - Only a hash of the token is stored.
 *  - Opening the link shows a Confirm button; only the button (POST) confirms,
 *    because Hotmail/Outlook scanners open links before the parent does
 *    (the login-link lesson, 29 Oct 2026).
 *  - Confirming twice is harmless: the second time says "already confirmed".
 *  - The place is checked again at confirm (the database refuses a full day).
 */
import { createHash, randomBytes } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

export const AWAITING_ACTION = 'trial.awaiting_email'
export const CONFIRMED_ACTION = 'trial.email_confirmed'
export const LINK_DAYS = 7

export type PendingTrial = {
  orgId: string
  orgName: string
  slug: string
  groupId: string | null
  className: string | null
  parentName: string
  email: string
  phone: string
  childName: string
  childAge: number | null
  sessionDate: string | null
  notes: string | null
  termsVersionHash: string
  termsAcceptedAt: string
  trialSource: string | null
  sourceDetail: string | null
  referrerUrl: string | null
  ip: string | null
}

export function newToken(): { token: string; hash: string } {
  const token = randomBytes(24).toString('base64url')
  return { token, hash: hashToken(token) }
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** A link is usable for LINK_DAYS days. Pure, for the test. */
export function linkExpired(createdAtIso: string, now: Date = new Date()): boolean {
  return now.getTime() - new Date(createdAtIso).getTime() > LINK_DAYS * 86400000
}

/** The trial date has gone by (UK date). Pure, for the test. */
export function datePassed(sessionDate: string | null, now: Date = new Date()): boolean {
  if (!sessionDate) return false
  const today = now.toLocaleDateString('en-CA', { timeZone: 'Europe/London' })
  return sessionDate < today
}

export function confirmUrl(appUrl: string, slug: string, token: string): string {
  return `${appUrl.replace(/\/$/, '')}/book/${encodeURIComponent(slug)}/trial/confirm/${token}`
}

type Db = SupabaseClient

/** Find the waiting booking for a token, and whether it was already confirmed. */
export async function findPending(sb: Db, token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null
  const hash = hashToken(token)
  const { data } = await sb
    .from('audit_log')
    .select('id, created_at, details')
    .eq('action', AWAITING_ACTION)
    .eq('details->>token_hash', hash)
    .limit(1)
    .maybeSingle()
  if (!data) return null
  const { data: done } = await sb
    .from('audit_log')
    .select('entity_id')
    .eq('action', CONFIRMED_ACTION)
    .eq('details->>token_hash', hash)
    .limit(1)
    .maybeSingle()
  const d = data.details as { token_hash: string; trial: PendingTrial }
  return {
    hash,
    createdAt: data.created_at as string,
    trial: d.trial,
    confirmedTrialId: (done?.entity_id as string | undefined) ?? null,
  }
}
