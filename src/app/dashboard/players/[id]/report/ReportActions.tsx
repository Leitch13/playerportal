'use client'

import Link from 'next/link'

export default function ReportActions({ playerId }: { playerId: string }) {
  return (
    <div className="no-print flex items-center gap-3 mb-6">
      <Link
        href={`/dashboard/players/${playerId}`}
        className="inline-flex items-center gap-1.5 text-sm text-text-light hover:text-text transition-colors"
      >
        &larr; Back to Profile
      </Link>
      <button
        onClick={() => window.print()}
        className="ml-auto inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-light transition-colors"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
          />
        </svg>
        Print Report
      </button>
    </div>
  )
}
