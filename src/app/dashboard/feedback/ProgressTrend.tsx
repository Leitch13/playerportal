'use client'

import { SCORE_CATEGORIES } from '@/lib/types'

interface Review {
  review_date: string
  attitude: number
  effort: number
  technical_quality: number
  game_understanding: number
  confidence: number
  physical_movement: number
}

export default function ProgressTrend({ reviews }: { reviews: Review[] }) {
  if (reviews.length < 2) return null

  // Sort oldest to newest for the chart
  const sorted = [...reviews].sort(
    (a, b) =>
      new Date(a.review_date).getTime() - new Date(b.review_date).getTime()
  )

  // Calculate average score per review
  const dataPoints = sorted.map((r) => {
    const avg =
      (r.attitude +
        r.effort +
        r.technical_quality +
        r.game_understanding +
        r.confidence +
        r.physical_movement) /
      6
    return {
      date: new Date(r.review_date).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
      }),
      avg: Math.round(avg * 10) / 10,
      scores: SCORE_CATEGORIES.map((cat) => ({
        label: cat.label,
        value: r[cat.key as keyof Review] as number,
      })),
    }
  })

  const maxScore = 5
  const chartHeight = 160
  const chartWidth = Math.max(dataPoints.length * 80, 300)

  // Calculate trend direction
  const firstAvg = dataPoints[0].avg
  const lastAvg = dataPoints[dataPoints.length - 1].avg
  const trend = lastAvg - firstAvg
  const trendIcon = trend > 0.2 ? '📈' : trend < -0.2 ? '📉' : '➡️'
  const trendLabel =
    trend > 0.2 ? 'Improving' : trend < -0.2 ? 'Needs focus' : 'Steady'
  const trendColor =
    trend > 0.2
      ? 'text-accent'
      : trend < -0.2
      ? 'text-danger'
      : 'text-text-light'

  return (
    <div className="space-y-4">
      {/* Trend summary */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{trendIcon}</span>
          <div>
            <span className={`text-sm font-semibold ${trendColor}`}>
              {trendLabel}
            </span>
            <p className="text-xs text-text-light">
              {firstAvg.toFixed(1)} → {lastAvg.toFixed(1)} avg over{' '}
              {dataPoints.length} reviews
            </p>
          </div>
        </div>

        {/* Category breakdown for latest review */}
        <div className="flex flex-wrap gap-2 ml-auto">
          {dataPoints[dataPoints.length - 1].scores.map((s) => (
            <div
              key={s.label}
              className="flex items-center gap-1 px-2 py-1 rounded-full bg-surface text-xs"
            >
              <span className="font-medium">{s.label}:</span>
              <span
                className={`font-bold ${
                  s.value >= 4
                    ? 'text-accent'
                    : s.value >= 3
                    ? 'text-warning'
                    : 'text-danger'
                }`}
              >
                {s.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Visual bar chart */}
      <div className="overflow-x-auto">
        <div
          className="flex items-end gap-1 pt-4"
          style={{ minWidth: chartWidth, height: chartHeight + 40 }}
        >
          {dataPoints.map((point, i) => {
            const barHeight = (point.avg / maxScore) * chartHeight
            const isLatest = i === dataPoints.length - 1
            return (
              <div
                key={i}
                className="flex-1 flex flex-col items-center gap-1"
              >
                <span
                  className={`text-xs font-bold ${
                    isLatest ? 'text-accent' : 'text-text-light'
                  }`}
                >
                  {point.avg}
                </span>
                <div
                  className={`w-full max-w-[40px] rounded-t-md transition-all ${
                    isLatest
                      ? 'bg-accent'
                      : 'bg-accent/30'
                  }`}
                  style={{ height: barHeight }}
                />
                <span className="text-[10px] text-text-light whitespace-nowrap">
                  {point.date}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
