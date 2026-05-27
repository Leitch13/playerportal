import Link from 'next/link'

/**
 * "Unlocking next" milestones panel for parents.
 *
 * Turns an empty new-parent dashboard from a ghost town into a tutorial-mode
 * quest tracker. Shows each milestone with current progress and what unlocks
 * when it's hit. Auto-hides once everything is unlocked, so it disappears
 * for long-tenure parents and never feels stale.
 *
 * Logic is data-driven from real counts:
 *  - First class booked → unlocks the schedule view
 *  - First session attended → unlocks attendance tracker
 *  - 5 sessions attended → unlocks streak badge
 *  - First review → unlocks skills radar
 *  - Second review → unlocks progress-over-time chart
 *  - First achievement → unlocks badges row
 */

export interface ParentMilestonesProps {
  brandColor?: string
  enrolmentCount: number
  attendedCount: number
  reviewCount: number
  achievementCount: number
}

type Milestone = {
  emoji: string
  label: string
  unlock: string
  done: boolean
  current: number
  target: number
  href?: string
}

export default function ParentUnlockMilestones({
  brandColor = '#4ecde6',
  enrolmentCount,
  attendedCount,
  reviewCount,
  achievementCount,
}: ParentMilestonesProps) {
  const milestones: Milestone[] = [
    {
      emoji: '📅',
      label: 'Book your first class',
      unlock: 'Unlocks your weekly schedule',
      done: enrolmentCount >= 1,
      current: Math.min(enrolmentCount, 1),
      target: 1,
      href: '/dashboard/schedule',
    },
    {
      emoji: '👟',
      label: 'Attend your first session',
      unlock: 'Unlocks the attendance tracker',
      done: attendedCount >= 1,
      current: Math.min(attendedCount, 1),
      target: 1,
    },
    {
      emoji: '🔥',
      label: 'Hit a 5-session streak',
      unlock: 'Unlocks the streak badge',
      done: attendedCount >= 5,
      current: Math.min(attendedCount, 5),
      target: 5,
    },
    {
      emoji: '📊',
      label: 'Receive your first review',
      unlock: 'Unlocks the skills radar',
      done: reviewCount >= 1,
      current: Math.min(reviewCount, 1),
      target: 1,
    },
    {
      emoji: '📈',
      label: 'Receive your second review',
      unlock: 'Unlocks the progress trend chart',
      done: reviewCount >= 2,
      current: Math.min(reviewCount, 2),
      target: 2,
    },
    {
      emoji: '🏆',
      label: 'Earn your first achievement',
      unlock: 'Unlocks the badges row',
      done: achievementCount >= 1,
      current: Math.min(achievementCount, 1),
      target: 1,
    },
  ]

  const completedCount = milestones.filter((m) => m.done).length
  const allDone = completedCount === milestones.length

  // Auto-hide once everything is unlocked — long-tenure parents shouldn't see this
  if (allDone) return null

  // Find the next-in-line milestone to highlight
  const nextMilestone = milestones.find((m) => !m.done)

  return (
    <div
      className="bg-gradient-to-br from-[#141414] to-[#181818] rounded-2xl border border-white/[0.08] p-6 overflow-hidden relative"
      style={{ boxShadow: `0 0 40px ${brandColor}15` }}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-widest font-bold text-white/40">
            Your Journey
          </span>
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: `${brandColor}20`, color: brandColor }}
          >
            {completedCount}/{milestones.length}
          </span>
        </div>
        {nextMilestone && (
          <span className="text-[10px] text-white/40 uppercase tracking-wider">
            Up next: {nextMilestone.emoji}
          </span>
        )}
      </div>
      <h3 className="text-lg font-bold text-white mb-1">Unlocking next</h3>
      <p className="text-xs text-white/50 mb-5">
        Your dashboard fills up as your child engages. Here&apos;s what&apos;s coming.
      </p>

      <div className="space-y-3">
        {milestones.map((m, i) => {
          const pct = (m.current / m.target) * 100
          const isNext = !m.done && m === nextMilestone
          const clickable = !m.done && !!m.href
          const wrapperClass = `flex items-center gap-3 p-3 rounded-xl transition-all ${
            clickable ? 'hover:bg-white/[0.06] cursor-pointer' : ''
          } ${
            m.done
              ? 'bg-white/[0.02] border border-white/[0.04] opacity-50'
              : isNext
              ? 'bg-white/[0.04] border'
              : 'bg-white/[0.02] border border-white/[0.04]'
          }`
          const wrapperStyle = isNext ? { borderColor: `${brandColor}40` } : {}
          const inner = (
            <>
              <div
                className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-xl ${
                  m.done ? 'grayscale' : ''
                }`}
                style={!m.done ? { background: `${brandColor}15` } : { background: 'rgba(255,255,255,0.04)' }}
              >
                {m.done ? '✅' : m.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span
                    className={`text-sm font-semibold ${m.done ? 'line-through text-white/40' : 'text-white'}`}
                  >
                    {m.label}
                  </span>
                  {!m.done && m.target > 1 && (
                    <span className="text-xs font-bold text-white/40 tabular-nums">
                      {m.current}/{m.target}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] text-white/40">{m.unlock}</p>
                </div>
                {!m.done && m.target > 1 && (
                  <div className="mt-1.5 h-1 bg-white/[0.04] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        background: `linear-gradient(90deg, ${brandColor}, ${brandColor}80)`,
                      }}
                    />
                  </div>
                )}
              </div>
            </>
          )
          return clickable ? (
            <Link key={i} href={m.href!} className={wrapperClass} style={wrapperStyle}>{inner}</Link>
          ) : (
            <div key={i} className={wrapperClass} style={wrapperStyle}>{inner}</div>
          )
        })}
      </div>
    </div>
  )
}
