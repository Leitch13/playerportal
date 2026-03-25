'use client'

import { useState } from 'react'

interface HeatmapProps {
  data: { day: number; hour: number; count: number }[]
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function AttendanceHeatmap({ data }: HeatmapProps) {
  const [hovered, setHovered] = useState<{ day: number; count: number } | null>(null)

  // Group by day of week (0=Mon .. 6=Sun)
  const dayTotals = new Map<number, number>()
  for (const d of data) {
    dayTotals.set(d.day, (dayTotals.get(d.day) || 0) + d.count)
  }

  const maxCount = Math.max(...Array.from(dayTotals.values()), 1)

  function getColor(count: number): string {
    if (count === 0) return '#f3f4f6'
    const intensity = Math.min(count / maxCount, 1)
    if (intensity < 0.25) return '#d1fae5'
    if (intensity < 0.5) return '#6ee7b7'
    if (intensity < 0.75) return '#34d399'
    return '#059669'
  }

  return (
    <div>
      <div className="grid grid-cols-7 gap-2">
        {DAYS.map((day, i) => {
          const count = dayTotals.get(i) || 0
          return (
            <div key={day} className="text-center">
              <span className="text-[10px] text-text-light font-medium block mb-1.5">{day}</span>
              <div
                className="aspect-square rounded-lg flex items-center justify-center cursor-pointer transition-transform hover:scale-110"
                style={{ backgroundColor: getColor(count) }}
                onMouseEnter={() => setHovered({ day: i, count })}
                onMouseLeave={() => setHovered(null)}
              >
                <span className="text-xs font-bold" style={{ color: count > 0 ? '#064e3b' : '#9ca3af' }}>
                  {count}
                </span>
              </div>
            </div>
          )
        })}
      </div>
      {hovered && (
        <p className="text-xs text-text-light text-center mt-2">
          {DAYS[hovered.day]}: {hovered.count} session{hovered.count !== 1 ? 's' : ''}
        </p>
      )}
      <div className="flex items-center justify-center gap-1 mt-3">
        <span className="text-[10px] text-text-light">Less</span>
        {['#f3f4f6', '#d1fae5', '#6ee7b7', '#34d399', '#059669'].map((color) => (
          <div key={color} className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
        ))}
        <span className="text-[10px] text-text-light">More</span>
      </div>
    </div>
  )
}
