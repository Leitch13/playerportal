'use client'

interface RadarChartProps {
  scores: { label: string; value: number }[]
}

export default function RadarChart({ scores }: RadarChartProps) {
  const size = 280
  const center = size / 2
  const maxRadius = 110
  const levels = [1, 2, 3, 4, 5]
  const angleStep = (2 * Math.PI) / scores.length
  // Start from top (- PI/2)
  const startAngle = -Math.PI / 2

  function polarToXY(angle: number, radius: number) {
    return {
      x: center + radius * Math.cos(angle),
      y: center + radius * Math.sin(angle),
    }
  }

  function getPolygonPoints(values: number[]) {
    return values
      .map((v, i) => {
        const angle = startAngle + i * angleStep
        const r = (v / 5) * maxRadius
        const { x, y } = polarToXY(angle, r)
        return `${x},${y}`
      })
      .join(' ')
  }

  function getGridPoints(level: number) {
    const r = (level / 5) * maxRadius
    return scores
      .map((_, i) => {
        const angle = startAngle + i * angleStep
        const { x, y } = polarToXY(angle, r)
        return `${x},${y}`
      })
      .join(' ')
  }

  const dataPoints = getPolygonPoints(scores.map((s) => s.value))

  return (
    <div className="flex items-center justify-center">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        className="max-w-full h-auto"
      >
        {/* Grid levels */}
        {levels.map((level) => (
          <polygon
            key={level}
            points={getGridPoints(level)}
            fill="none"
            stroke="currentColor"
            strokeWidth={level === 5 ? 1.5 : 0.5}
            className="text-border"
            opacity={level === 5 ? 0.6 : 0.3}
          />
        ))}

        {/* Axis lines */}
        {scores.map((_, i) => {
          const angle = startAngle + i * angleStep
          const { x, y } = polarToXY(angle, maxRadius)
          return (
            <line
              key={i}
              x1={center}
              y1={center}
              x2={x}
              y2={y}
              stroke="currentColor"
              strokeWidth={0.5}
              className="text-border"
              opacity={0.4}
            />
          )
        })}

        {/* Data polygon fill */}
        <polygon
          points={dataPoints}
          fill="rgba(78, 205, 230, 0.2)"
          stroke="rgba(78, 205, 230, 0.8)"
          strokeWidth={2}
        />

        {/* Data points */}
        {scores.map((s, i) => {
          const angle = startAngle + i * angleStep
          const r = (s.value / 5) * maxRadius
          const { x, y } = polarToXY(angle, r)
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={4}
              fill="rgba(78, 205, 230, 1)"
              stroke="white"
              strokeWidth={1.5}
            />
          )
        })}

        {/* Labels */}
        {scores.map((s, i) => {
          const angle = startAngle + i * angleStep
          const labelR = maxRadius + 22
          const { x, y } = polarToXY(angle, labelR)

          let textAnchor: 'start' | 'middle' | 'end' = 'middle'
          if (Math.cos(angle) > 0.3) textAnchor = 'start'
          else if (Math.cos(angle) < -0.3) textAnchor = 'end'

          return (
            <text
              key={i}
              x={x}
              y={y}
              textAnchor={textAnchor}
              dominantBaseline="central"
              className="fill-text-light text-[10px]"
              style={{ fontSize: '10px' }}
            >
              {s.label}
            </text>
          )
        })}

        {/* Level numbers along first axis */}
        {levels.map((level) => {
          const r = (level / 5) * maxRadius
          return (
            <text
              key={level}
              x={center + 6}
              y={center - r - 2}
              className="fill-text-light"
              style={{ fontSize: '8px' }}
              opacity={0.5}
            >
              {level}
            </text>
          )
        })}
      </svg>
    </div>
  )
}
