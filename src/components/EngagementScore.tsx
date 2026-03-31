'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

/* ── Types ── */
export interface EngagementScoreProps {
  attendanceRate: number // 0-100
  currentStreak: number
  paymentStatus: 'current' | 'overdue' | 'none'
  referralCount: number
  profileComplete: boolean
  childName: string
  compact?: boolean // compact card mode for dashboard
}

/* ── Level system ── */
type Level = 'Bronze' | 'Silver' | 'Gold' | 'Platinum'

function getLevel(score: number): { level: Level; color: string; bgColor: string; borderColor: string; glowColor: string; emoji: string } {
  if (score >= 81) return { level: 'Platinum', color: 'text-cyan-300', bgColor: 'bg-cyan-500/10', borderColor: 'border-cyan-500/30', glowColor: 'rgba(6,182,212,0.25)', emoji: '💎' }
  if (score >= 61) return { level: 'Gold', color: 'text-amber-400', bgColor: 'bg-amber-500/10', borderColor: 'border-amber-500/30', glowColor: 'rgba(245,158,11,0.25)', emoji: '🥇' }
  if (score >= 41) return { level: 'Silver', color: 'text-gray-300', bgColor: 'bg-gray-400/10', borderColor: 'border-gray-400/30', glowColor: 'rgba(156,163,175,0.25)', emoji: '🥈' }
  return { level: 'Bronze', color: 'text-orange-400', bgColor: 'bg-orange-500/10', borderColor: 'border-orange-500/30', glowColor: 'rgba(249,115,22,0.25)', emoji: '🥉' }
}

/* ── Score calculation ── */
export function calculateEngagementScore(props: Omit<EngagementScoreProps, 'childName' | 'compact'>): number {
  const attendanceScore = (props.attendanceRate / 100) * 40
  const streakScore = Math.min(props.currentStreak / 10, 1) * 20
  const paymentScore = props.paymentStatus === 'current' ? 20 : props.paymentStatus === 'none' ? 10 : 0
  const referralScore = Math.min(props.referralCount / 3, 1) * 10
  const profileScore = props.profileComplete ? 10 : 0
  return Math.round(attendanceScore + streakScore + paymentScore + referralScore + profileScore)
}

/* ── Animated counter hook ── */
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

/* ── Circular progress ring ── */
function ProgressRing({ score, size, strokeWidth, glowColor }: { score: number; size: number; strokeWidth: number; glowColor: string }) {
  const animatedScore = useAnimatedValue(score)
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (animatedScore / 100) * circumference
  const { color } = getLevel(score)

  const strokeColor =
    score >= 81 ? '#06b6d4' :
    score >= 61 ? '#f59e0b' :
    score >= 41 ? '#9ca3af' :
    '#f97316'

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      {/* Background track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={strokeWidth}
        fill="none"
      />
      {/* Glow filter */}
      <defs>
        <filter id="ring-glow">
          <feGaussianBlur stdDeviation="4" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* Progress arc */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        filter="url(#ring-glow)"
        className="transition-all duration-100"
      />
    </svg>
  )
}

/* ── Improvement tips ── */
function getImprovementTip(props: Omit<EngagementScoreProps, 'compact'>): string {
  const score = calculateEngagementScore(props)
  const { level } = getLevel(score)

  if (props.paymentStatus === 'overdue') return 'Clear your overdue payment to boost your score!'
  if (!props.profileComplete) return 'Complete your profile for +10 points!'
  if (props.attendanceRate < 80) return `Improve attendance to reach ${level === 'Bronze' ? 'Silver' : 'Gold'}!`
  if (props.currentStreak < 5) return 'Keep attending to build your streak!'
  if (props.referralCount === 0) return 'Refer a friend for +10 bonus points!'

  const nextLevel = level === 'Bronze' ? 'Silver' : level === 'Silver' ? 'Gold' : level === 'Gold' ? 'Platinum' : null
  if (nextLevel) return `Book another session to reach ${nextLevel}!`
  return 'Amazing! You\'re a Platinum parent!'
}

/* ── Main component ── */
export default function EngagementScore(props: EngagementScoreProps) {
  const { childName, compact = false, ...scoreProps } = props
  const score = calculateEngagementScore(scoreProps)
  const animatedScore = useAnimatedValue(score)
  const levelInfo = getLevel(score)
  const tip = getImprovementTip(props)

  if (compact) {
    return (
      <Link href="/dashboard/engagement" className="block group">
        <div className="bg-[#141414]/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-4 shadow-[0_0_15px_rgba(78,205,230,0.05)] hover:border-[#4ecde6]/30 transition-all">
          <div className="flex items-center gap-4">
            {/* Mini ring */}
            <div className="relative w-14 h-14 flex-shrink-0">
              <ProgressRing score={score} size={56} strokeWidth={4} glowColor={levelInfo.glowColor} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold text-white">{animatedScore}</span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white/40 font-medium">Engagement Score</p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-sm font-bold ${levelInfo.color}`}>{levelInfo.emoji} {levelInfo.level}</span>
              </div>
              <p className="text-[10px] text-white/30 mt-0.5 truncate">{tip}</p>
            </div>
            <svg className="w-4 h-4 text-white/20 flex-shrink-0 group-hover:text-[#4ecde6] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </Link>
    )
  }

  return (
    <div className={`${levelInfo.bgColor} backdrop-blur-xl border ${levelInfo.borderColor} rounded-2xl p-6`} style={{ boxShadow: `0 0 30px ${levelInfo.glowColor}` }}>
      {/* Score ring + level */}
      <div className="flex flex-col items-center">
        <div className="relative">
          <ProgressRing score={score} size={140} strokeWidth={8} glowColor={levelInfo.glowColor} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-bold text-white">{animatedScore}</span>
            <span className="text-[10px] text-white/40 font-medium uppercase tracking-wider">out of 100</span>
          </div>
        </div>

        {/* Level badge */}
        <div className={`mt-4 px-4 py-1.5 rounded-full ${levelInfo.bgColor} border ${levelInfo.borderColor}`}>
          <span className={`text-sm font-bold ${levelInfo.color}`}>{levelInfo.emoji} {levelInfo.level} Parent</span>
        </div>

        {/* Streak */}
        {props.currentStreak > 0 && (
          <p className="mt-3 text-sm text-white/60">
            <span className="text-amber-400 font-bold">{props.currentStreak}</span> sessions in a row!
          </p>
        )}

        {/* Tip */}
        <p className="mt-3 text-xs text-white/40 text-center max-w-xs">{tip}</p>

        {/* Link to full page */}
        <Link
          href="/dashboard/engagement"
          className={`mt-4 text-xs font-medium ${levelInfo.color} hover:underline`}
        >
          View full breakdown &rarr;
        </Link>
      </div>
    </div>
  )
}
