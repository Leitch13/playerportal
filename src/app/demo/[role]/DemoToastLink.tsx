'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

/**
 * Wraps any element in the demo so that clicks pop a soft conversion toast
 * instead of doing nothing. The toast says "Demo mode — sign up to actually
 * <action>" and surfaces a Get Started Free CTA.
 *
 * `actionLabel` (optional) gets dropped into the message so the toast reads
 * naturally, e.g. "Sign up to actually Book a Session". Falls back to a
 * generic "interact with this".
 */
export default function DemoToastLink({
  children,
  className = '',
  actionLabel,
}: {
  children: React.ReactNode
  className?: string
  actionLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setOpen(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setOpen(false), 5000)
  }

  const verb = actionLabel
    ? actionLabel.toLowerCase().replace(/^(view|message|start|write|see|book|refer)\b/i, (m) => m.toLowerCase())
    : 'interact with this'

  return (
    <>
      <span className={`cursor-pointer ${className}`} onClick={handleClick}>
        {children}
      </span>

      {open && (
        <div
          className="fixed bottom-6 right-6 z-[1000] max-w-sm bg-[#141414] border border-[#4ecde6]/30 rounded-2xl shadow-2xl shadow-[#4ecde6]/20 p-4 animate-slide-up"
          role="status"
        >
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#4ecde6]/15 flex items-center justify-center flex-shrink-0">
              <span className="text-lg">👀</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">You&apos;re in demo mode</p>
              <p className="text-xs text-white/60 mt-0.5">
                Sign up free to actually {actionLabel ? <span className="text-[#4ecde6]">{actionLabel.toLowerCase()}</span> : verb} and run your academy.
              </p>
              <div className="flex items-center gap-2 mt-3">
                <Link
                  href="/auth/signup"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white text-black text-xs font-semibold hover:bg-white/90 transition-colors"
                  style={{ boxShadow: '0 0 16px rgba(78, 205, 230, 0.4)' }}
                >
                  Get Started Free
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
                <button
                  onClick={() => setOpen(false)}
                  className="text-xs text-white/40 hover:text-white/70 transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.25s ease-out;
        }
      `}</style>
    </>
  )
}
