const colours: Record<string, string> = {
  paid: 'bg-cyan-100 text-cyan-800',
  active: 'bg-cyan-100 text-cyan-800',
  present: 'bg-cyan-100 text-cyan-800',
  unpaid: 'bg-yellow-100 text-yellow-800',
  pending: 'bg-yellow-100 text-yellow-800',
  paused: 'bg-yellow-100 text-yellow-800',
  partial: 'bg-orange-100 text-orange-800',
  overdue: 'bg-red-100 text-red-800',
  cancelled: 'bg-red-100 text-red-800',
  canceled: 'bg-red-100 text-red-800',
  absent: 'bg-red-100 text-red-800',
  past_due: 'bg-orange-100 text-orange-800',
  trialing: 'bg-blue-100 text-blue-800',
  incomplete: 'bg-gray-100 text-gray-600',
  waived: 'bg-gray-100 text-gray-800',
}

export default function StatusBadge({ status }: { status: string }) {
  const colour = colours[status] || 'bg-gray-100 text-gray-800'
  return (
    <span
      className={`${colour} inline-block px-2.5 py-0.5 rounded-full text-xs font-medium capitalize`}
    >
      {status}
    </span>
  )
}
