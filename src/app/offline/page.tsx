'use client'

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-white p-8">
      <div className="text-center">
        <p className="text-5xl mb-4">⚽</p>
        <h1 className="text-2xl font-bold mb-2">You&apos;re Offline</h1>
        <p className="text-white/50 mb-6">Check your internet connection and try again.</p>
        <button
          onClick={() => window.location.reload()}
          className="px-8 py-3 rounded-xl font-semibold bg-[#4ecde6] text-[#0a0a0a] hover:opacity-90 transition-opacity"
        >
          Try Again
        </button>
      </div>
    </div>
  )
}
