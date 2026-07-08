// Analytics foundation — Growth Phase 1A.
//
// Single entry point for firing analytics events + reading consent state.
// Callers never touch window.gtag directly; they call `track(EVENTS.X, {...})`
// and this module handles the "not loaded", "consent denied", and
// "server-side" cases silently.
//
// Scripts (GA4, Clarity, Vercel Analytics, Speed Insights) are mounted by
// `src/components/AnalyticsGate.tsx`, which reads consent from the
// existing CookieConsent-managed localStorage key and (re)mounts scripts
// when the consent state changes via the CONSENT_CHANGED_EVENT.
//
// ─── Adding a new event ───
// 1. Add the constant here to EVENTS
// 2. Add a call site: `import { track, EVENTS } from '@/lib/analytics'`
//                     `track(EVENTS.YOUR_EVENT, { ...params })`
// 3. Ship. No wrapper changes needed.

// ─── Event catalogue ───
// Kept as `as const` so TypeScript treats each value as a literal type.
// Extend for new events; do NOT reuse strings — GA4 treats each unique
// event_name as a first-class dimension.
export const EVENTS = {
  // Marketing surface — fired from public pages
  LANDING_PAGE_VIEW: 'landing_page_view',
  ONBOARD_CLICK: 'onboard_click',
  DEMO_CLICK: 'demo_click',

  // Product surface — fired from authenticated flows
  ACADEMY_SIGNUP_STARTED: 'academy_signup_started',
  ACADEMY_SIGNUP_COMPLETED: 'academy_signup_completed',
  STRIPE_CONNECT_STARTED: 'stripe_connect_started',
  STRIPE_CONNECT_COMPLETED: 'stripe_connect_completed',
  FIRST_PLAYER_ADDED: 'first_player_added',
  FIRST_CLASS_CREATED: 'first_class_created',
  FIRST_SUBSCRIPTION_CREATED: 'first_subscription_created',
  FIRST_PAYMENT_RECEIVED: 'first_payment_received',
  FIRST_FLEXIBLE_CAMP_CREATED: 'first_flexible_camp_created',
  ACADEMY_ACTIVATED: 'academy_activated',
} as const

export type AnalyticsEvent = (typeof EVENTS)[keyof typeof EVENTS]

// Event params are loose by design — GA4 accepts any string/number/boolean.
// Named fields document the common ones so callers get autocomplete.
export type AnalyticsParams = {
  page_path?: string
  page_referrer?: string
  landing_slug?: string     // 'football-academy-management-software' etc
  cta_location?: string     // 'hero' | 'pricing_teaser' | 'footer' | 'nav'
  organisation_id?: string
  camp_mode?: 'whole_camp' | 'flexible_days'
  [key: string]: string | number | boolean | undefined
}

// ─── Consent bridge ───
// The existing CookieConsent component writes 'all' | 'essential' to this
// localStorage key when the user chooses. AnalyticsGate reads from here on
// mount and listens for CONSENT_CHANGED_EVENT to remount scripts.
export const CONSENT_STORAGE_KEY = 'cookie-consent'
export const CONSENT_CHANGED_EVENT = 'pp:cookie-consent-changed'

export type ConsentState = 'all' | 'essential' | null

/**
 * Reads the current consent state from localStorage. Returns null server-
 * side or when the user hasn't chosen yet (banner still visible).
 *
 * "essential" means: only strictly-necessary cookies. Analytics must NOT
 * load. "all" means the user opted in to everything, including analytics.
 */
export function readConsent(): ConsentState {
  if (typeof window === 'undefined') return null
  try {
    const v = window.localStorage.getItem(CONSENT_STORAGE_KEY)
    return v === 'all' || v === 'essential' ? v : null
  } catch {
    // localStorage can throw in privacy modes / sandboxed iframes.
    return null
  }
}

// ─── track() ───
// Fire-and-forget. Safe to call from any context, at any time.
//
// Silently no-ops when:
//   * running server-side (typeof window === 'undefined')
//   * gtag hasn't loaded yet (AnalyticsGate not mounted or consent denied)
//
// This means callers can add track() anywhere without worrying about
// initialization order or consent state.
export function track(event: AnalyticsEvent, params?: AnalyticsParams): void {
  if (typeof window === 'undefined') return
  const w = window as unknown as { gtag?: (...args: unknown[]) => void }
  if (typeof w.gtag !== 'function') return
  try {
    w.gtag('event', event, params ?? {})
  } catch {
    // Never let an analytics call throw into product code.
  }
}
