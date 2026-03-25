'use client'

import Link from 'next/link'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-[#060606] text-white flex flex-col items-center justify-center px-6">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5 mb-16">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#4ecde6] to-[#2ba8c3] flex items-center justify-center shadow-lg shadow-[#4ecde6]/20">
          <span className="text-white font-extrabold text-xs">PP</span>
        </div>
        <span className="text-lg font-bold tracking-tight">Player Portal</span>
      </Link>

      <div className="text-center max-w-md">
        {/* Icon */}
        <div className="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-8">
          <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">
          Something went wrong
        </h1>

        <p className="text-white/40 text-sm mb-2 leading-relaxed">
          An unexpected error occurred while loading this page.
        </p>

        {error.message && (
          <div className="mt-4 mb-8 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white/30 text-xs font-mono break-all text-left">
            {error.message}
          </div>
        )}

        {!error.message && <div className="mb-8" />}

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={reset}
            className="px-8 py-3.5 bg-[#4ecde6] text-[#0a0a0a] rounded-full font-semibold text-sm hover:bg-[#7dddf0] transition-all shadow-lg shadow-[#4ecde6]/20 cursor-pointer"
          >
            Try Again
          </button>
          <Link
            href="/"
            className="px-8 py-3.5 border border-white/15 text-white/70 rounded-full font-semibold text-sm hover:bg-white/5 hover:text-white hover:border-white/25 transition-all"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  )
}
