export default function SettingsLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="h-8 w-32 bg-[#141414] rounded-lg animate-pulse" />

      {/* Tabs */}
      <div className="flex gap-2 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-9 w-24 bg-[#141414] rounded-lg" />
        ))}
      </div>

      {/* Settings form sections */}
      <div className="bg-[#141414] border border-[#1e1e1e] rounded-xl p-6 space-y-6 animate-pulse" style={{ animationDelay: '100ms' }}>
        <div className="h-5 w-36 bg-white/[0.06] rounded" />
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-3.5 w-24 bg-white/[0.06] rounded" />
              <div className="h-10 w-full bg-white/[0.04] rounded-lg" />
            </div>
          ))}
        </div>
        <div className="h-10 w-28 bg-white/[0.06] rounded-lg" />
      </div>

      {/* Team members section */}
      <div className="bg-[#141414] border border-[#1e1e1e] rounded-xl p-6 space-y-4 animate-pulse" style={{ animationDelay: '200ms' }}>
        <div className="flex items-center justify-between">
          <div className="h-5 w-32 bg-white/[0.06] rounded" />
          <div className="h-8 w-28 bg-white/[0.06] rounded-lg" />
        </div>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center justify-between py-3 border-b border-[#1e1e1e] last:border-0">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 bg-white/[0.06] rounded-full" />
              <div className="space-y-1.5">
                <div className="h-3.5 w-32 bg-white/[0.06] rounded" />
                <div className="h-2.5 w-44 bg-white/[0.04] rounded" />
              </div>
            </div>
            <div className="h-6 w-16 bg-white/[0.06] rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
