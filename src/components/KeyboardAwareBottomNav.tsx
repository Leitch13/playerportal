'use client'

import { useEffect } from 'react'

/**
 * PWA Phase 1c — soft-keyboard fallback for browsers that don't honour
 * `interactive-widget=resizes-content` (Safari <17, some Android WebViews).
 *
 * Uses `window.visualViewport` to detect when the soft keyboard eats a
 * significant chunk of the screen and toggles `data-keyboard-open="true"`
 * on <body>. globals.css already hides `.mobile-bottom-nav` when that
 * attribute is present.
 *
 * Zero UI. No portals. No focus stealing. Pure attribute toggle.
 */
export default function KeyboardAwareBottomNav() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    const vv = window.visualViewport
    if (!vv) return

    let ticking = false

    function update() {
      ticking = false
      // Heuristic: when the visual viewport is meaningfully shorter than
      // the layout viewport, a soft keyboard is very likely open. 150px
      // gap is enough to avoid false positives from browser chrome (URL
      // bar collapse) but small enough to catch every real keyboard.
      const layoutHeight = window.innerHeight
      const visualHeight = vv!.height
      const keyboardOpen = layoutHeight - visualHeight > 150
      const body = document.body
      if (keyboardOpen) body.dataset.keyboardOpen = 'true'
      else delete body.dataset.keyboardOpen
    }

    function onResize() {
      if (ticking) return
      ticking = true
      requestAnimationFrame(update)
    }

    vv.addEventListener('resize', onResize)
    vv.addEventListener('scroll', onResize)
    // Initial pass in case the tab is restored with a keyboard already up.
    update()

    return () => {
      vv.removeEventListener('resize', onResize)
      vv.removeEventListener('scroll', onResize)
      delete document.body.dataset.keyboardOpen
    }
  }, [])

  return null
}
