'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

/**
 * Friendly "see you soon" page shown right after a user signs out.
 * Replaces dropping them straight onto the signin form, which feels abrupt.
 *
 * - Animated wave emoji
 * - Branded farewell card
 * - Auto-redirects to /auth/signin after 6 seconds (configurable)
 * - "Sign in again" CTA in case they want to come straight back
 */
export default function SignedOutPage() {
  const accent = '#4ecde6'
  const [countdown, setCountdown] = useState(6)

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((n) => {
        if (n <= 1) {
          clearInterval(interval)
          window.location.href = '/auth/signin'
          return 0
        }
        return n - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-[#060606] flex items-center justify-center px-4 py-12 relative overflow-hidden">
      <div
        className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full blur-[200px] opacity-20 pointer-events-none animate-blob-1"
        style={{ background: accent }}
      />
      <div
        className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full blur-[150px] opacity-10 pointer-events-none animate-blob-2"
        style={{ background: accent }}
      />

      <div className="relative w-full max-w-md text-center">
        <div className="mb-6 inline-block animate-wave-in">
          <span className="text-7xl inline-block animate-wave origin-bottom-right" role="img" aria-label="waving hand">
            👋
          </span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-3 tracking-tight">
          See you soon!
        </h1>
        <p className="text-white/50 text-base mb-8">
          You&apos;re signed out. Your data is safe — sign back in any time to pick up where you left off.
        </p>

        <div className="rounded-2xl border border-white/[0.08] bg-[#141414] p-6 shadow-2xl">
          <Link
            href="/auth/signin"
            className="block w-full py-3.5 rounded-xl font-bold text-base transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: 'white',
              color: '#0a0a0a',
              boxShadow: `0 0 28px ${accent}50`,
            }}
          >
            Sign in again
          </Link>
          <Link
            href="/"
            className="block mt-3 py-3 rounded-xl text-sm font-medium text-white/50 hover:text-white/80 transition-colors"
          >
            Back to homepage
          </Link>
        </div>

        <p className="text-xs text-white/30 mt-6">
          Redirecting you in <span className="font-semibold text-white/50 tabular-nums">{countdown}</span> seconds…
        </p>

        <p className="text-center text-xs text-white/20 mt-10">
          Powered by Player Portal
        </p>
      </div>

      <style>{`
        @keyframes blob-1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(40px, -30px) scale(1.08); }
        }
        @keyframes blob-2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-30px, 40px) scale(0.95); }
        }
        @keyframes wave-in {
          0% { transform: scale(0) rotate(-30deg); opacity: 0; }
          60% { transform: scale(1.15) rotate(10deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes wave {
          0%, 100% { transform: rotate(0deg); }
          15% { transform: rotate(-20deg); }
          30% { transform: rotate(14deg); }
          45% { transform: rotate(-10deg); }
          60% { transform: rotate(8deg); }
          75% { transform: rotate(-4deg); }
        }
        .animate-blob-1 { animation: blob-1 20s ease-in-out infinite; }
        .animate-blob-2 { animation: blob-2 25s ease-in-out infinite; }
        .animate-wave-in { animation: wave-in 0.6s ease-out; }
        .animate-wave { animation: wave 1.8s ease-in-out infinite 0.6s; }
      `}</style>
    </div>
  )
}
