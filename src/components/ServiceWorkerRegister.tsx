'use client'

import { useEffect } from 'react'

/**
 * Registers the Player Portal service worker on client mount.
 *
 *   • Registration errors are surfaced to `console.warn` (v1 swallowed them
 *     silently, which hid the fact that `/sw.js` was auth-guarded and SW
 *     registration was actually failing in prod).
 *   • Successful registration + activated scope logged at `console.info`.
 *   • Explicit `update()` on load — Chrome does this automatically eventually,
 *     but the explicit call means an updated SW rolls out to already-open
 *     tabs within seconds of a redeploy.
 *
 * Update-rollout safety (Phase 1 production hardening):
 *   • The audit flagged that immediately reloading on `controllerchange`
 *     can lose form data / interrupt onboarding / interrupt Stripe checkout
 *     if the user is actively on the page when a new SW ships.
 *   • Strategy: DEFER the reload. We track a `pendingUpdate` flag when the
 *     new SW takes control. We only reload when `document.hidden` — i.e.
 *     the user is on another tab, has minimised the window, or has locked
 *     the phone. That guarantees we never interrupt an active session.
 *   • On the very first registration (no prior controller) `controllerchange`
 *     fires immediately but there's nothing user-visible to lose, so this
 *     defer-until-hidden pattern is still safe — the user gets updates on
 *     their next natural page navigation (which will hit the new SW).
 *   • If the user never leaves the tab, that's fine — they get new assets
 *     the moment they navigate to any route or reload manually.
 *
 * Deliberately zero UI. No prompts, no toasts.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    let pendingUpdate = false

    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        registration.update().catch(() => { /* not fatal */ })
        // eslint-disable-next-line no-console
        console.info('[sw] registered', {
          scope: registration.scope,
          state: registration.active?.state ?? '(no active worker yet)',
        })
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.warn('[sw] registration failed', err)
      })

    // Only reload if a new SW is pending AND the user isn't actively
    // looking at the page. Never interrupts an active session.
    const applyIfSafe = () => {
      if (!pendingUpdate) return
      if (!document.hidden) return
      pendingUpdate = false
      window.location.reload()
    }

    const handleControllerChange = () => {
      pendingUpdate = true
      applyIfSafe()
    }
    const handleVisibilityChange = () => {
      applyIfSafe()
    }

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  return null
}
