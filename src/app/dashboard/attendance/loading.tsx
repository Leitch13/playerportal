export default function AttendanceLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-40 bg-[#141414] rounded-lg animate-pulse" />
        <div className="flex items-center gap-3">
          <div className="h-9 w-36 bg-[#141414] rounded-lg animate-pulse" />
          <div className="h-9 w-28 bg-[#141414] rounded-lg animate-pulse" />
        </div>
      </div>

      {/* Date / group selector bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="h-10 w-44 bg-[#141414] border border-[#1e1e1e] rounded-lg animate-pulse" />
        <div className="h-10 w-36 bg-[#141414] border border-[#1e1e1e] rounded-lg animate-pulse" />
      </div>

      {/* Attendance list */}
      <div className="bg-[#141414] border border-[#1e1e1e] rounded-xl overflow-hidden">
        {/* List header */}
        <div className="flex items-center gap-4 px-5 py-3 border-b border-[#1e1e1e] animate-pulse">
          <div className="h-3 w-40 bg-white/[0.06] rounded" />
          <div className="ml-auto h-3 w-20 bg-white/[0.06] rounded" />
        </div>
        {/* Rows */}
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-5 py-3.5 border-b border-[#1e1e1e] last:border-0 animate-pulse"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="h-9 w-9 bg-white/[0.06] rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-32 bg-white/[0.06] rounded" />
              <div className="h-2.5 w-20 bg-white/[0.04] rounded" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 bg-white/[0.06] rounded-lg" />
              <div className="h-8 w-8 bg-white/[0.06] rounded-lg" />
              <div className="h-8 w-8 bg-white/[0.06] rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
