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
