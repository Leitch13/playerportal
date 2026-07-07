'use client'

import { useState, useEffect } from 'react'

/**
 * PWA install prompt. Handles two entirely separate platforms:
 *
 *   1. Android / Chromium — the browser fires `beforeinstallprompt`,
 *      we intercept it, and render a bottom banner with a button that
 *      triggers the browser's native install flow.
 *
 *   2. iOS Safari — Safari does NOT fire `beforeinstallprompt`. The
 *      only way to install a PWA on iOS is via the Share sheet →
 *      "Add to Home Screen". We render an instruction card telling
 *      the user which two taps to make.
 *
 * Never shows both. Never shows either once installed (standalone).
 * Dismiss persists in localStorage; separate keys for Android vs iOS
 * so a user who dismisses one prompt on their phone doesn't hide the
 * other on their household's Android tablet.
 *
 * `DISMISS_KEY` retains the legacy value used by the pre-Phase-1b
 * component so any historically-dismissed install stays dismissed.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'pwa-install-dismissed'
const IOS_DISMISS_KEY = 'pwa-install-dismissed-ios'

function isIOSDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  // `MSStream` guards against IE 11 Mobile (which reports an iOS-like UA).
  return /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream
}

function isStandaloneDisplayMode(): boolean {
  if (typeof window === 'undefined') return false
  const modeMatches = window.matchMedia?.('(display-mode: standalone)')?.matches === true
  const legacyIOS = (window.navigator as unknown as { standalone?: boolean }).standalone === true
  return modeMatches || legacyIOS
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isIOS, setIsIOS] = useState(false)
  const [showIOS, setShowIOS] = useState(false)
  const [dismissedAll, setDismissedAll] = useState(false)
  const [dismissedIOS, setDismissedIOS] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Suppress everything if already running standalone. Prevents the
    // Android banner from flashing during PWA startup and stops iOS
    // instructions from showing to someone who's already installed.
    if (isStandaloneDisplayMode()) {
      setDismissedAll(true)
      return
    }

    // Respect prior dismisses.
    try {
      if (localStorage.getItem(DISMISS_KEY)) setDismissedAll(true)
      if (localStorage.getItem(IOS_DISMISS_KEY)) setDismissedIOS(true)
    } catch { /* Safari private-mode localStorage can throw */ }

    const ios = isIOSDevice()
    setIsIOS(ios)
    if (ios) setShowIOS(true)

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function handleInstall() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setDeferredPrompt(null)
  }

  function handleDismissAll() {
    setDismissedAll(true)
    try { localStorage.setItem(DISMISS_KEY, 'true') } catch { /* private mode */ }
  }

  function handleDismissIOS() {
    setDismissedIOS(true)
    try { localStorage.setItem(IOS_DISMISS_KEY, 'true') } catch { /* private mode */ }
  }

  // Priority: dismissed-all-or-standalone → nothing.
  // Then Android's native prompt if the event fired.
  // Then iOS Safari instructions.
  if (dismissedAll) return null

  if (deferredPrompt) {
    return (
      <div
        className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50 bg-primary text-white rounded-2xl p-4 shadow-2xl border border-white/10"
        role="dialog"
        aria-label="Install Player Portal"
      >
        <div className="flex items-start gap-3">
          <span className="text-2xl" aria-hidden>⚽</span>
          <div className="flex-1">
            <p className="font-bold text-sm">Install Player Portal</p>
            <p className="text-xs text-white/60 mt-0.5">Add to your home screen for the best experience</p>
          </div>
          <button
            onClick={handleDismissAll}
            className="text-white/40 hover:text-white text-lg leading-none min-h-[44px] min-w-[44px]"
            aria-label="Dismiss install prompt"
          >
            ×
          </button>
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={handleInstall}
            className="flex-1 py-2 rounded-xl text-sm font-semibold bg-accent text-primary hover:opacity-90 transition-all"
          >
            Install App
          </button>
          <button
            onClick={handleDismissAll}
            className="px-4 py-2 rounded-xl text-sm font-medium text-white/60 hover:text-white transition-colors"
          >
            Not now
          </button>
        </div>
      </div>
    )
  }

  if (isIOS && showIOS && !dismissedIOS) {
    return (
      <div
        className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50 bg-primary text-white rounded-2xl p-4 shadow-2xl border border-white/10"
        role="dialog"
        aria-label="Add Player Portal to your Home Screen"
      >
        <div className="flex items-start gap-3">
          <span className="text-2xl" aria-hidden>⚽</span>
          <div className="flex-1">
            <p className="font-bold text-sm">Add to Home Screen</p>
            <p className="text-xs text-white/60 mt-0.5">Install Player Portal on your iPhone for the best experience.</p>
          </div>
          <button
            onClick={handleDismissIOS}
            className="text-white/40 hover:text-white text-lg leading-none min-h-[44px] min-w-[44px]"
            aria-label="Dismiss install prompt"
          >
            ×
          </button>
        </div>
        <ol className="mt-3 space-y-1.5 text-xs text-white/80 leading-relaxed">
          <li>
            1. Tap the Share button
            <span
              aria-hidden
              className="inline-flex items-center justify-center align-middle mx-1 w-5 h-5 rounded-md bg-white/10 border border-white/15"
            >
              <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12M8 7l4-4 4 4M6 12v7a2 2 0 002 2h8a2 2 0 002-2v-7" />
              </svg>
            </span>
            at the bottom of Safari.
          </li>
          <li>2. Choose <span className="font-semibold text-white">Add to Home Screen</span>.</li>
        </ol>
        <p className="mt-2 text-[11px] text-white/50">
          Not seeing the Share button? Only Safari can install web apps on iOS — try opening this page in Safari.
        </p>
        <div className="flex gap-2 mt-3">
          <button
            onClick={handleDismissIOS}
            className="flex-1 py-2 rounded-xl text-sm font-medium text-white/70 hover:text-white bg-white/[0.05] border border-white/10 transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    )
  }

  return null
}
