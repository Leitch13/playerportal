'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import PlayerAvatar from '@/components/PlayerAvatar'

/* ---------- types ---------- */
interface SkillLevel {
  id: string
  skill_name: string
  current_level: number
  current_xp: number
  xp_to_next: number
  last_assessed_at: string | null
  organisation_id: string
  player_id: string
}

interface Player {
  id: string
  first_name: string
  last_name: string
  photo_url: string | null
  age_group: string | null
  position: string | null
}

interface Attendance {
  id: string
  present: boolean
  session_date: string
  group: { name: string } | { name: string }[] | null
}

interface Achievement {
  id: string
  awarded_at: string
  achievement: { name: string; emoji: string; description: string } | { name: string; emoji: string; description: string }[] | null
}

interface Review {
  id: string
  review_date: string
  coach: { full_name: string } | { full_name: string }[] | null
  ball_control?: number
  passing?: number
  shooting?: number
  dribbling?: number
  defending?: number
  game_sense?: number
  teamwork?: number
  fitness?: number
  [key: string]: unknown
}

interface PaymentRow {
  id: string
  description: string | null
  amount: number
  amount_paid: number
  status: string
  due_date: string | null
  paid_date: string | null
  created_at: string
}

/* ---------- helpers ---------- */
const LEVEL_TIERS = [
  { min: 1, max: 3, label: 'Beginner', tier: 'Bronze', color: '#CD7F32', bg: 'bg-amber-900/20', ring: 'ring-amber-700/40' },
  { min: 4, max: 6, label: 'Developing', tier: 'Silver', color: '#C0C0C0', bg: 'bg-gray-500/20', ring: 'ring-gray-400/40' },
  { min: 7, max: 9, label: 'Confident', tier: 'Gold', color: '#FFD700', bg: 'bg-yellow-500/20', ring: 'ring-yellow-500/40' },
  { min: 10, max: 10, label: 'Elite', tier: 'Platinum', color: '#E5E4E2', bg: 'bg-cyan-400/20', ring: 'ring-cyan-400/40' },
]

function getTier(level: number) {
  return LEVEL_TIERS.find((t) => level >= t.min && level <= t.max) || LEVEL_TIERS[0]
}

const SKILL_ICONS: Record<string, string> = {
  'Ball Control': '\u26BD',
  Passing: '\uD83C\uDFAF',
  Shooting: '\uD83D\uDE80',
  Dribbling: '\u26A1',
  Defending: '\uD83D\uDEE1\uFE0F',
  'Game Sense': '\uD83E\uDDE0',
  Teamwork: '\uD83E\uDD1D',
  Fitness: '\uD83D\uDCAA',
}

const SKILL_KEYS: Record<string, string> = {
  'Ball Control': 'ball_control',
  Passing: 'passing',
  Shooting: 'shooting',
  Dribbling: 'dribbling',
  Defending: 'defending',
  'Game Sense': 'game_sense',
  Teamwork: 'teamwork',
  Fitness: 'fitness',
}

function computeTrend(skill: SkillLevel, reviews: Review[]): 'up' | 'stable' | 'down' {
  const key = SKILL_KEYS[skill.skill_name]
  if (!key || reviews.length < 2) return 'stable'
  const recent = reviews.slice(0, 3)
  const scores = recent.map((r) => (r[key] as number) || 0).filter((s) => s > 0)
  if (scores.length < 2) return 'stable'
  const diff = scores[0] - scores[scores.length - 1]
  if (diff > 0) return 'up'
  if (diff < 0) return 'down'
  return 'stable'
}

function TrendArrow({ trend }: { trend: 'up' | 'stable' | 'down' }) {
  if (trend === 'up')
    return <span className="text-green-400 text-xs font-bold" title="Improving">{'\u2191'}</span>
  if (trend === 'down')
    return <span className="text-red-400 text-xs font-bold" title="Declining">{'\u2193'}</span>
  return <span className="text-white/30 text-xs" title="Stable">{'\u2192'}</span>
}

/* ---------- sub-components ---------- */

function OverallLevelBadge({ level, totalXp, totalXpToNext }: { level: number; totalXp: number; totalXpToNext: number }) {
  const tier = getTier(level)
  const pct = totalXpToNext > 0 ? Math.min((totalXp / totalXpToNext) * 100, 100) : 0
  return (
    <div className={`relative p-6 rounded-2xl border-2 ${tier.bg} ${tier.ring} ring-2 text-center`}>
      <div
        className="w-20 h-20 mx-auto rounded-full flex items-center justify-center text-3xl font-black border-4 mb-3"
        style={{ borderColor: tier.color, color: tier.color }}
      >
        {level}
      </div>
      <div className="text-lg font-bold text-white">
        Level {level} — {tier.label}
      </div>
      <div className="text-xs text-white/50 mb-3">{tier.tier} Tier</div>
      <div className="w-full h-2.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${tier.color}88, ${tier.color})` }}
        />
      </div>
      <div className="text-xs text-white/50 mt-1">
        {totalXp} / {totalXpToNext} XP to Level {Math.min(level + 1, 10)}
      </div>
    </div>
  )
}

function SkillCard({
  skill,
  trend,
}: {
  skill: SkillLevel
  trend: 'up' | 'stable' | 'down'
}) {
  const tier = getTier(skill.current_level)
  const pct = skill.xp_to_next > 0 ? Math.min((skill.current_xp / skill.xp_to_next) * 100, 100) : 0
  const icon = SKILL_ICONS[skill.skill_name] || '\u2B50'

  return (
    <div className="bg-[#141414] rounded-xl border border-[#1e1e1e] p-4 hover:border-white/20 transition-all group">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">{icon}</span>
          <span className="text-sm font-semibold text-white">{skill.skill_name}</span>
        </div>
        <TrendArrow trend={trend} />
      </div>

      {/* Level dots */}
      <div className="flex gap-1 mb-2">
        {Array.from({ length: 10 }, (_, i) => (
          <div
            key={i}
            className="h-2 flex-1 rounded-full transition-all"
            style={{
              background:
                i < skill.current_level
                  ? tier.color
                  : 'rgba(255,255,255,0.08)',
            }}
          />
        ))}
      </div>

      {/* XP bar */}
      <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden mb-2">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: tier.color }}
        />
      </div>

      <div className="flex items-center justify-between text-[10px] text-white/50">
        <span>
          Lvl {skill.current_level} — {skill.current_xp}/{skill.xp_to_next} XP
        </span>
        {skill.last_assessed_at && (
          <span>{new Date(skill.last_assessed_at).toLocaleDateString()}</span>
        )}
      </div>
    </div>
  )
}

function SkillTreeVisualization({ skills }: { skills: SkillLevel[] }) {
  const svgWidth = 600
  const svgHeight = 320
  const centerX = svgWidth / 2
  const centerY = svgHeight / 2
  const radius = 120

  return (
    <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Skill Tree</h3>
      <div className="flex justify-center overflow-x-auto">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full max-w-[600px]"
          style={{ minWidth: 300 }}
        >
          {/* Background circle rings */}
          {[0.25, 0.5, 0.75, 1].map((scale) => (
            <circle
              key={scale}
              cx={centerX}
              cy={centerY}
              r={radius * scale}
              fill="none"
              stroke="rgba(255,255,255,0.05)"
              strokeWidth="1"
            />
          ))}

          {/* Skill nodes + connections */}
          {skills.map((skill, i) => {
            const angle = (i / skills.length) * 2 * Math.PI - Math.PI / 2
            const dist = radius * (skill.current_level / 10)
            const x = centerX + Math.cos(angle) * dist
            const y = centerY + Math.sin(angle) * dist
            const outerX = centerX + Math.cos(angle) * radius
            const outerY = centerY + Math.sin(angle) * radius
            const tier = getTier(skill.current_level)
            const nodeR = 14 + skill.current_level * 1.5

            return (
              <g key={skill.id}>
                {/* Connection line from center to node */}
                <line
                  x1={centerX}
                  y1={centerY}
                  x2={x}
                  y2={y}
                  stroke={tier.color}
                  strokeWidth="2"
                  opacity="0.3"
                />
                {/* Dashed line from node to outer edge (locked portion) */}
                <line
                  x1={x}
                  y1={y}
                  x2={outerX}
                  y2={outerY}
                  stroke="rgba(255,255,255,0.1)"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
                {/* Node circle */}
                <circle
                  cx={x}
                  cy={y}
                  r={nodeR}
                  fill={`${tier.color}22`}
                  stroke={tier.color}
                  strokeWidth="2"
                />
                {/* Level text */}
                <text
                  x={x}
                  y={y + 1}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={tier.color}
                  fontSize="11"
                  fontWeight="bold"
                >
                  {skill.current_level}
                </text>
                {/* Skill label */}
                <text
                  x={outerX + Math.cos(angle) * 18}
                  y={outerY + Math.sin(angle) * 18}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="rgba(255,255,255,0.6)"
                  fontSize="9"
                >
                  {skill.skill_name}
                </text>
              </g>
            )
          })}

          {/* Center node */}
          <circle cx={centerX} cy={centerY} r="8" fill="#4ecde6" opacity="0.6" />
        </svg>
      </div>
    </div>
  )
}

function RecentXpGains({
  attendance,
  reviews,
}: {
  attendance: Attendance[]
  reviews: Review[]
}) {
  const items: { text: string; xp: number; date: string; type: string }[] = []

  // Attendance XP
  for (const a of attendance.slice(0, 10)) {
    if (a.present) {
      items.push({
        text: `All Skills (Session attended${a.group ? ` — ${Array.isArray(a.group) ? (a.group[0] as { name: string })?.name : (a.group as { name: string }).name}` : ''})`,
        xp: 10,
        date: a.session_date,
        type: 'attendance',
      })
    }
  }

  // Review XP
  for (const r of reviews.slice(0, 5)) {
    const coachObj = Array.isArray(r.coach) ? r.coach[0] : r.coach
    const coachName = (coachObj as { full_name: string } | null)?.full_name || 'Coach'
    items.push({
      text: `Multiple Skills (Coach review by ${coachName})`,
      xp: 25,
      date: r.review_date,
      type: 'review',
    })
  }

  // Sort by date desc
  items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  if (items.length === 0) return null

  return (
    <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Recent XP Gains</h3>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {items.slice(0, 15).map((item, i) => (
          <div
            key={i}
            className="flex items-center gap-3 py-2 border-b border-white/[0.05] last:border-0"
          >
            <div
              className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                item.type === 'attendance'
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-purple-500/20 text-purple-400'
              }`}
            >
              +{item.xp}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-white truncate">{item.text}</div>
              <div className="text-[10px] text-white/40">
                {new Date(item.date).toLocaleDateString()}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function getAchievementData(ach: Achievement): { name: string; emoji: string; description: string } | null {
  if (!ach.achievement) return null
  if (Array.isArray(ach.achievement)) return ach.achievement[0] || null
  return ach.achievement
}

function PassportAchievements({ achievements }: { achievements: Achievement[] }) {
  // Progression-related badge definitions
  const progressionBadges = [
    { name: 'First Level Up!', emoji: '\uD83C\uDF1F', condition: 'Level up any skill' },
    { name: '5 Skills at Level 5+', emoji: '\uD83D\uDD25', condition: 'Get 5 skills to level 5+' },
    { name: 'Perfect Attendance Bonus', emoji: '\uD83D\uDCAF', condition: '10 sessions in a row' },
    { name: 'All-Rounder', emoji: '\uD83C\uDF08', condition: 'All skills at level 3+' },
    { name: 'Elite Skill', emoji: '\uD83D\uDC8E', condition: 'Any skill reaches level 10' },
    { name: 'XP Master', emoji: '\u2B50', condition: 'Earn 1000 total XP' },
  ]

  const earnedNames = new Set(
    achievements
      .map((a) => getAchievementData(a))
      .filter(Boolean)
      .map((a) => a!.name)
  )

  return (
    <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Progression Badges</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {progressionBadges.map((badge) => {
          const earned = earnedNames.has(badge.name)
          return (
            <div
              key={badge.name}
              className={`text-center p-3 rounded-xl border transition-all ${
                earned
                  ? 'bg-yellow-500/10 border-yellow-500/30'
                  : 'bg-white/[0.02] border-white/[0.06] opacity-40 grayscale'
              }`}
            >
              <span className="text-3xl block mb-1">{badge.emoji}</span>
              <span className="text-xs font-medium text-white block">{badge.name}</span>
              <span className="text-[10px] text-white/40">{badge.condition}</span>
            </div>
          )
        })}
      </div>

      {/* Earned achievements from DB */}
      {achievements.length > 0 && (
        <div className="mt-4 pt-4 border-t border-white/[0.08]">
          <p className="text-xs text-white/50 mb-2">Earned Awards</p>
          <div className="flex flex-wrap gap-2">
            {achievements.map((ach) => {
              const a = getAchievementData(ach)
              if (!a) return null
              return (
                <div
                  key={ach.id}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-yellow-500/10 border border-yellow-500/20"
                >
                  <span className="text-sm">{a.emoji}</span>
                  <span className="text-xs font-medium text-white">{a.name}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/* ---------- Update Skills Form ---------- */
function UpdateSkillsForm({
  skills,
  orgId,
  onClose,
  onUpdated,
}: {
  skills: SkillLevel[]
  orgId: string
  onClose: () => void
  onUpdated: (updated: SkillLevel[]) => void
}) {
  const [levels, setLevels] = useState<Record<string, number>>(
    Object.fromEntries(skills.map((s) => [s.id, s.current_level]))
  )
  const [saving, setSaving] = useState(false)

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/progression/award-xp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'coach_assessment',
          skills: skills.map((s) => ({
            id: s.id,
            player_id: s.player_id,
            skill_name: s.skill_name,
            new_level: levels[s.id],
            organisation_id: orgId,
          })),
        }),
      })
      if (res.ok) {
        const data = await res.json()
        onUpdated(data.skills || [])
        onClose()
      }
    } catch {
      /* ignore */
    } finally {
      setSaving(false)
    }
  }, [levels, skills, orgId, onClose, onUpdated])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">Quick Skill Assessment</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white text-xl">
            {'\u2715'}
          </button>
        </div>
        <div className="space-y-4">
          {skills.map((skill) => {
            const icon = SKILL_ICONS[skill.skill_name] || '\u2B50'
            const val = levels[skill.id]
            const tier = getTier(val)
            return (
              <div key={skill.id}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-white">
                    {icon} {skill.skill_name}
                  </span>
                  <span className="text-sm font-bold" style={{ color: tier.color }}>
                    {val}
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={val}
                  onChange={(e) =>
                    setLevels((prev) => ({ ...prev, [skill.id]: Number(e.target.value) }))
                  }
                  className="w-full accent-[#4ecde6] h-2 bg-white/10 rounded-full appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-white/30 mt-0.5">
                  <span>1</span>
                  <span>{tier.label} ({tier.tier})</span>
                  <span>10</span>
                </div>
              </div>
            )
          })}
        </div>
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-white/10 text-white/60 text-sm hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2 rounded-lg bg-[#4ecde6] text-black text-sm font-semibold hover:bg-[#4ecde6]/90 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Assessment'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ---------- admin payments panel (read-only) ---------- */
const PAYMENT_STATUS_STYLES: Record<string, string> = {
  paid: 'bg-green-500/15 text-green-400',
  partial: 'bg-amber-500/15 text-amber-400',
  pending: 'bg-yellow-500/15 text-yellow-300',
  unpaid: 'bg-yellow-500/15 text-yellow-300',
  overdue: 'bg-red-500/15 text-red-400',
  refunded: 'bg-white/10 text-white/50',
  waived: 'bg-white/10 text-white/50',
}

function fmtGBP(n: number) {
  return `£${Number(n).toFixed(2)}`
}

function PassportPayments({ payments }: { payments: PaymentRow[] }) {
  // Outstanding across the rows shown (recent 10) — an at-a-glance chase
  // signal, not a full statement; "View all" links to the payments page.
  const outstanding = payments.reduce((sum, p) => {
    if (['paid', 'refunded', 'waived', 'cancelled'].includes(p.status)) return sum
    return sum + Math.max(0, Number(p.amount) - Number(p.amount_paid || 0))
  }, 0)

  return (
    <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] p-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-white">
          {'💳'} Payments
          <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide bg-white/10 text-white/50 font-medium align-middle">
            Admin only
          </span>
        </h3>
        <Link href="/dashboard/payments" className="text-xs text-[#4ecde6] hover:underline">
          View all {'→'}
        </Link>
      </div>
      {outstanding > 0 && (
        <div className="mb-3 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/25 text-sm text-red-300">
          Outstanding (recent): <span className="font-semibold">{fmtGBP(outstanding)}</span>
        </div>
      )}
      {payments.length === 0 ? (
        <p className="text-sm text-white/40">No payments recorded for this player yet.</p>
      ) : (
        <div className="space-y-2">
          {payments.map((p) => (
            <div key={p.id} className="flex items-center gap-3 text-sm">
              <div className="flex-1 min-w-0">
                <p className="text-white truncate">{p.description || 'Payment'}</p>
                <p className="text-xs text-white/40">
                  {new Date(p.paid_date || p.due_date || p.created_at).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
              </div>
              <span className="text-white/80 font-medium whitespace-nowrap">{fmtGBP(Number(p.amount))}</span>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize whitespace-nowrap ${
                  PAYMENT_STATUS_STYLES[p.status] || 'bg-white/10 text-white/60'
                }`}
              >
                {p.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ---------- main component ---------- */
export default function ProgressionPassport({
  player,
  skillLevels: initialSkills,
  attendance,
  achievements,
  reviews,
  isStaff,
  orgId,
  payments = null,
}: {
  player: Player
  skillLevels: SkillLevel[]
  attendance: Attendance[]
  achievements: Achievement[]
  reviews: Review[]
  isStaff: boolean
  orgId: string
  /** Admin-only recent payments; null hides the panel (coach/parent views). */
  payments?: PaymentRow[] | null
}) {
  const [skills, setSkills] = useState<SkillLevel[]>(initialSkills)
  const [showAssessment, setShowAssessment] = useState(false)
  const [celebrating, setCelebrating] = useState(false)

  // Compute overall level from skill average
  const avgLevel =
    skills.length > 0
      ? Math.round(skills.reduce((sum, s) => sum + s.current_level, 0) / skills.length)
      : 1
  const avgXp =
    skills.length > 0
      ? Math.round(skills.reduce((sum, s) => sum + s.current_xp, 0) / skills.length)
      : 0
  const avgXpToNext =
    skills.length > 0
      ? Math.round(skills.reduce((sum, s) => sum + s.xp_to_next, 0) / skills.length)
      : 100

  const handleUpdated = (updated: SkillLevel[]) => {
    if (updated.length > 0) {
      // Check for level ups
      const leveledUp = updated.some((u) => {
        const prev = skills.find((s) => s.id === u.id)
        return prev && u.current_level > prev.current_level
      })
      setSkills(updated)
      if (leveledUp) {
        setCelebrating(true)
        setTimeout(() => setCelebrating(false), 3000)
      }
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Level-up celebration overlay */}
      {celebrating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="text-center animate-bounce">
            <div className="text-6xl mb-2">{'\uD83C\uDF89'}</div>
            <div className="text-2xl font-black text-yellow-400 drop-shadow-lg">
              LEVEL UP!
            </div>
          </div>
        </div>
      )}

      {/* Back link + header */}
      <div className="flex items-start gap-4">
        <PlayerAvatar
          photoUrl={player.photo_url}
          firstName={player.first_name}
          lastName={player.last_name}
          size="xl"
        />
        <div className="flex-1 min-w-0">
          <Link
            href={`/dashboard/players/${player.id}`}
            className="text-sm text-white/60 hover:text-white hover:underline mb-1 inline-block"
          >
            {'\u2190'} Back to Profile
          </Link>
          <h1 className="text-2xl font-bold text-white">
            {player.first_name} {player.last_name}
          </h1>
          <p className="text-sm text-white/50">Player Progression Passport</p>
          <div className="flex flex-wrap gap-2 mt-2">
            {player.age_group && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-white/10 text-white font-medium">
                {player.age_group}
              </span>
            )}
            {player.position && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-[#4ecde6]/10 text-[#4ecde6] font-medium">
                {player.position}
              </span>
            )}
          </div>
        </div>
        {isStaff && (
          <button
            onClick={() => setShowAssessment(true)}
            className="flex-shrink-0 px-4 py-2 rounded-xl bg-[#4ecde6] text-black text-sm font-semibold hover:bg-[#4ecde6]/90 transition-colors"
          >
            Update Skills
          </button>
        )}
      </div>

      {/* Overall level badge */}
      <OverallLevelBadge level={avgLevel} totalXp={avgXp} totalXpToNext={avgXpToNext} />

      {/* Admin-only payments panel */}
      {payments !== null && <PassportPayments payments={payments} />}

      {/* Skills Grid */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-3">Core Skills</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {skills.map((skill) => (
            <SkillCard
              key={skill.id}
              skill={skill}
              trend={computeTrend(skill, reviews)}
            />
          ))}
        </div>
      </div>

      {/* Skill Tree Visualization */}
      <SkillTreeVisualization skills={skills} />

      {/* Recent XP + Achievements side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <RecentXpGains attendance={attendance} reviews={reviews} />
        <PassportAchievements achievements={achievements} />
      </div>

      {/* Assessment form modal */}
      {showAssessment && (
        <UpdateSkillsForm
          skills={skills}
          orgId={orgId}
          onClose={() => setShowAssessment(false)}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  )
}
