export default function PlayersLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-36 bg-[#141414] rounded-lg animate-pulse" />
        <div className="flex items-center gap-3">
          <div className="h-9 w-48 bg-[#141414] rounded-lg animate-pulse" />
          <div className="h-9 w-28 bg-[#141414] rounded-lg animate-pulse" />
        </div>
      </div>

      {/* Search / filter bar */}
      <div className="flex items-center gap-3">
        <div className="h-10 flex-1 max-w-sm bg-[#141414] border border-[#1e1e1e] rounded-lg animate-pulse" />
        <div className="h-10 w-28 bg-[#141414] border border-[#1e1e1e] rounded-lg animate-pulse" />
      </div>

      {/* Player cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(9)].map((_, i) => (
          <div
            key={i}
            className="bg-[#141414] border border-[#1e1e1e] rounded-xl p-4 space-y-3 animate-pulse"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-white/[0.06] rounded-full" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-28 bg-white/[0.06] rounded" />
                <div className="h-3 w-20 bg-white/[0.04] rounded" />
              </div>
              <div className="h-6 w-14 bg-white/[0.06] rounded-full" />
            </div>
            <div className="flex items-center gap-2 pt-2 border-t border-[#1e1e1e]">
              <div className="h-3 w-16 bg-white/[0.04] rounded" />
              <div className="h-3 w-24 bg-white/[0.04] rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
