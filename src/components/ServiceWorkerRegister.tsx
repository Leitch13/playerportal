'use client'

import { useEffect } from 'react'

/**
 * Registers the Player Portal service worker on client mount.
 *
 * Phase 1b hardening:
 *   • Surface registration errors to `console.warn` (v1 swallowed them
 *     silently, which meant an SW file 404 was invisible in prod).
 *   • Log successful registration + activated scope at `console.info`.
 *   • Trigger an `update()` check on load — Chrome will do this
 *     automatically eventually, but the explicit call means an updated
 *     SW rolls out to already-open tabs within seconds of a redeploy.
 *   • Reload the page once when a newly-installed SW takes control,
 *     so the user gets the fresh version's assets without having to
 *     hard-refresh. Guarded with a session-scoped flag so a runaway
 *     controller-swap never causes an infinite reload loop.
 *
 * Deliberately zero UI. No user-facing prompts, no permissions asks.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    let reloaded = false
    const RELOAD_FLAG = 'pp-sw-reloaded-once'

    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        // Explicit update check on load — surfaces new SWs quickly.
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

    // When a fresh SW takes over an already-open tab, do exactly one
    // gentle reload so cache-first assets refresh from the new bundle.
    const handleControllerChange = () => {
      try {
        if (reloaded) return
        if (sessionStorage.getItem(RELOAD_FLAG)) return
        sessionStorage.setItem(RELOAD_FLAG, '1')
        reloaded = true
        window.location.reload()
      } catch {
        // Safari private mode etc. — leave the tab alone.
      }
    }
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
    }
  }, [])

  return null
}
