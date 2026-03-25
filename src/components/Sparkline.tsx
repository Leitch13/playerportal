'use client'

interface SparklineProps {
  data: number[]
  color?: string
  width?: number
  height?: number
}

export default function Sparkline({ data, color = '#6366f1', width = 120, height = 40 }: SparklineProps) {
  if (!data || data.length < 2) return null

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  const padding = 2
  const usableWidth = width - padding * 2
  const usableHeight = height - padding * 2

  const points = data.map((value, i) => {
    const x = padding + (i / (data.length - 1)) * usableWidth
    const y = padding + usableHeight - ((value - min) / range) * usableHeight
    return `${x},${y}`
  })

  const polylinePoints = points.join(' ')

  // Build the fill polygon (area under the line)
  const firstX = padding
  const lastX = padding + usableWidth
  const fillPoints = `${firstX},${height} ${polylinePoints} ${lastX},${height}`

  const gradientId = `sparkline-grad-${Math.random().toString(36).slice(2, 8)}`

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="block"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <polygon
        points={fillPoints}
        fill={`url(#${gradientId})`}
      />
      <polyline
        points={polylinePoints}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
