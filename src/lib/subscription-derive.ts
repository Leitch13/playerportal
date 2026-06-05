/**
 * Sprint 12 — pure derive for subscription + enrolment display labels.
 *
 * Used by the player profile to render Membership and Classes cards.
 * Read-only: no I/O, no Stripe calls, no mutations. The function maps
 * a raw subscription row (as stored in the `subscriptions` table after
 * the webhook sync) into a display-ready label + tone, accounting for
 * the `cancel_at_period_end` flag and a few edge cases.
 *
 * Keep this layer pure so it's trivially testable (no React, no
 * Supabase). The page server-renders the result; the page itself does
 * no derivation.
 */

export type Tone = 'emerald' | 'amber' | 'red' | 'violet' | 'muted'

export interface SubscriptionDisplay {
  label: string
  tone: Tone
  /** Sub-label shown under the main pill (e.g. "cancelling 1 Jul" or
   *  "trial ends 1 Jul"). Empty string when nothing extra to say. */
  detail: string
}

export interface SubscriptionInput {
  status: string | null
  cancel_at_period_end: boolean | null
  cancelled_at: string | null     // ISO timestamp from DB
  current_period_end: string | null
  start_date: string | null
}

/**
 * Map Stripe-style subscription status (mirrored into the DB) into a
 * display label + tone. Conservative mapping: anything unknown gets
 * the raw status capitalised, in 'muted' tone, so the page never
 * blanks out on a status we haven't enumerated.
 */
export function deriveSubscriptionDisplay(s: SubscriptionInput): SubscriptionDisplay {
  const raw = (s.status || '').toLowerCase().trim()
  const cancelling = !!s.cancel_at_period_end
  const periodEnd = s.current_period_end ? fmt(s.current_period_end) : ''

  // Already terminated
  if (raw === 'canceled' || raw === 'cancelled' || raw === 'incomplete_expired') {
    return {
      label: 'Cancelled',
      tone: 'muted',
      detail: s.cancelled_at ? `ended ${fmt(s.cancelled_at)}` : '',
    }
  }

  // Active + scheduled to cancel at period end — common after "Cancel sub"
  if ((raw === 'active' || raw === 'trialing') && cancelling) {
    return {
      label: raw === 'trialing' ? 'Trialing' : 'Active',
      tone: 'amber',
      detail: periodEnd ? `cancelling ${periodEnd}` : 'cancelling at period end',
    }
  }

  if (raw === 'active') {
    return { label: 'Active', tone: 'emerald', detail: '' }
  }
  if (raw === 'trialing') {
    return {
      label: 'Trialing',
      tone: 'amber',
      detail: periodEnd ? `trial ends ${periodEnd}` : '',
    }
  }
  if (raw === 'past_due') {
    return {
      label: 'Past due',
      tone: 'red',
      detail: periodEnd ? `cycle ended ${periodEnd}` : '',
    }
  }
  if (raw === 'unpaid') {
    return { label: 'Unpaid', tone: 'red', detail: '' }
  }
  if (raw === 'incomplete') {
    return { label: 'Incomplete', tone: 'violet', detail: 'first payment not yet confirmed' }
  }
  if (raw === 'paused') {
    return { label: 'Paused', tone: 'violet', detail: '' }
  }
  // Future-start subs created via the Stage 3 setup-intent flow are
  // stored with a non-empty start_date and a status that's typically
  // 'trialing' or 'incomplete' — handled above. This branch catches
  // an explicit 'scheduled' literal if it ever lands.
  if (raw === 'scheduled') {
    return {
      label: 'Scheduled',
      tone: 'amber',
      detail: s.start_date ? `starts ${fmt(s.start_date)}` : '',
    }
  }

  return {
    label: raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : 'Unknown',
    tone: 'muted',
    detail: '',
  }
}

/**
 * Next-payment label derived from `current_period_end`. Returns a
 * pre-formatted string suitable for direct rendering, or an empty
 * string when no charge is upcoming (cancelled / past-due / unknown).
 */
export function deriveNextPaymentLabel(s: SubscriptionInput): string {
  const raw = (s.status || '').toLowerCase().trim()
  if (raw === 'canceled' || raw === 'cancelled' || raw === 'incomplete_expired') return ''
  if (s.cancel_at_period_end) return ''
  if (!s.current_period_end) return ''
  return fmt(s.current_period_end)
}

// ─────────────────────────────────────────────────────────────────────
//  ENROLMENT side — kept here so the page imports a single helper file.
// ─────────────────────────────────────────────────────────────────────

export interface EnrolmentInput {
  status: string | null
  is_trial: boolean | null
}

export interface EnrolmentDisplay {
  label: string
  tone: Tone
}

/**
 * Map enrolment status (+ trial flag) into a display label + tone.
 * Mirrors the colour palette used elsewhere (active=emerald,
 * pending/trial=amber, cancelled=muted).
 *
 * The `is_trial` flag wins over `status='active'` — a trial enrolment
 * sits in `status='active'` until the trial expires, so we surface
 * "Trial" specifically rather than letting it look like a normal
 * paying member.
 */
export function deriveEnrolmentDisplay(e: EnrolmentInput): EnrolmentDisplay {
  const raw = (e.status || '').toLowerCase().trim()
  if (e.is_trial) return { label: 'Trial', tone: 'amber' }
  if (raw === 'active') return { label: 'Active', tone: 'emerald' }
  if (raw === 'pending') return { label: 'Pending', tone: 'amber' }
  if (raw === 'paused') return { label: 'Paused', tone: 'violet' }
  if (raw === 'cancelled' || raw === 'canceled' || raw === 'inactive') {
    return { label: 'Cancelled', tone: 'muted' }
  }
  return {
    label: raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : 'Unknown',
    tone: 'muted',
  }
}

// ─────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────

function fmt(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function fmtMoney(amount: number | null | undefined, currency: string = 'GBP'): string {
  if (amount == null || Number.isNaN(amount)) return ''
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency, minimumFractionDigits: amount % 1 === 0 ? 0 : 2 })
      .format(amount)
  } catch {
    return `£${amount.toFixed(2)}`
  }
}

export function fmtInterval(interval: string | null | undefined, sessionsPerMonth?: number | null): string {
  const raw = (interval || '').toLowerCase()
  if (raw === 'month') {
    return sessionsPerMonth && sessionsPerMonth > 0
      ? `/ month · ${sessionsPerMonth} session${sessionsPerMonth === 1 ? '' : 's'}`
      : '/ month'
  }
  if (raw === 'week') return '/ week'
  if (raw === 'year') return '/ year'
  if (raw === 'quarter' || raw === '3_months') return '/ quarter'
  return raw ? `/ ${raw}` : ''
}
