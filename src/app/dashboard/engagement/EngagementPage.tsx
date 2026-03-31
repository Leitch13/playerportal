'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { calculateEngagementScore } from '@/components/EngagementScore'

interface EngagementPageProps {
  attendanceRate: number
  currentStreak: number
  bestStreak: number
  paymentStatus: 'current' | 'overdue' | 'none'
  referralCount: number
  profileComplete: boolean
  childName: string
  calendarData: { date: string; attended: boolean }[]
  streakHistory: { startDate: string; length: number }[]
  totalParents: number
  orgName: string
  totalSessions: number
}

/* ── Level system ── */
type Level = 'Bronze' | 'Silver' | 'Gold' | 'Platinum'

function getLevel(score: number): { level: Level; color: string; bgColor: string; borderColor: string; glowColor: string; strokeColor: string; emoji: string } {
  if (score >= 81) return { level: 'Platinum', color: 'text-cyan-300', bgColor: 'bg-cyan-500/10', borderColor: 'border-cyan-500/30', glowColor: 'rgba(6,182,212,0.25)', strokeColor: '#06b6d4', emoji: '💎' }
  if (score >= 61) return { level: 'Gold', color: 'text-amber-400', bgColor: 'bg-amber-500/10', borderColor: 'border-amber-500/30', glowColor: 'rgba(245,158,11,0.25)', strokeColor: '#f59e0b', emoji: '🥇' }
  if (score >= 41) return { level: 'Silver', color: 'text-gray-300', bgColor: 'bg-gray-400/10', borderColor: 'border-gray-400/30', glowColor: 'rgba(156,163,175,0.25)', strokeColor: '#9ca3af', emoji: '🥈' }
  return { level: 'Bronze', color: 'text-orange-400', bgColor: 'bg-orange-500/10', borderColor: 'border-orange-500/30', glowColor: 'rgba(249,115,22,0.25)', strokeColor: '#f97316', emoji: '🥉' }
}

/* ── Animated counter ── */
function useAnimatedValue(target: number, duration = 1200) {
  const [value, setValue] = useState(0)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number | null>(null)

  useEffect(() => {
    startRef.current = null
    const animate = (ts: number) => {
      if (!startRef.current) startRef.current = ts
      const elapsed = ts - startRef.current
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(eased * target))
      if (progress < 1) rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [target, duration])

  return value
}

/* ── Progress bar component ── */
function BreakdownBar({ label, value, max, color, suffix = '' }: { label: string; value: number; max: number; color: string; suffix?: string }) {
  const pct = Math.min((value / max) * 100, 100)
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm text-white/60">{label}</span>
        <span className="text-sm font-bold text-white">{value}{suffix}</span>
      </div>
      <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

/* ── Achievements ── */
function getAchievements(props: EngagementPageProps) {
  const achievements: { title: string; emoji: string; unlocked: boolean; description: string }[] = [
    { title: '5 Session Streak', emoji: '🔥', unlocked: props.currentStreak >= 5, description: 'Attend 5 sessions in a row' },
    { title: '10 Session Streak', emoji: '🔥', unlocked: props.currentStreak >= 10, description: 'Attend 10 sessions in a row' },
    { title: '100% Attendance', emoji: '🏆', unlocked: props.attendanceRate === 100, description: 'Perfect attendance record' },
    { title: 'Attendance Pro', emoji: '⭐', unlocked: props.attendanceRate >= 80, description: 'Maintain 80%+ attendance' },
    { title: 'First Referral', emoji: '🎁', unlocked: props.referralCount >= 1, description: 'Refer your first friend' },
    { title: 'Referral Champion', emoji: '🎁', unlocked: props.referralCount >= 3, description: 'Refer 3 or more friends' },
    { title: 'Profile Complete', emoji: '✅', unlocked: props.profileComplete, description: 'Fill in all profile details' },
    { title: 'Payments Up to Date', emoji: '💳', unlocked: props.paymentStatus === 'current', description: 'Keep payments current' },
    { title: 'Platinum Parent', emoji: '💎', unlocked: calculateEngagementScore(props) >= 81, description: 'Reach Platinum level' },
    { title: 'Gold Parent', emoji: '🥇', unlocked: calculateEngagementScore(props) >= 61, description: 'Reach Gold level' },
  ]
  return achievements
}

/* ── Calendar heatmap ── */
function CalendarHeatmap({ data }: { data: { date: string; attended: boolean }[] }) {
  // Build a map of date -> attended
  const dateMap = new Map<string, boolean>()
  for (const d of data) {
    dateMap.set(d.date, d.attended)
  }

  // Generate last 12 weeks (84 days)
  const weeks: { date: Date; dateStr: string; status: 'attended' | 'missed' | 'none' }[][] = []
  const today = new Date()
  const start = new Date(today)
  start.setDate(start.getDate() - 83)
  // Align to Monday
  while (start.getDay() !== 1) start.setDate(start.getDate() - 1)

  let currentWeek: typeof weeks[0] = []
  const d = new Date(start)
  while (d <= today) {
    const dateStr = d.toISOString().split('T')[0]
    const hasData = dateMap.has(dateStr)
    currentWeek.push({
      date: new Date(d),
      dateStr,
      status: hasData ? (dateMap.get(dateStr) ? 'attended' : 'missed') : 'none',
    })
    if (currentWeek.length === 7) {
      weeks.push(currentWeek)
      currentWeek = []
    }
    d.setDate(d.getDate() + 1)
  }
  if (currentWeek.length > 0) weeks.push(currentWeek)

  return (
    <div>
      <div className="flex gap-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((day) => (
              <div
                key={day.dateStr}
                className="w-3 h-3 rounded-sm"
                title={`${day.dateStr}: ${day.status === 'attended' ? 'Attended' : day.status === 'missed' ? 'Missed' : 'No session'}`}
                style={{
                  backgroundColor:
                    day.status === 'attended' ? '#10b981' :
                    day.status === 'missed' ? '#ef4444' :
                    'rgba(255,255,255,0.04)',
                }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 mt-3">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-emerald-500" />
          <span className="text-[10px] text-white/40">Attended</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-red-500" />
          <span className="text-[10px] text-white/40">Missed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-white/[0.04]" />
          <span className="text-[10px] text-white/40">No session</span>
        </div>
      </div>
    </div>
  )
}

export default function EngagementPage(props: EngagementPageProps) {
  const score = calculateEngagementScore(props)
  const animatedScore = useAnimatedValue(score)
  const levelInfo = getLevel(score)
  const achievements = getAchievements(props)
  const unlockedCount = achievements.filter(a => a.unlocked).length

  // Score breakdown
  const attendancePoints = Math.round((props.attendanceRate / 100) * 40)
  const streakPoints = Math.round(Math.min(props.currentStreak / 10, 1) * 20)
  const paymentPoints = props.paymentStatus === 'current' ? 20 : props.paymentStatus === 'none' ? 10 : 0
  const referralPoints = Math.round(Math.min(props.referralCount / 3, 1) * 10)
  const profilePoints = props.profileComplete ? 10 : 0

  // Leaderboard position estimate (rough)
  const percentile = props.totalParents > 0 ? Math.max(5, Math.min(95, Math.round((score / 100) * 85 + 10))) : 50

  // Ring
  const ringSize = 160
  const strokeWidth = 10
  const radius = (ringSize - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (animatedScore / 100) * circumference

  return (
    <div className="bg-[#0a0a0a] -m-6 lg:-m-8 p-6 lg:p-8 min-h-screen text-white">
      <div className="max-w-lg mx-auto space-y-6">
        {/* Header */}
        <div>
          <Link href="/dashboard" className="text-xs text-white/40 hover:text-white/60 transition-colors">&larr; Dashboard</Link>
          <h1 className="text-2xl font-bold text-white mt-2">My Engagement Score</h1>
          <p className="text-sm text-white/40 mt-1">Track your involvement at {props.orgName}</p>
        </div>

        {/* Score hero */}
        <div className={`${levelInfo.bgColor} backdrop-blur-xl border ${levelInfo.borderColor} rounded-2xl p-8 text-center`} style={{ boxShadow: `0 0 40px ${levelInfo.glowColor}` }}>
          <div className="relative inline-block">
            <svg width={ringSize} height={ringSize} className="transform -rotate-90">
              <circle cx={ringSize / 2} cy={ringSize / 2} r={radius} stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} fill="none" />
              <defs>
                <filter id="page-ring-glow">
                  <feGaussianBlur stdDeviation="6" result="coloredBlur" />
                  <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>
              <circle cx={ringSize / 2} cy={ringSize / 2} r={radius} stroke={levelInfo.strokeColor} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} filter="url(#page-ring-glow)" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-5xl font-bold text-white">{animatedScore}</span>
              <span className="text-xs text-white/40 mt-1">out of 100</span>
            </div>
          </div>

          <div className={`mt-5 inline-flex items-center gap-2 px-5 py-2 rounded-full ${levelInfo.bgColor} border ${levelInfo.borderColor}`}>
            <span className="text-lg">{levelInfo.emoji}</span>
            <span className={`text-base font-bold ${levelInfo.color}`}>{levelInfo.level} Parent</span>
          </div>

          {props.currentStreak > 0 && (
            <p className="mt-3 text-base text-white/60">
              <span className="text-amber-400 font-bold">{props.currentStreak}</span> sessions in a row!
            </p>
          )}
        </div>

        {/* Score breakdown */}
        <div className="bg-[#141414] border border-[#1e1e1e] rounded-2xl p-6">
          <h2 className="text-base font-bold text-white mb-5">Score Breakdown</h2>
          <div className="space-y-5">
            <BreakdownBar label="Attendance Rate" value={attendancePoints} max={40} color="#10b981" suffix={`/40`} />
            <BreakdownBar label="Session Streak" value={streakPoints} max={20} color="#f59e0b" suffix={`/20`} />
            <BreakdownBar label="Payment Status" value={paymentPoints} max={20} color={paymentPoints === 20 ? '#10b981' : '#ef4444'} suffix={`/20`} />
            <BreakdownBar label="Referrals Made" value={referralPoints} max={10} color="#8b5cf6" suffix={`/10`} />
            <BreakdownBar label="Profile Complete" value={profilePoints} max={10} color="#06b6d4" suffix={`/10`} />
          </div>

          {/* How to improve */}
          <div className="mt-6 pt-5 border-t border-white/[0.06]">
            <h3 className="text-sm font-bold text-white mb-3">How to Improve</h3>
            <div className="space-y-2">
              {attendancePoints < 40 && (
                <div className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-0.5">+</span>
                  <p className="text-sm text-white/50">Attend more sessions to boost your attendance score ({40 - attendancePoints} points available)</p>
                </div>
              )}
              {streakPoints < 20 && (
                <div className="flex items-start gap-2">
                  <span className="text-amber-400 mt-0.5">+</span>
                  <p className="text-sm text-white/50">Build your streak by attending consistently ({20 - streakPoints} points available)</p>
                </div>
              )}
              {paymentPoints < 20 && (
                <div className="flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">+</span>
                  <p className="text-sm text-white/50">{props.paymentStatus === 'overdue' ? 'Clear overdue payments' : 'Make a payment'} ({20 - paymentPoints} points available)</p>
                </div>
              )}
              {referralPoints < 10 && (
                <div className="flex items-start gap-2">
                  <span className="text-purple-400 mt-0.5">+</span>
                  <p className="text-sm text-white/50">
                    <Link href="/dashboard/referrals" className="underline hover:text-white/70">Refer a friend</Link> ({10 - referralPoints} points available)
                  </p>
                </div>
              )}
              {profilePoints < 10 && (
                <div className="flex items-start gap-2">
                  <span className="text-cyan-400 mt-0.5">+</span>
                  <p className="text-sm text-white/50">
                    <Link href="/dashboard/account" className="underline hover:text-white/70">Complete your profile</Link> (10 points available)
                  </p>
                </div>
              )}
              {score === 100 && (
                <p className="text-sm text-emerald-400 font-medium">You have a perfect score! Keep it up!</p>
              )}
            </div>
          </div>
        </div>

        {/* Attendance calendar */}
        <div className="bg-[#141414] border border-[#1e1e1e] rounded-2xl p-6">
          <h2 className="text-base font-bold text-white mb-4">Attendance Calendar</h2>
          <CalendarHeatmap data={props.calendarData} />
          <div className="mt-4 grid grid-cols-3 gap-3 pt-4 border-t border-white/[0.06]">
            <div className="text-center">
              <p className="text-lg font-bold text-emerald-400">{props.calendarData.filter(d => d.attended).length}</p>
              <p className="text-[10px] text-white/40">Attended</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-red-400">{props.calendarData.filter(d => !d.attended).length}</p>
              <p className="text-[10px] text-white/40">Missed</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-white">{props.totalSessions}</p>
              <p className="text-[10px] text-white/40">Total</p>
            </div>
          </div>
        </div>

        {/* Streak history */}
        <div className="bg-[#141414] border border-[#1e1e1e] rounded-2xl p-6">
          <h2 className="text-base font-bold text-white mb-4">Streak History</h2>
          <div className="flex items-center gap-6 mb-5">
            <div>
              <p className="text-3xl font-bold text-amber-400">{props.currentStreak}</p>
              <p className="text-xs text-white/40">Current</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-white">{props.bestStreak}</p>
              <p className="text-xs text-white/40">Best</p>
            </div>
          </div>
          {props.streakHistory.length > 0 ? (
            <div className="space-y-2">
              {props.streakHistory.slice(0, 8).map((s, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-amber-400/80"
                        style={{ width: `${Math.min((s.length / Math.max(props.bestStreak, 1)) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-white/40 w-20 text-right">{s.length} sessions</span>
                  <span className="text-[10px] text-white/30 w-20 text-right">{new Date(s.startDate).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-white/30">No streak history yet. Start attending sessions!</p>
          )}
        </div>

        {/* Achievements */}
        <div className="bg-[#141414] border border-[#1e1e1e] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-white">Achievements</h2>
            <span className="text-xs text-white/40">{unlockedCount}/{achievements.length} unlocked</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {achievements.map((a, i) => (
              <div
                key={i}
                className={`rounded-xl p-3 border transition-all ${
                  a.unlocked
                    ? 'bg-white/[0.04] border-white/[0.1]'
                    : 'bg-white/[0.01] border-white/[0.04] opacity-40'
                }`}
              >
                <span className="text-2xl">{a.emoji}</span>
                <p className={`text-xs font-bold mt-1 ${a.unlocked ? 'text-white' : 'text-white/40'}`}>{a.title}</p>
                <p className="text-[10px] text-white/30 mt-0.5">{a.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Leaderboard */}
        <div className="bg-[#141414] border border-[#1e1e1e] rounded-2xl p-6">
          <h2 className="text-base font-bold text-white mb-3">Leaderboard</h2>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#4ecde6]/20 to-purple-500/20 border border-[#4ecde6]/20 flex items-center justify-center">
              <span className="text-2xl font-bold text-[#4ecde6]">{percentile}%</span>
            </div>
            <div>
              <p className="text-sm text-white/60">
                You&apos;re in the <span className="text-white font-bold">top {100 - percentile}%</span> of parents
              </p>
              <p className="text-xs text-white/30 mt-1">at {props.orgName}</p>
            </div>
          </div>
          <p className="text-[10px] text-white/20 mt-3">Rankings are anonymised. Keep improving your score to climb higher!</p>
        </div>
      </div>
    </div>
  )
}
