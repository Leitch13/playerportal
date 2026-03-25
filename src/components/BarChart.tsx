'use client'

import { useState } from 'react'

interface BarChartProps {
  data: { label: string; value: number }[]
  height?: number
  barColor?: string
  prefix?: string
  suffix?: string
}

export default function BarChart({
  data,
  height = 220,
  barColor = '#4ecde6',
  prefix = '',
  suffix = '',
}: BarChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  if (data.length === 0) {
    return <p className="text-sm text-text-light">No data available.</p>
  }

  const maxValue = Math.max(...data.map((d) => d.value), 1)
  const padding = { top: 20, right: 12, bottom: 32, left: 12 }
  const chartWidth = 500
  const chartHeight = height
  const plotHeight = chartHeight - padding.top - padding.bottom
  const plotWidth = chartWidth - padding.left - padding.right
  const barGap = 8
  const barWidth = Math.max(12, (plotWidth - barGap * (data.length + 1)) / data.length)

  return (
    <div className="w-full overflow-hidden">
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="w-full"
        preserveAspectRatio="xMidYMid meet"
      >
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
              strokeDasharray={ratio === 0 ? 'none' : '4 3'}
            />
          )
        })}

        {/* Bars */}
        {data.map((d, i) => {
          const barHeight = (d.value / maxValue) * plotHeight
          const x = padding.left + barGap + i * (barWidth + barGap)
          const y = padding.top + plotHeight - barHeight
          const isHovered = hoveredIndex === i

          return (
            <g
              key={i}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
              style={{ cursor: 'pointer' }}
            >
              {/* Hover background */}
              {isHovered && (
                <rect
                  x={x - 4}
                  y={padding.top}
                  width={barWidth + 8}
                  height={plotHeight}
                  fill="currentColor"
                  className="text-surface-dark"
                  opacity={0.5}
                  rx={4}
                />
              )}

              {/* Bar */}
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                fill={barColor}
                rx={4}
                opacity={isHovered ? 1 : 0.85}
              >
                <animate
                  attributeName="height"
                  from="0"
                  to={barHeight}
                  dur="0.5s"
                  begin="0s"
                  fill="freeze"
                />
                <animate
                  attributeName="y"
                  from={padding.top + plotHeight}
                  to={y}
                  dur="0.5s"
                  begin="0s"
                  fill="freeze"
                />
              </rect>

              {/* Tooltip */}
              {isHovered && (
                <g>
                  <rect
                    x={x + barWidth / 2 - 32}
                    y={y - 28}
                    width={64}
                    height={22}
                    fill="currentColor"
                    className="text-primary"
                    rx={6}
                  />
                  <text
                    x={x + barWidth / 2}
                    y={y - 13}
                    textAnchor="middle"
                    fill="currentColor"
                    className="text-surface"
                    fontSize={11}
                    fontWeight={600}
                  >
                    {prefix}{d.value.toLocaleString()}{suffix}
                  </text>
                </g>
              )}

              {/* Label */}
              <text
                x={x + barWidth / 2}
                y={chartHeight - 8}
                textAnchor="middle"
                fill="currentColor"
                className="text-text-light"
                fontSize={11}
              >
                {d.label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
