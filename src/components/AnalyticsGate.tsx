'use client'

// AnalyticsGate — Growth Phase 1A.
//
// Mounts analytics scripts once the user has accepted 'all' cookies via
// the existing CookieConsent banner. Everything is consent-gated for
// GDPR compliance — no external requests fire until the user opts in.
//
// Individual tools are additionally gated on their own env var. If a
// tool's env var is unset (e.g. Clarity in dev), that tool is not
// mounted even if consent is 'all'. This lets us stage tools across
// environments via Vercel env config alone, no code changes needed.
//
// ─── Reactivity ───
// On mount we read the current consent state. If it changes later (user
// clicks "Accept all" after page load), CookieConsent dispatches a
// CONSENT_CHANGED_EVENT and this component re-reads state + mounts the
// scripts. No page reload required.
//
// Server render always returns null (mounted=false initially) so there
// is no hydration mismatch — the client always agrees with the server
// on the first paint, then swaps to real content once state settles.

import { useEffect, useState } from 'react'
import Script from 'next/script'
import { GoogleAnalytics } from '@next/third-parties/google'
import { Analytics as VercelAnalytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import {
  CONSENT_CHANGED_EVENT,
  readConsent,
  type ConsentState,
} from '@/lib/analytics'

const GA_ID = process.env.NEXT_PUBLIC_GA_ID
const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_ID

export default function AnalyticsGate() {
  // `mounted` guards against SSR/hydration mismatches — the first render
  // must match the server (which has no window / localStorage).
  const [mounted, setMounted] = useState(false)
  const [consent, setConsent] = useState<ConsentState>(null)

  useEffect(() => {
    setMounted(true)
    setConsent(readConsent())

    const onChange = () => setConsent(readConsent())
    window.addEventListener(CONSENT_CHANGED_EVENT, onChange)
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, onChange)
  }, [])

  // Fail-safe: server render, pre-hydration, or user hasn't opted in.
  if (!mounted || consent !== 'all') return null

  return (
    <>
      {GA_ID && <GoogleAnalytics gaId={GA_ID} />}
      {CLARITY_ID && (
        <Script id="ms-clarity" strategy="afterInteractive">
          {`(function(c,l,a,r,i,t,y){
            c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
            t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
            y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
          })(window, document, "clarity", "script", "${CLARITY_ID}");`}
        </Script>
      )}
      <VercelAnalytics />
      <SpeedInsights />
    </>
  )
}
