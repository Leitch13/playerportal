export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      {/* Page title skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-48 bg-[#141414] rounded-lg animate-pulse" />
        <div className="h-9 w-32 bg-[#141414] rounded-lg animate-pulse" />
      </div>

      {/* Stat cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="bg-[#141414] border border-[#1e1e1e] rounded-xl p-5 space-y-3 animate-pulse"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <div className="flex items-center justify-between">
              <div className="h-4 w-24 bg-white/[0.06] rounded" />
              <div className="h-8 w-8 bg-white/[0.06] rounded-lg" />
            </div>
            <div className="h-8 w-16 bg-white/[0.06] rounded" />
            <div className="h-3 w-20 bg-white/[0.04] rounded" />
          </div>
        ))}
      </div>

      {/* Content area skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left panel */}
        <div className="bg-[#141414] border border-[#1e1e1e] rounded-xl p-6 space-y-4 animate-pulse" style={{ animationDelay: '200ms' }}>
          <div className="flex items-center justify-between">
            <div className="h-5 w-32 bg-white/[0.06] rounded" />
            <div className="h-4 w-16 bg-white/[0.04] rounded" />
          </div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-8 w-8 bg-white/[0.06] rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 bg-white/[0.06] rounded" style={{ width: `${85 - i * 10}%` }} />
                  <div className="h-2.5 bg-white/[0.04] rounded" style={{ width: `${60 - i * 8}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right panel */}
        <div className="bg-[#141414] border border-[#1e1e1e] rounded-xl p-6 space-y-4 animate-pulse" style={{ animationDelay: '300ms' }}>
          <div className="flex items-center justify-between">
            <div className="h-5 w-32 bg-white/[0.06] rounded" />
            <div className="h-4 w-16 bg-white/[0.04] rounded" />
          </div>
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-[#1e1e1e] last:border-0">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-white/[0.06] rounded-lg" />
                  <div className="space-y-1.5">
                    <div className="h-3.5 w-28 bg-white/[0.06] rounded" />
                    <div className="h-2.5 w-20 bg-white/[0.04] rounded" />
                  </div>
                </div>
                <div className="h-6 w-16 bg-white/[0.06] rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
