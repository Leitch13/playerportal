export default function PaymentsLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-40 bg-[#141414] rounded-lg animate-pulse" />
        <div className="h-9 w-32 bg-[#141414] rounded-lg animate-pulse" />
      </div>

      {/* Tabs skeleton */}
      <div className="flex items-center gap-1 bg-[#141414] border border-[#1e1e1e] rounded-lg p-1 w-fit animate-pulse">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-8 w-24 bg-white/[0.06] rounded-md" />
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="bg-[#141414] border border-[#1e1e1e] rounded-xl p-5 space-y-3 animate-pulse"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <div className="h-4 w-20 bg-white/[0.06] rounded" />
            <div className="h-7 w-24 bg-white/[0.06] rounded" />
            <div className="h-3 w-16 bg-white/[0.04] rounded" />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div className="bg-[#141414] border border-[#1e1e1e] rounded-xl overflow-hidden animate-pulse" style={{ animationDelay: '200ms' }}>
        {/* Table header */}
        <div className="flex items-center gap-4 px-5 py-3 border-b border-[#1e1e1e]">
          {['w-32', 'w-24', 'w-20', 'w-28', 'w-16', 'w-20'].map((w, i) => (
            <div key={i} className={`h-3 ${w} bg-white/[0.06] rounded`} />
          ))}
        </div>
        {/* Table rows */}
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-[#1e1e1e] last:border-0">
            <div className="h-4 w-32 bg-white/[0.06] rounded" />
            <div className="h-4 w-24 bg-white/[0.04] rounded" />
            <div className="h-4 w-20 bg-white/[0.04] rounded" />
            <div className="h-4 w-28 bg-white/[0.04] rounded" />
            <div className="h-5 w-16 bg-white/[0.06] rounded-full" />
            <div className="h-4 w-20 bg-white/[0.04] rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
