'use client'

/**
 * Offline fallback page. Served by the service worker whenever a
 * navigation fetch fails (see public/sw.js → networkFirstNavigation).
 *
 * Deliberately does NOT try to render cached authenticated content —
 * see Phase 1b constraints. Anything requiring live data (dashboard,
 * schedule, messages) will need to wait for connectivity to return.
 */

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-white p-6 safe-x safe-y">
      <div className="w-full max-w-md text-center">
        {/* Brand mark */}
        <div className="mx-auto mb-8 w-20 h-20 rounded-3xl bg-[#4ecde6]/10 border border-[#4ecde6]/30 flex items-center justify-center">
          <svg
            viewBox="0 0 24 24"
            className="w-9 h-9 text-[#4ecde6]"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 4l16 16M20 4L4 20M12 3v2m0 14v2m9-9h-2M5 12H3m14.5-6.5l-1.4 1.4m-9.2 9.2l-1.4 1.4M17.5 17.5l-1.4-1.4m-9.2-9.2L5.5 5.5"
            />
          </svg>
        </div>

        <h1 className="text-2xl sm:text-3xl font-black tracking-tight mb-3">
          You&apos;re offline.
        </h1>
        <p className="text-white/60 leading-relaxed mb-8">
          Player Portal needs an internet connection to load bookings,
          payments and messages. Reconnect and we&apos;ll pick right up where
          you left off.
        </p>

        {/* What still works */}
        <div className="mb-8 text-left rounded-2xl bg-white/[0.03] border border-white/10 p-5">
          <p className="text-[11px] uppercase tracking-widest text-white/50 font-semibold mb-3">
            While you&apos;re offline
          </p>
          <ul className="space-y-2 text-sm text-white/75">
            <li className="flex items-start gap-2">
              <span className="text-[#4ecde6] mt-0.5" aria-hidden>✓</span>
              This page and the app icons stay available.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#4ecde6] mt-0.5" aria-hidden>✓</span>
              Your session is preserved — no need to sign back in.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-white/40 mt-0.5" aria-hidden>✕</span>
              Live data (schedules, payments, messages) needs a connection.
            </li>
          </ul>
        </div>

        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center justify-center gap-2 w-full min-h-[48px] px-8 rounded-full font-semibold bg-[#4ecde6] text-[#0a0a0a] hover:bg-[#6eddf2] transition-colors"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
          </svg>
          Try again
        </button>

        <p className="mt-6 text-xs text-white/40">Player Portal</p>
      </div>
    </div>
  )
}
