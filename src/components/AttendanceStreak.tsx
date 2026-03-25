interface AttendanceStreakProps {
  currentStreak: number
  bestStreak: number
  rate: number
}

export default function AttendanceStreak({ currentStreak, bestStreak, rate }: AttendanceStreakProps) {
  const isHot = currentStreak > 5

  return (
    <div className="bg-white rounded-xl border border-border p-6 text-center">
      {/* Main streak display */}
      <div className="mb-4">
        <span
          className={`text-4xl inline-block ${isHot ? 'animate-pulse-fire' : ''}`}
          role="img"
          aria-label="fire"
        >
          {currentStreak > 0 ? '\uD83D\uDD25' : '\u26BD'}
        </span>
        <div className="mt-2">
          <span className="text-3xl font-bold text-text">{currentStreak}</span>
          <span className="text-lg text-text-light ml-1">Session Streak!</span>
        </div>
      </div>

      {/* Sub-stats */}
      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
        <div>
          <div className="text-lg font-bold text-primary">{bestStreak}</div>
          <div className="text-xs text-text-light">Best Streak</div>
        </div>
        <div>
          <div className="text-lg font-bold text-accent">{rate}%</div>
          <div className="text-xs text-text-light">Attendance Rate</div>
        </div>
      </div>

      <style>{`
        @keyframes pulse-fire {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.2); }
        }
        .animate-pulse-fire {
          animation: pulse-fire 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
