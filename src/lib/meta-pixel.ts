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

// ── Per-academy pixels ("bring your own Pixel") ──────────────────────────
// An academy's pixel is initialised on THEIR booking pages only. Events use
// trackSingle so academy events never leak to the platform pixel (or vice
// versa) when both are present.

export function fbEnsureBase() {
  if (typeof window === 'undefined') return
  if (typeof window.fbq === 'function') return
  /* eslint-disable */
  ;(function (f: any, b: any, e: any, v: any) {
    let n: any, t: any, s: any
    if (f.fbq) return
    n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments) }
    if (!f._fbq) f._fbq = n
    n.push = n; n.loaded = true; n.version = '2.0'; n.queue = []
    t = b.createElement(e); t.async = true; t.src = v
    s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s)
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js')
  /* eslint-enable */
}

const inited = new Set<string>()
export function fbInitPixel(pixelId: string) {
  if (typeof window === 'undefined' || !pixelId) return
  fbEnsureBase()
  if (inited.has(pixelId)) return
  window.fbq!('init', pixelId)
  inited.add(pixelId)
}

export function fbTrackSingle(pixelId: string | null | undefined, event: string, params?: Record<string, unknown>) {
  if (!pixelId || typeof window === 'undefined' || typeof window.fbq !== 'function') return
  try { window.fbq('trackSingle', pixelId, event, params) } catch { /* never break the app */ }
}
