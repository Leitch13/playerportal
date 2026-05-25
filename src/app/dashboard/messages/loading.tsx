export default function MessagesLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-36 bg-[#141414] rounded-lg animate-pulse" />
        <div className="h-9 w-36 bg-[#141414] rounded-lg animate-pulse" />
      </div>

      {/* Two-column messaging layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-[500px]">
        {/* Conversation list */}
        <div className="bg-[#141414] border border-[#1e1e1e] rounded-xl p-4 space-y-2 animate-pulse">
          <div className="h-9 w-full bg-white/[0.06] rounded-lg mb-3" />
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-3 rounded-lg"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="h-10 w-10 bg-white/[0.06] rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-28 bg-white/[0.06] rounded" />
                <div className="h-2.5 bg-white/[0.04] rounded" style={{ width: `${70 - i * 5}%` }} />
              </div>
              <div className="h-2.5 w-10 bg-white/[0.04] rounded" />
            </div>
          ))}
        </div>

        {/* Message thread area */}
        <div className="lg:col-span-2 bg-[#141414] border border-[#1e1e1e] rounded-xl p-6 flex flex-col justify-between animate-pulse" style={{ animationDelay: '200ms' }}>
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                <div className="space-y-1" style={{ width: `${50 + (i % 3) * 10}%` }}>
                  <div className={`h-16 bg-white/[0.06] rounded-xl`} />
                  <div className="h-2.5 w-16 bg-white/[0.04] rounded" />
                </div>
              </div>
            ))}
          </div>
          <div className="h-12 w-full bg-white/[0.06] rounded-lg mt-4" />
        </div>
      </div>
    </div>
  )
}
