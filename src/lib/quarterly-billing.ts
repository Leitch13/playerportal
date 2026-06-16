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
