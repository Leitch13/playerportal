'use client'

import { useState } from 'react'

interface LineChartProps {
  data: { label: string; value: number }[]
  height?: number
  lineColor?: string
  prefix?: string
  suffix?: string
}

export default function LineChart({
  data,
  height = 220,
  lineColor = '#4ecde6',
  prefix = '',
  suffix = '',
}: LineChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  if (data.length < 2) {
    return <p className="text-sm text-text-light">Not enough data yet.</p>
  }

  const maxValue = Math.max(...data.map((d) => d.value), 1)
  const minValue = Math.min(...data.map((d) => d.value), 0)
  const range = maxValue - minValue || 1
  const padding = { top: 20, right: 20, bottom: 32, left: 20 }
  const chartWidth = 500
  const chartHeight = height
  const plotHeight = chartHeight - padding.top - padding.bottom
  const plotWidth = chartWidth - padding.left - padding.right

  const points = data.map((d, i) => {
    const x = padding.left + (i / (data.length - 1)) * plotWidth
    const y = padding.top + plotHeight - ((d.value - minValue) / range) * plotHeight
    return { x, y, ...d }
  })

  const polyline = points.map((p) => `${p.x},${p.y}`).join(' ')
  const fillPath = `${points[0].x},${padding.top + plotHeight} ${polyline} ${points[points.length - 1].x},${padding.top + plotHeight}`
  const gradientId = `line-grad-${Math.random().toString(36).slice(2, 8)}`

  return (
    <div className="w-full overflow-hidden">
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity={0.25} />
            <stop offset="100%" stopColor={lineColor} stopOpacity={0.02} />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = padding.top + plotHeight * (1 - ratio)
          return (
            <line
              key={ratio}
              x1={padding.left}
              y1={y}
              x2={chartWidth - padding.right}
              y2={y}
              stroke="currentColor"
              className="text-border"
              strokeWidth={0.5}
              strokeDasharray="4 3"
            />
          )
        })}

        {/* Fill area */}
        <polygon points={fillPath} fill={`url(#${gradientId})`} />

        {/* Line */}
        <polyline
          points={polyline}
          fill="none"
          stroke={lineColor}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Dots and labels */}
        {points.map((p, i) => (
          <g
            key={i}
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
            style={{ cursor: 'pointer' }}
          >
            {/* Invisible hit area */}
            <circle cx={p.x} cy={p.y} r={12} fill="transparent" />

            {/* Visible dot */}
            <circle
              cx={p.x}
              cy={p.y}
              r={hoveredIndex === i ? 5 : 3.5}
              fill={lineColor}
              stroke="white"
              strokeWidth={2}
            />

            {/* Tooltip */}
            {hoveredIndex === i && (
              <g>
                <rect
                  x={p.x - 32}
                  y={p.y - 30}
                  width={64}
                  height={22}
                  fill="currentColor"
                  className="text-primary"
                  rx={6}
                />
                <text
                  x={p.x}
                  y={p.y - 15}
                  textAnchor="middle"
                  fill="currentColor"
                  className="text-surface"
                  fontSize={11}
                  fontWeight={600}
                >
                  {prefix}{p.value.toLocaleString()}{suffix}
                </text>
              </g>
            )}

            {/* X label */}
            <text
              x={p.x}
              y={chartHeight - 8}
              textAnchor="middle"
              fill="currentColor"
              className="text-text-light"
              fontSize={11}
            >
              {p.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}
