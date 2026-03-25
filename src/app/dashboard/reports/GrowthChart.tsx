'use client'

interface DataPoint {
  label: string
  value: number
}

export default function GrowthChart({
  data,
  title,
  color = 'accent',
}: {
  data: DataPoint[]
  title: string
  color?: string
}) {
  if (data.length < 2) return null

  const maxVal = Math.max(...data.map((d) => d.value), 1)
  const chartHeight = 120
  const first = data[0].value
  const last = data[data.length - 1].value
  const growth = first > 0 ? Math.round(((last - first) / first) * 100) : 0

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">{title}</h3>
        <span className={`text-xs font-bold ${growth >= 0 ? 'text-accent' : 'text-danger'}`}>
          {growth >= 0 ? '+' : ''}{growth}%
        </span>
      </div>

      <div className="overflow-x-auto">
        <div
          className="flex items-end gap-1"
          style={{ minWidth: Math.max(data.length * 40, 200), height: chartHeight + 30 }}
        >
          {data.map((point, i) => {
            const barHeight = (point.value / maxVal) * chartHeight
            const isLatest = i === data.length - 1

            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                <span className={`text-[10px] font-bold ${isLatest ? `text-${color}` : 'text-text-light'}`}>
                  {point.value}
                </span>
                <div
                  className={`w-full max-w-[30px] rounded-t transition-all ${
                    isLatest ? `bg-${color}` : `bg-${color}/30`
                  }`}
                  style={{
                    height: barHeight,
                    backgroundColor: isLatest ? '#4ecde6' : 'rgba(78,205,230,0.3)',
                  }}
                />
                <span className="text-[9px] text-text-light whitespace-nowrap">{point.label}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
