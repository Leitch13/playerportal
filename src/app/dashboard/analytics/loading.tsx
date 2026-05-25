export default function AnalyticsLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="h-8 w-36 bg-[#141414] rounded-lg animate-pulse" />

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="bg-[#141414] border border-[#1e1e1e] rounded-xl p-5 space-y-3 animate-pulse"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <div className="h-4 w-24 bg-white/[0.06] rounded" />
            <div className="h-8 w-20 bg-white/[0.06] rounded" />
            <div className="h-3 w-16 bg-white/[0.04] rounded" />
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#141414] border border-[#1e1e1e] rounded-xl p-6 animate-pulse" style={{ animationDelay: '200ms' }}>
          <div className="h-5 w-40 bg-white/[0.06] rounded mb-4" />
          <div className="h-48 bg-white/[0.04] rounded-lg" />
        </div>
        <div className="bg-[#141414] border border-[#1e1e1e] rounded-xl p-6 animate-pulse" style={{ animationDelay: '300ms' }}>
          <div className="h-5 w-36 bg-white/[0.06] rounded mb-4" />
          <div className="h-48 bg-white/[0.04] rounded-lg" />
        </div>
      </div>

      {/* Heatmap area */}
      <div className="bg-[#141414] border border-[#1e1e1e] rounded-xl p-6 animate-pulse" style={{ animationDelay: '400ms' }}>
        <div className="h-5 w-44 bg-white/[0.06] rounded mb-4" />
        <div className="h-40 bg-white/[0.04] rounded-lg" />
      </div>
    </div>
  )
}
