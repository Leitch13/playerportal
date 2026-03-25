'use client'

interface MonthData {
  label: string
  collected: number
  due: number
}

export default function RevenueChart({ months }: { months: MonthData[] }) {
  if (months.length === 0) return null

  const maxVal = Math.max(...months.map((m) => Math.max(m.collected, m.due)), 1)
  const chartHeight = 180

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-accent" />
          <span>Collected</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-accent/30" />
          <span>Due</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div
          className="flex items-end gap-2 pt-4"
          style={{ minWidth: Math.max(months.length * 70, 300), height: chartHeight + 40 }}
        >
          {months.map((month, i) => {
            const collectedH = (month.collected / maxVal) * chartHeight
            const dueH = (month.due / maxVal) * chartHeight

            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="flex items-end gap-0.5" style={{ height: chartHeight }}>
                  <div
                    className="w-5 rounded-t bg-accent/30 transition-all"
                    style={{ height: dueH }}
                    title={`Due: £${month.due.toFixed(0)}`}
                  />
                  <div
                    className="w-5 rounded-t bg-accent transition-all"
                    style={{ height: collectedH }}
                    title={`Collected: £${month.collected.toFixed(0)}`}
                  />
                </div>
                <span className="text-[10px] text-text-light whitespace-nowrap">{month.label}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
