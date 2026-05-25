export default function GroupsLoading() {
  return (
    <div className="space-y-6">
      {/* Header with title + add button */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-36 bg-[#141414] rounded-lg animate-pulse" />
        <div className="h-9 w-36 bg-[#141414] rounded-lg animate-pulse" />
      </div>

      {/* Group cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="bg-[#141414] border border-[#1e1e1e] rounded-xl p-5 space-y-3 animate-pulse"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="flex items-center justify-between">
              <div className="h-5 w-32 bg-white/[0.06] rounded" />
              <div className="h-6 w-16 bg-white/[0.06] rounded-full" />
            </div>
            <div className="h-3 w-24 bg-white/[0.04] rounded" />
            <div className="flex items-center gap-2 pt-2">
              <div className="h-4 w-4 bg-white/[0.06] rounded-full" />
              <div className="h-3 w-28 bg-white/[0.04] rounded" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 bg-white/[0.06] rounded-full" />
              <div className="h-3 w-20 bg-white/[0.04] rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
