// ============================================================================
// report-visibility.ts — Player Reports Visibility MVP (Slice A).
//
// Slice A is read-only on the Parent Hub side: when ON, the Hub's "new report"
// signal is driven by UNREAD report notifications (clears when the parent
// reads it) instead of a 7-day time window. The notification row itself is
// already created on report creation by /api/email/progress-report (RLS
// permits org members to insert for any user in their org) — Slice A does NOT
// add or change that write path.
//
// No migrations, no viewed/emailed columns, no service-role API, no RLS, no
// Stripe/subscription/cancellation changes. Flag OFF ⇒ Hub uses the existing
// 7-day window, byte-identical to today.
// ============================================================================

export const REPORT_VISIBILITY_ENABLED = process.env.REPORT_VISIBILITY_ENABLED === 'true'

// Notification `type` values that represent a progress report (the live insert
// uses 'progress'; 'progress_report' included for forward-compatibility).
export const REPORT_NOTIFICATION_TYPES = ['progress', 'progress_report'] as const

// ---------------------------------------------------------------------------
// Slice C — Email reliability. When ON: the on-create email route records
// `progress_reviews.emailed_at` on a successful send, and the daily cron only
// emails reviews where `emailed_at IS NULL` — eliminating the on-create/cron
// double-send and the silent-gap. Flag OFF ⇒ on-create + cron behave exactly
// as today (cron uses the 24h window with no dedup; no emailed_at writes).
// ---------------------------------------------------------------------------
export const REPORT_EMAIL_IDEMPOTENCY_ENABLED = process.env.REPORT_EMAIL_IDEMPOTENCY_ENABLED === 'true'

// ---------------------------------------------------------------------------
// Slice B — Viewed tracking. When ON: opening a player's report as the owning
// parent records `progress_reviews.viewed_at` on the latest review (service-
// role behind an ownership check; first-view-wins, idempotent), and staff see
// a "Viewed ✓ / Not yet viewed" indicator. Flag OFF ⇒ no ping fired, no
// indicator, no writes — pages render byte-identical to today.
// ---------------------------------------------------------------------------
export const REPORT_VIEWED_TRACKING_ENABLED = process.env.REPORT_VIEWED_TRACKING_ENABLED === 'true'
