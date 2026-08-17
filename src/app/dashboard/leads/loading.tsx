export default function LeadsLoading() {
  return (
    <div className="bg-[#080e18] -m-6 lg:-m-8 p-4 sm:p-6 lg:p-8 min-h-screen text-white space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-40 bg-[#0f1a2b] rounded-lg animate-pulse" />
        <div className="h-9 w-28 bg-[#0f1a2b] rounded-lg animate-pulse" />
      </div>

      {/* Pipeline columns */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {['New', 'Contacted', 'Trial', 'Converted'].map((_, i) => (
          <div
            key={i}
            className="bg-[#0f1a2b] border border-[#1d2c42] rounded-xl p-4 space-y-3 animate-pulse"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="h-5 w-24 bg-white/[0.06] rounded" />
              <div className="h-5 w-6 bg-white/[0.06] rounded-full" />
            </div>
            {[...Array(3 - Math.floor(i / 2))].map((_, j) => (
              <div key={j} className="bg-[#080e18] rounded-lg p-3 space-y-2">
                <div className="h-4 w-28 bg-white/[0.06] rounded" />
                <div className="h-3 w-36 bg-white/[0.04] rounded" />
                <div className="h-3 w-20 bg-white/[0.04] rounded" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
