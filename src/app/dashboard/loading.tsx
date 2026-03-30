export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Page title skeleton */}
      <div className="h-8 w-48 bg-white/5 rounded-lg" />

      {/* Stat cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white/5 rounded-xl p-5 space-y-3">
            <div className="h-4 w-24 bg-white/5 rounded" />
            <div className="h-8 w-16 bg-white/5 rounded" />
          </div>
        ))}
      </div>

      {/* Content area skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white/5 rounded-xl p-6 space-y-4">
          <div className="h-5 w-32 bg-white/5 rounded" />
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-4 bg-white/5 rounded" style={{ width: `${85 - i * 10}%` }} />
            ))}
          </div>
        </div>
        <div className="bg-white/5 rounded-xl p-6 space-y-4">
          <div className="h-5 w-32 bg-white/5 rounded" />
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-4 bg-white/5 rounded" style={{ width: `${90 - i * 12}%` }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
