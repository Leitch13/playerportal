// ============================================================================
// Quarterly Billing — global safety kill-switch.
//
// The current quarterly checkout is UNSAFE (one-time `mode:'payment'` → no
// subscription, no auto-enrolment, no renewal — see
// QUARTERLY_BILLING_ENROLMENT_AUDIT.md). Until quarterly is re-built as a true
// recurring subscription (QUARTERLY_RECURRING_PHASE0.md), this flag hides and
// hard-blocks every quarterly purchase path.
//
// QUARTERLY_BILLING_ENABLED — server flag (default OFF). Gates the API routes
//   (the authoritative block) and every server-rendered booking surface.
//
// NEXT_PUBLIC_QUARTERLY_BILLING_ENABLED — client mirror (default OFF). Read
//   ONLY by the pure-client signup page, which has no server boundary to
//   receive the server flag as a prop. Set BOTH to the same value when
//   flipping. Both default to OFF (false) when unset.
// ============================================================================

export const QUARTERLY_BILLING_ENABLED = process.env.QUARTERLY_BILLING_ENABLED === 'true'

// Client-readable mirror (Next inlines NEXT_PUBLIC_* at build). Used by the
// standalone client signup page only.
export const QUARTERLY_BILLING_ENABLED_PUBLIC =
  process.env.NEXT_PUBLIC_QUARTERLY_BILLING_ENABLED === 'true'

// Shown when a quarterly request is blocked at the API layer.
export const QUARTERLY_UNAVAILABLE_MESSAGE = 'Quarterly billing is temporarily unavailable.'

// ============================================================================
// Per-org allowlist — enables quarterly for SPECIFIC academies without flipping
// the global flag (which would expose every org, including future ones that
// default `quarterly_billing_enabled = true`). Default empty → quarterly stays
// OFF for everyone until an org id is added. Set BOTH vars to the same comma-
// separated list of org ids when scoping; clearing them returns quarterly OFF
// everywhere (instant rollback, no code change).
//   QUARTERLY_ENABLED_ORG_IDS             — server (API + server-rendered pages)
//   NEXT_PUBLIC_QUARTERLY_ENABLED_ORG_IDS — client mirror (pure-client signup)
// ============================================================================
const parseIds = (raw: string | undefined): string[] =>
  (raw || '').split(',').map((s) => s.trim()).filter(Boolean)

export const QUARTERLY_ENABLED_ORG_IDS = parseIds(process.env.QUARTERLY_ENABLED_ORG_IDS)
export const QUARTERLY_ENABLED_ORG_IDS_PUBLIC = parseIds(process.env.NEXT_PUBLIC_QUARTERLY_ENABLED_ORG_IDS)

// Quarterly is enabled for an org only when BOTH hold:
//   1. the global flag is ON, OR the org id is explicitly allow-listed
//   2. the org has not opted out (`quarterly_billing_enabled !== false`)
export function isQuarterlyEnabledForOrg(orgId: string | null | undefined, orgFlag?: boolean | null): boolean {
  if (!orgId) return false
  return (QUARTERLY_BILLING_ENABLED || QUARTERLY_ENABLED_ORG_IDS.includes(orgId)) && orgFlag !== false
}

// Client-side equivalent — uses the NEXT_PUBLIC mirrors only (server env is not
// readable in the browser). Same truth table as the server helper.
export function isQuarterlyEnabledForOrgPublic(orgId: string | null | undefined, orgFlag?: boolean | null): boolean {
  if (!orgId) return false
  return (QUARTERLY_BILLING_ENABLED_PUBLIC || QUARTERLY_ENABLED_ORG_IDS_PUBLIC.includes(orgId)) && orgFlag !== false
}
