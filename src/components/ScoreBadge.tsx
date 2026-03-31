const scoreColors: Record<number, string> = {
  1: 'bg-red-500/15 text-red-400',
  2: 'bg-orange-500/15 text-orange-400',
  3: 'bg-yellow-500/15 text-yellow-400',
  4: 'bg-cyan-500/15 text-cyan-400',
  5: 'bg-green-500/15 text-green-400',
}

export default function ScoreBadge({ score }: { score: number }) {
  const color = scoreColors[score] || 'bg-white/[0.06] text-white/60'
  return (
    <span
      className={`${color} inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold`}
    >
      {score}
    </span>
  )
}
