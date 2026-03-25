export default function ScoreBadge({ score }: { score: number }) {
  return (
    <span
      className={`score-${score} inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold`}
    >
      {score}
    </span>
  )
}
