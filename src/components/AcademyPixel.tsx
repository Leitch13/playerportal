'use client'

// AcademyPixel — mounts an ACADEMY'S OWN Meta Pixel on their public booking
// pages. Consent-gated identically to the platform's AnalyticsGate: nothing
// loads until the visitor accepts ALL cookies. Uses trackSingle so this
// pixel's events stay scoped to the academy.

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { CONSENT_CHANGED_EVENT, readConsent, type ConsentState } from '@/lib/analytics'
import { fbInitPixel, fbTrackSingle } from '@/lib/meta-pixel'

export default function AcademyPixel({ pixelId }: { pixelId: string | null | undefined }) {
  const [consent, setConsent] = useState<ConsentState>(null)
  const pathname = usePathname()

  useEffect(() => {
    setConsent(readConsent())
    const onChange = () => setConsent(readConsent())
    window.addEventListener(CONSENT_CHANGED_EVENT, onChange)
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, onChange)
  }, [])

  useEffect(() => {
    if (!pixelId || consent !== 'all') return
    fbInitPixel(pixelId)
    fbTrackSingle(pixelId, 'PageView')
  }, [pixelId, consent, pathname])

  return null
}
