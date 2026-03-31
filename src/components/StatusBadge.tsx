const colours: Record<string, string> = {
  paid: 'bg-cyan-500/15 text-cyan-400',
  active: 'bg-cyan-500/15 text-cyan-400',
  present: 'bg-cyan-500/15 text-cyan-400',
  confirmed: 'bg-cyan-500/15 text-cyan-400',
  unpaid: 'bg-yellow-500/15 text-yellow-400',
  pending: 'bg-yellow-500/15 text-yellow-400',
  paused: 'bg-yellow-500/15 text-yellow-400',
  partial: 'bg-orange-500/15 text-orange-400',
  overdue: 'bg-red-500/15 text-red-400',
  cancelled: 'bg-red-500/15 text-red-400',
  canceled: 'bg-red-500/15 text-red-400',
  absent: 'bg-red-500/15 text-red-400',
  past_due: 'bg-orange-500/15 text-orange-400',
  trialing: 'bg-blue-500/15 text-blue-400',
  incomplete: 'bg-white/[0.06] text-white/60',
  waived: 'bg-white/[0.06] text-white/60',
}

export default function StatusBadge({ status }: { status: string }) {
  const colour = colours[status] || 'bg-white/[0.06] text-white/60'
  return (
    <span
      className={`${colour} inline-block px-2.5 py-0.5 rounded-full text-xs font-medium capitalize`}
    >
      {status}
    </span>
  )
}
