// Meta Pixel helper — safe no-op wrapper around fbq.
//
// The pixel base script only mounts via AnalyticsGate when (a) the user has
// accepted ALL cookies and (b) NEXT_PUBLIC_META_PIXEL_ID is set. This helper
// therefore no-ops silently whenever fbq is absent, so conversion-event call
// sites never need their own guards and nothing throws for opted-out users.

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void
  }
}

export function fbTrack(event: string, params?: Record<string, unknown>) {
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') return
  try {
    window.fbq('track', event, params)
  } catch {
    /* analytics must never break the app */
  }
}
