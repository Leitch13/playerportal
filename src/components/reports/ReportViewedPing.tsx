'use client'

import { useEffect, useRef } from 'react'

// Slice B — fires a one-shot "report viewed" ping when the owning parent opens
// the report. Rendered by the report page ONLY when the viewer is the owning
// parent and REPORT_VIEWED_TRACKING_ENABLED is on. Renders nothing; the POST is
// fire-and-forget and never affects the page. The ref guards React StrictMode's
// double-mount in dev so we don't double-fire.
export default function ReportViewedPing({ playerId }: { playerId: string }) {
  const fired = useRef(false)

  useEffect(() => {
    if (fired.current) return
    fired.current = true
    fetch(`/api/players/${playerId}/report/viewed`, { method: 'POST' }).catch(() => {})
  }, [playerId])

  return null
}
