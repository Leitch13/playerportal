export default function ReviewsLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-40 bg-[#141414] rounded-lg animate-pulse" />
        <div className="h-9 w-32 bg-[#141414] rounded-lg animate-pulse" />
      </div>

      {/* Filter bar */}
      <div className="flex gap-3 animate-pulse">
        <div className="h-9 w-40 bg-[#141414] rounded-lg" />
        <div className="h-9 w-32 bg-[#141414] rounded-lg" />
      </div>

      {/* Review cards list */}
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="bg-[#141414] border border-[#1e1e1e] rounded-xl p-5 animate-pulse"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-white/[0.06] rounded-full" />
                <div className="space-y-1.5">
                  <div className="h-4 w-32 bg-white/[0.06] rounded" />
                  <div className="h-3 w-20 bg-white/[0.04] rounded" />
                </div>
              </div>
              <div className="flex gap-1">
                {[...Array(5)].map((_, j) => (
                  <div key={j} className="h-5 w-5 bg-white/[0.06] rounded" />
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="h-3 bg-white/[0.04] rounded w-full" />
              <div className="h-3 bg-white/[0.04] rounded w-3/4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
