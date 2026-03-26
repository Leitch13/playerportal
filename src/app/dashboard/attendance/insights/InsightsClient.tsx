'use client'

import { useState } from 'react'
import Link from 'next/link'

// ─── Types ───

interface GroupRate {
  groupId: string
  name: string
  rate: number
  present: number
  total: number
}

interface AtRiskPlayer {
  playerId: string
  name: string
  parentId: string
  rate: number
  lastDate: string | null
  daysSinceLast: number
}

interface WeeklyPoint {
  week: string
  rate: number
  present: number
  total: number
}

interface DayData {
  day: string
  rate: number
  present: number
  total: number
}

interface ClassData extends GroupRate {
  enrolledCount: number
}

interface NoShow {
  id: string
  playerName: string
  parentId: string | null
  className: string
  date: string
}

interface InsightsClientProps {
  avgRate: number
  rateTrend: number
  thisMonthSessions: number
  mostAttended: GroupRate | null
  leastAttended: GroupRate | null
  atRiskPlayers: AtRiskPlayer[]
  weeklyTrend: WeeklyPoint[]
  dayOfWeekData: DayData[]
  classComparison: ClassData[]
  recentNoShows: NoShow[]
}

// ─── Glass Card wrapper ───

function GlassCard({
  title,
  children,
  className = '',
}: {
  title?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={`rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-6 ${className}`}
    >
      {title && (
        <h2 className="text-base font-semibold text-white/90 mb-4">{title}</h2>
      )}
      {children}
    </div>
  )
}

// ─── Stat Card ───

function StatCard({
  label,
  value,
  sub,
  trend,
}: {
  label: string
  value: string | number
  sub?: string
  trend?: number
}) {
  return (
    <GlassCard>
      <div className="text-center space-y-1">
        <div className="text-xs uppercase tracking-wider text-white/50">
          {label}
        </div>
        <div className="text-3xl font-bold text-white">{value}</div>
        {sub && <div className="text-xs text-white/40">{sub}</div>}
        {trend !== undefined && (
          <div
            className={`text-sm font-medium ${
              trend > 0
                ? 'text-emerald-400'
                : trend < 0
                ? 'text-red-400'
                : 'text-white/40'
            }`}
          >
            {trend > 0 ? '\u25B2' : trend < 0 ? '\u25BC' : '\u2014'}{' '}
            {Math.abs(trend)}% vs prev period
          </div>
        )}
      </div>
    </GlassCard>
  )
}

// ─── SVG Line Chart ───

function WeeklyLineChart({ data }: { data: WeeklyPoint[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  if (data.length === 0) return <p className="text-sm text-white/40">No data</p>

  const width = 600
  const height = 250
  const padLeft = 45
  const padRight = 20
  const padTop = 20
  const padBottom = 40

  const chartW = width - padLeft - padRight
  const chartH = height - padTop - padBottom

  const maxRate = Math.max(...data.map((d) => d.rate), 100)
  const minRate = 0

  const points = data.map((d, i) => ({
    x: padLeft + (i / (data.length - 1)) * chartW,
    y: padTop + chartH - ((d.rate - minRate) / (maxRate - minRate)) * chartH,
    ...d,
  }))

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`)
    .join(' ')

  const areaPath = `${linePath} L${points[points.length - 1].x},${
    padTop + chartH
  } L${points[0].x},${padTop + chartH} Z`

  // Y-axis ticks
  const yTicks = [0, 25, 50, 75, 100]

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full min-w-[400px]"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Grid lines */}
        {yTicks.map((tick) => {
          const y = padTop + chartH - (tick / maxRate) * chartH
          return (
            <g key={tick}>
              <line
                x1={padLeft}
                y1={y}
                x2={width - padRight}
                y2={y}
                stroke="rgba(255,255,255,0.08)"
                strokeDasharray="4,4"
              />
              <text
                x={padLeft - 8}
                y={y + 4}
                textAnchor="end"
                fill="rgba(255,255,255,0.4)"
                fontSize="10"
              >
                {tick}%
              </text>
            </g>
          )
        })}

        {/* Area fill */}
        <path d={areaPath} fill="url(#lineGrad)" opacity="0.3" />

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke="#22d3ee"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Gradient definition */}
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Data points and interaction areas */}
        {points.map((p, i) => (
          <g key={i}>
            {/* Larger invisible hit area */}
            <rect
              x={p.x - 20}
              y={padTop}
              width={40}
              height={chartH}
              fill="transparent"
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            />
            {/* Dot */}
            <circle
              cx={p.x}
              cy={p.y}
              r={hoveredIdx === i ? 5 : 3}
              fill="#22d3ee"
              stroke="rgba(0,0,0,0.3)"
              strokeWidth="1"
            />
            {/* X label */}
            <text
              x={p.x}
              y={height - 10}
              textAnchor="middle"
              fill="rgba(255,255,255,0.5)"
              fontSize="10"
            >
              {p.week}
            </text>
            {/* Tooltip */}
            {hoveredIdx === i && (
              <g>
                <rect
                  x={p.x - 40}
                  y={p.y - 38}
                  width={80}
                  height={28}
                  rx={6}
                  fill="rgba(0,0,0,0.85)"
                  stroke="rgba(255,255,255,0.15)"
                  strokeWidth="1"
                />
                <text
                  x={p.x}
                  y={p.y - 20}
                  textAnchor="middle"
                  fill="white"
                  fontSize="11"
                  fontWeight="600"
                >
                  {p.rate}% ({p.present}/{p.total})
                </text>
              </g>
            )}
          </g>
        ))}
      </svg>
    </div>
  )
}

// ─── Day-of-Week Heatmap ───

function DayHeatmap({ data }: { data: DayData[] }) {
  const maxRate = Math.max(...data.map((d) => d.rate), 1)

  function getColor(rate: number): string {
    if (rate === 0) return 'rgba(255,255,255,0.05)'
    const intensity = rate / maxRate
    if (intensity > 0.8) return 'rgba(34,211,238,0.8)'
    if (intensity > 0.6) return 'rgba(34,211,238,0.6)'
    if (intensity > 0.4) return 'rgba(34,211,238,0.4)'
    if (intensity > 0.2) return 'rgba(34,211,238,0.25)'
    return 'rgba(34,211,238,0.12)'
  }

  return (
    <div className="grid grid-cols-7 gap-2">
      {data.map((d) => (
        <div
          key={d.day}
          className="rounded-xl p-3 text-center transition-all hover:scale-105"
          style={{ backgroundColor: getColor(d.rate) }}
        >
          <div className="text-xs font-semibold text-white/70 mb-1">{d.day}</div>
          <div className="text-lg font-bold text-white">{d.rate}%</div>
          <div className="text-[10px] text-white/40">
            {d.present}/{d.total}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Class Comparison Bar Chart ───

function ClassBarChart({ data }: { data: ClassData[] }) {
  if (data.length === 0) return <p className="text-sm text-white/40">No class data</p>

  const maxRate = 100

  return (
    <div className="space-y-3">
      {data.map((c) => (
        <div key={c.groupId} className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/80 font-medium truncate mr-4">
              {c.name}
            </span>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-[11px] text-white/40">
                {c.enrolledCount} enrolled
              </span>
              <span
                className={`font-bold ${
                  c.rate >= 80
                    ? 'text-emerald-400'
                    : c.rate >= 60
                    ? 'text-amber-400'
                    : 'text-red-400'
                }`}
              >
                {c.rate}%
              </span>
            </div>
          </div>
          <div className="w-full h-2.5 rounded-full bg-white/5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                c.rate >= 80
                  ? 'bg-emerald-400'
                  : c.rate >= 60
                  ? 'bg-amber-400'
                  : 'bg-red-400'
              }`}
              style={{ width: `${(c.rate / maxRate) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main Component ───

export default function InsightsClient({
  avgRate,
  rateTrend,
  thisMonthSessions,
  mostAttended,
  leastAttended,
  atRiskPlayers,
  weeklyTrend,
  dayOfWeekData,
  classComparison,
  recentNoShows,
}: InsightsClientProps) {
  return (
    <div className="space-y-6">
      {/* ─── Overview Stats Row ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Avg Attendance Rate"
          value={`${avgRate}%`}
          trend={rateTrend}
        />
        <StatCard
          label="Sessions This Month"
          value={thisMonthSessions}
        />
        <StatCard
          label="Most Attended"
          value={mostAttended?.name || 'N/A'}
          sub={mostAttended ? `${mostAttended.rate}%` : undefined}
        />
        <StatCard
          label="Least Attended"
          value={leastAttended?.name || 'N/A'}
          sub={leastAttended ? `${leastAttended.rate}%` : undefined}
        />
      </div>

      {/* ─── At-Risk Players ─── */}
      <GlassCard title="At-Risk Players">
        {atRiskPlayers.length === 0 ? (
          <p className="text-sm text-white/40">
            No at-risk players. All players are above 60% attendance.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 text-white/50 font-medium">
                    Player
                  </th>
                  <th className="text-center py-2 text-white/50 font-medium">
                    Attendance
                  </th>
                  <th className="text-center py-2 text-white/50 font-medium">
                    Last Session
                  </th>
                  <th className="text-center py-2 text-white/50 font-medium">
                    Days Absent
                  </th>
                  <th className="text-right py-2 text-white/50 font-medium">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {atRiskPlayers.map((p) => {
                  const severity =
                    p.rate <= 25 || p.daysSinceLast >= 21
                      ? 'critical'
                      : 'warning'
                  return (
                    <tr
                      key={p.playerId}
                      className={`border-b border-white/5 ${
                        severity === 'critical'
                          ? 'bg-red-500/10'
                          : 'bg-amber-500/5'
                      }`}
                    >
                      <td className="py-3 text-white/90 font-medium">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              severity === 'critical'
                                ? 'bg-red-400'
                                : 'bg-amber-400'
                            }`}
                          />
                          {p.name}
                        </div>
                      </td>
                      <td className="py-3 text-center">
                        <span
                          className={`font-bold ${
                            severity === 'critical'
                              ? 'text-red-400'
                              : 'text-amber-400'
                          }`}
                        >
                          {p.rate}%
                        </span>
                      </td>
                      <td className="py-3 text-center text-white/60">
                        {p.lastDate
                          ? new Date(p.lastDate + 'T12:00:00').toLocaleDateString()
                          : 'Never'}
                      </td>
                      <td className="py-3 text-center">
                        <span
                          className={`font-medium ${
                            p.daysSinceLast >= 21
                              ? 'text-red-400'
                              : p.daysSinceLast >= 14
                              ? 'text-amber-400'
                              : 'text-white/60'
                          }`}
                        >
                          {p.daysSinceLast >= 999 ? 'N/A' : `${p.daysSinceLast}d`}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <Link
                          href={`/dashboard/messages?to=${p.parentId}`}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 transition-colors"
                        >
                          Contact Parent
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {/* ─── Trends + Heatmap Row ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Attendance Trend */}
        <GlassCard title="Weekly Attendance Trend (12 Weeks)">
          <WeeklyLineChart data={weeklyTrend} />
        </GlassCard>

        {/* Day-of-Week Heatmap */}
        <GlassCard title="Day-of-Week Heatmap">
          <DayHeatmap data={dayOfWeekData} />
        </GlassCard>
      </div>

      {/* ─── Class Comparison ─── */}
      <GlassCard title="Class Comparison">
        <ClassBarChart data={classComparison} />
      </GlassCard>

      {/* ─── Recent No-Shows ─── */}
      <GlassCard title="Recent No-Shows (Last 14 Days)">
        {recentNoShows.length === 0 ? (
          <p className="text-sm text-white/40">No absences in the last 14 days.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 text-white/50 font-medium">
                    Player
                  </th>
                  <th className="text-left py-2 text-white/50 font-medium">
                    Class
                  </th>
                  <th className="text-left py-2 text-white/50 font-medium">
                    Date
                  </th>
                  <th className="text-right py-2 text-white/50 font-medium">
                    Notify
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentNoShows.map((ns) => (
                  <tr
                    key={ns.id}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <td className="py-2.5 text-white/80">{ns.playerName}</td>
                    <td className="py-2.5 text-white/60">{ns.className}</td>
                    <td className="py-2.5 text-white/60">
                      {new Date(ns.date + 'T12:00:00').toLocaleDateString()}
                    </td>
                    <td className="py-2.5 text-right">
                      {ns.parentId ? (
                        <Link
                          href={`/dashboard/messages?to=${ns.parentId}`}
                          className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                        >
                          Message Parent
                        </Link>
                      ) : (
                        <span className="text-xs text-white/30">N/A</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  )
}
