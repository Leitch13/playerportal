'use client'

import { useState, useEffect } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (localStorage.getItem('pwa-install-dismissed')) {
      setDismissed(true)
      return
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!deferredPrompt || dismissed) return null

  async function handleInstall() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setDeferredPrompt(null)
    }
  }

  function handleDismiss() {
    setDismissed(true)
    localStorage.setItem('pwa-install-dismissed', 'true')
  }

  return (
    <div className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50 bg-primary text-white rounded-2xl p-4 shadow-2xl border border-white/10">
      <div className="flex items-start gap-3">
        <span className="text-2xl">⚽</span>
        <div className="flex-1">
          <p className="font-bold text-sm">Install Player Portal</p>
          <p className="text-xs text-white/60 mt-0.5">Add to your home screen for the best experience</p>
        </div>
        <button onClick={handleDismiss} className="text-white/40 hover:text-white text-lg leading-none">×</button>
      </div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={handleInstall}
          className="flex-1 py-2 rounded-xl text-sm font-semibold bg-accent text-primary hover:opacity-90 transition-all"
        >
          Install App
        </button>
        <button
          onClick={handleDismiss}
          className="px-4 py-2 rounded-xl text-sm font-medium text-white/60 hover:text-white transition-colors"
        >
          Not now
        </button>
      </div>
    </div>
  )
}
