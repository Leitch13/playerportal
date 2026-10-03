/**
 * "Needs a look" — the calm Parents / Players lists (Oct 2026).
 *
 * The lists used to flag every family ("Never contacted", "Review due"), so
 * the page read as an alarm when nothing was wrong. These helpers reduce a
 * family or a player to ONE membership pill, and flag only real problems an
 * owner can act on today:
 *   - a card payment has failed
 *   - a recent invite hasn't been confirmed
 *   - a child is paying, or has just signed up, but isn't in a class
 *
 * Pure. Read-only. No I/O. Display only — nothing here feeds billing.
 */

export type PillTone = 'ok' | 'warn' | 'bad' | 'off'

export interface MembershipPill {
  label: string
  tone: PillTone
}

export interface LookReason {
  key: 'payment' | 'invite' | 'no_class'
  label: string
  /** What the owner should do about it, in one plain sentence. */
  todo: string
}

const RECENT_DAYS = 30
const DAY_MS = 86_400_000

const norm = (statuses: Array<string | null | undefined>) =>
  new Set(statuses.map((s) => (s || '').toLowerCase()).filter(Boolean))

/** One pill for a set of membership statuses (a family's, or one player's). */
export function membershipPill(statuses: Array<string | null | undefined>): MembershipPill {
  const set = norm(statuses)
  if (set.has('past_due')) return { label: 'Payment problem', tone: 'bad' }
  if (set.has('active') || set.has('trialing')) return { label: 'Paying', tone: 'ok' }
  if (set.has('pending_migration')) return { label: 'Invite not confirmed', tone: 'warn' }
  if (set.has('paused')) return { label: 'Paused', tone: 'off' }
  if (set.has('scheduled')) return { label: 'Starts soon', tone: 'off' }
  return { label: 'No membership', tone: 'off' }
}

function withinDays(iso: string | null | undefined, days: number, nowMs: number): boolean {
  if (!iso) return false
  const t = new Date(iso).getTime()
  if (isNaN(t)) return false
  return nowMs - t <= days * DAY_MS
}

export interface FamilyLookInput {
  subs: Array<{ status: string | null; inviteSentAtIso?: string | null; createdAtIso?: string | null }>
  /** Children who are not archived. `hasClass` = any active, pending, trial or paused class. */
  children: Array<{ firstName: string; hasClass: boolean }>
  parentJoinedAtIso: string | null
  nowMs?: number
}

/** The real problems for one family. Empty = nothing needs a look. */
export function familyLookReasons(input: FamilyLookInput): LookReason[] {
  const now = input.nowMs ?? Date.now()
  const out: LookReason[] = []
  const set = norm(input.subs.map((s) => s.status))

  if (set.has('past_due')) {
    out.push({
      key: 'payment',
      label: 'Payment problem',
      todo: 'A card payment failed. Stripe retries automatically; ask them to check or update their card.',
    })
  }

  // Only recent invites. An invite ignored for months is not something to chase today.
  const recentInvite = input.subs.some((s) =>
    (s.status || '').toLowerCase() === 'pending_migration' &&
    withinDays(s.inviteSentAtIso || s.createdAtIso, RECENT_DAYS, now),
  )
  if (recentInvite) {
    out.push({
      key: 'invite',
      label: 'Invite not confirmed',
      todo: "They haven't added their card yet. Give them a nudge to open the link in their invite email.",
    })
  }

  // A child with no class matters when the family is paying (money in, no place),
  // or has only just signed up (stalled before booking). Lapsed families are left alone.
  const noClass = input.children.filter((c) => !c.hasClass)
  const paying = set.has('active') || set.has('trialing') || set.has('past_due')
  if (noClass.length > 0 && (paying || withinDays(input.parentJoinedAtIso, RECENT_DAYS, now))) {
    const names = noClass.map((c) => c.firstName).join(' and ')
    out.push({
      key: 'no_class',
      label: 'Not in a class',
      todo: paying
        ? `${names} ${noClass.length === 1 ? "isn't" : "aren't"} in a class but the family is paying. Add them to their class.`
        : `Signed up but ${names} ${noClass.length === 1 ? "isn't" : "aren't"} booked into a class yet. Send them your booking link.`,
    })
  }
  return out
}

/** Initials for the avatar tile: "Sarah Evans" → "SE". */
export function initialsOf(name: string | null | undefined): string {
  const parts = (name || '').replace(/\(.*?\)/g, ' ').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}
