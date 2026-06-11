import { randomBytes } from 'crypto'

// ============================================================================
// Batch 2a / Finding #1 — per-offer token gate for the waitlist accept/decline
// email links. Closes the hole where anyone who knows/guesses a waitlist UUID
// could accept or decline an offer (the routes run with the service-role key
// and previously authenticated nothing but the id).
//
// Flag: WAITLIST_ACCEPT_TOKEN_ENABLED.
//   OFF → current behaviour exactly (this module never touches the new column).
//   ON  → a fresh token is minted whenever an entry becomes 'offered', embedded
//         in the accept/decline email URLs, and required on the way back in.
//
// Grace / backward-compat: offers minted BEFORE this shipped have a NULL
// accept_token (migration 086 adds the column WITHOUT backfilling 'offered'
// rows). verifyWaitlistToken() treats NULL as "allow" so those already-sent,
// token-less email links keep working. Because every offer carries a 48h
// expires_at, all NULL-token offers age out within 48h of enabling the flag —
// after which the gate is fully enforced with no special-casing left live.
// (The existing expires_at check is the natural bound on the grace window.)
// ============================================================================

export const WAITLIST_TOKEN_ON = process.env.WAITLIST_ACCEPT_TOKEN_ENABLED === 'true'

// 48 hex chars / 192 bits of entropy — not guessable, safe to compare with ===.
export function generateWaitlistToken(): string {
  return randomBytes(24).toString('hex')
}

// Append &token= to an accept/decline URL that already carries ?id=.
// Returns the URL unchanged when token is null (flag OFF) so the link shape
// is identical to today.
export function withToken(url: string, token: string | null): string {
  return token ? `${url}&token=${token}` : url
}

export type TokenVerdict = {
  ok: boolean
  reason: 'flag_off' | 'grace_null' | 'match' | 'mismatch'
}

// storedToken: the entry's accept_token column value (may be null/undefined).
// supplied:    the token from the inbound request (query param or POST body).
export function verifyWaitlistToken(
  storedToken: string | null | undefined,
  supplied: string | null | undefined,
): TokenVerdict {
  if (!WAITLIST_TOKEN_ON) return { ok: true, reason: 'flag_off' }
  // Pre-migration in-flight offer — allow (self-expires via the 48h TTL).
  if (storedToken == null) return { ok: true, reason: 'grace_null' }
  if (supplied && supplied === storedToken) return { ok: true, reason: 'match' }
  return { ok: false, reason: 'mismatch' }
}

// Read the stored accept_token for an entry. Only touches the column when the
// flag is ON, so flag OFF stays byte-identical and independent of migration 086.
// Kept as a separate query so the main entry SELECT remains a typed string
// literal (concatenating the column name widens Supabase's inferred row type).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchStoredToken(supabase: any, id: string): Promise<string | null> {
  if (!WAITLIST_TOKEN_ON) return null
  const { data } = await supabase.from('waitlist').select('accept_token').eq('id', id).single()
  return (data?.accept_token as string | null) ?? null
}
