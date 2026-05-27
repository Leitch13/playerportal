interface AttendanceStreakProps {
  currentStreak: number
  bestStreak: number
  rate: number
}

/**
 * Gamified attendance streak widget for the player profile.
 *
 * Visual hierarchy:
 *  - Big animated emoji that escalates (⚽ → 🔥 → 🚀 → 💎) as the streak grows
 *  - Current streak count with milestone label ("4-week streak!")
 *  - Progress bar toward next milestone (5, 10, 20, 50)
 *  - Best streak + attendance rate as supporting stats
 *
 * Designed to make parents and kids excited to keep coming back.
 */
export default function AttendanceStreak({ currentStreak, bestStreak, rate }: AttendanceStreakProps) {
  const milestones = [5, 10, 20, 50, 100]
  const nextMilestone = milestones.find((m) => m > currentStreak) || currentStreak
  const prevMilestone = [...milestones].reverse().find((m) => m <= currentStreak) || 0
  const progressToNext = currentStreak > 0
    ? Math.min(100, ((currentStreak - prevMilestone) / (nextMilestone - prevMilestone)) * 100)
    : 0

  // Emoji + label scales with streak so it feels rewarding
  let emoji = '⚽' // soccer ball
  let tier = 'Just getting started'
  let glowColor = 'rgba(78, 205, 230, 0.15)'

  if (currentStreak >= 50) {
    emoji = '💎' // diamond
    tier = 'Legend'
    glowColor = 'rgba(168, 85, 247, 0.35)'
  } else if (currentStreak >= 20) {
    emoji = '🚀' // rocket
    tier = 'Unstoppable'
    glowColor = 'rgba(236, 72, 153, 0.3)'
  } else if (currentStreak >= 10) {
    emoji = '🔥' // fire
    tier = 'On fire'
    glowColor = 'rgba(249, 115, 22, 0.3)'
  } else if (currentStreak >= 5) {
    emoji = '🔥' // fire
    tier = 'Heating up'
    glowColor = 'rgba(245, 158, 11, 0.25)'
  } else if (currentStreak >= 1) {
    emoji = '✨' // sparkles
    tier = 'Showing up'
    glowColor = 'rgba(78, 205, 230, 0.2)'
  }

  const isHot = currentStreak >= 5

  return (
    <div
      className="relative bg-gradient-to-br from-[#141414] to-[#1a1a1a] rounded-xl border border-white/[0.08] p-6 overflow-hidden"
      style={{ boxShadow: `0 0 40px ${glowColor}` }}
    >
      {/* Subtle radial glow accent */}
      <div
        className="absolute -top-12 -right-12 w-40 h-40 rounded-full opacity-30 blur-2xl pointer-events-none"
        style={{ background: glowColor }}
      />

      <div className="relative">
        {/* Tier label */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] uppercase tracking-widest font-semibold text-white/40">
            Attendance Streak
          </span>
          <span className="text-[10px] uppercase tracking-wider font-semibold text-white/60">
            {tier}
          </span>
        </div>

        {/* Main streak display */}
        <div className="text-center mb-5">
          <span
            className={`text-6xl inline-block ${isHot ? 'animate-pulse-fire' : ''}`}
            role="img"
            aria-label={tier}
          >
            {emoji}
          </span>
          <div className="mt-3">
            <span className="text-5xl font-bold text-white tabular-nums">{currentStreak}</span>
            <div className="text-xs text-white/60 mt-1">
              {currentStreak === 0
                ? 'No streak yet — show up to start one!'
                : currentStreak === 1
                ? 'session in a row'
                : 'sessions in a row'}
            </div>
          </div>
        </div>

        {/* Progress bar to next milestone */}
        {currentStreak > 0 && currentStreak < 100 && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-[10px] text-white/50 mb-1">
              <span>Next: {nextMilestone}-streak</span>
              <span>{Math.max(0, nextMilestone - currentStreak)} to go</span>
            </div>
            <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${progressToNext}%`,
                  background: 'linear-gradient(90deg, #4ecde6, #a855f7)',
                  boxShadow: `0 0 12px ${glowColor}`,
                }}
              />
            </div>
          </div>
        )}

        {/* Sub-stats */}
        <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/[0.06]">
          <div className="text-center">
            <div className="text-xl font-bold text-white tabular-nums">{bestStreak}</div>
            <div className="text-[10px] uppercase tracking-wider text-white/50 mt-0.5">
              Best Ever
            </div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-[#4ecde6] tabular-nums">{rate}%</div>
            <div className="text-[10px] uppercase tracking-wider text-white/50 mt-0.5">
              Attendance
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse-fire {
          0%, 100% { transform: scale(1); filter: drop-shadow(0 0 8px ${glowColor}); }
          50% { transform: scale(1.15); filter: drop-shadow(0 0 16px ${glowColor}); }
        }
        .animate-pulse-fire {
          animation: pulse-fire 1.8s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
