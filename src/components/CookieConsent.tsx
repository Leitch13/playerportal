'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const consent = localStorage.getItem('cookie-consent')
    if (!consent) {
      const timer = setTimeout(() => setVisible(true), 500)
      return () => clearTimeout(timer)
    }
  }, [])

  function accept(level: 'all' | 'essential') {
    localStorage.setItem('cookie-consent', level)
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      className="fixed bottom-0 inset-x-0 z-50 animate-slide-up"
      style={{
        animation: 'slideUp 0.35s ease-out forwards',
      }}
    >
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>

      <div className="border-t border-[#1e1e1e] bg-[#141414]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-3 sm:flex-row sm:justify-between sm:gap-6">
          <p className="text-sm text-neutral-400">
            We use cookies to improve your experience. Essential cookies are
            required for the site to function.{' '}
            <Link href="/privacy" className="text-[#4ecde6] underline underline-offset-2 hover:text-[#4ecde6]/80">
              Learn more
            </Link>
          </p>

          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => accept('essential')}
              className="rounded-md border border-[#1e1e1e] bg-transparent px-4 py-1.5 text-sm text-neutral-300 transition-colors hover:border-[#4ecde6]/40 hover:text-white"
            >
              Essential Only
            </button>
            <button
              onClick={() => accept('all')}
              className="rounded-md bg-[#4ecde6] px-4 py-1.5 text-sm font-medium text-[#0a0a0a] transition-colors hover:bg-[#4ecde6]/85"
            >
              Accept All
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
