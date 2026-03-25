'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Sparkline from './Sparkline'

interface StatCardProps {
  label: string
  value: string | number
  trend?: number
  sparklineData?: number[]
  icon?: string
  href?: string
  color?: string // 'primary' | 'accent' | 'success' | 'warning' | 'danger'
}

const COLOR_MAP: Record<string, { text: string; sparkline: string }> = {
  primary: { text: 'text-primary', sparkline: '#6366f1' },
  accent: { text: 'text-accent', sparkline: '#f59e0b' },
  success: { text: 'text-emerald-600', sparkline: '#10b981' },
  warning: { text: 'text-amber-600', sparkline: '#f59e0b' },
  danger: { text: 'text-red-600', sparkline: '#ef4444' },
}

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0)
  const rafRef = useRef<number | null>(null)
  const startTimeRef = useRef<number | null>(null)

  useEffect(() => {
    const duration = 600
    startTimeRef.current = null

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp
      const elapsed = timestamp - startTimeRef.current
      const progress = Math.min(elapsed / duration, 1)
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(eased * value))

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate)
      }
    }

    rafRef.current = requestAnimationFrame(animate)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [value])

  return <>{display}</>
}

export default function StatCard({
  label,
  value,
  trend,
  sparklineData,
  icon,
  href,
  color = 'primary',
}: StatCardProps) {
  const colors = COLOR_MAP[color] || COLOR_MAP.primary
  const isNumeric = typeof value === 'number'

  const trendBadge =
    trend && trend !== 0 ? (
      <span
        className={`inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full ${
          trend > 0
            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
            : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400'
        }`}
      >
        {trend > 0 ? '↑' : '↓'}
        {trend > 0 ? '+' : ''}
        {trend}%
      </span>
    ) : null

  const content = (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-700 transition-all duration-200 relative overflow-hidden group">
      <div className="flex items-start justify-between mb-1">
        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{label}</span>
        {icon && <span className="text-lg leading-none">{icon}</span>}
      </div>

      <div className="flex items-end gap-2">
        <span className={`text-2xl font-bold ${colors.text}`}>
          {isNumeric ? <AnimatedNumber value={value as number} /> : value}
        </span>
        {trendBadge}
      </div>

      {sparklineData && sparklineData.length >= 2 && (
        <div className="mt-2 -mx-1 -mb-1 opacity-70 group-hover:opacity-100 transition-opacity">
          <Sparkline data={sparklineData} color={colors.sparkline} width={120} height={40} />
        </div>
      )}
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    )
  }

  return content
}
