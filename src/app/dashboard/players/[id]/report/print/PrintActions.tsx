'use client'

import Link from 'next/link'

export default function PrintActions({ playerId }: { playerId: string }) {
  return (
    <div className="no-print flex items-center gap-3 mb-6 print:hidden">
      <Link
        href={`/dashboard/players/${playerId}`}
        className="inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white transition-colors"
      >
        &larr; Back to Profile
      </Link>
      <Link
        href={`/dashboard/players/${playerId}/report`}
        className="inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white transition-colors"
      >
        View Standard Report
      </Link>
      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-light transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Download as PDF
        </button>
        <button
          onClick={() => {
            if (navigator.share) {
              navigator.share({
                title: 'Player Progress Report',
                url: window.location.href,
              })
            } else {
              navigator.clipboard.writeText(window.location.href)
              alert('Report link copied to clipboard')
            }
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 text-white rounded-lg text-sm font-medium hover:bg-white/20 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          Share with Parent
        </button>
      </div>
    </div>
  )
}
