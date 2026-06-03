/**
 * Conditional badge row at the top of the Parent Detail page.
 *
 * Renders nothing when there are no badges (the parent's family is healthy
 * + caught up). Each badge is a small pill — pure presentational, no links.
 */
import type { FamilyBadge } from '@/lib/family-derive'

const TONE: Record<FamilyBadge['tone'], string> = {
  rose:    'bg-rose-500/15    text-rose-300    border-rose-500/30',
  amber:   'bg-amber-500/15   text-amber-300   border-amber-500/30',
  sky:     'bg-sky-500/15     text-sky-300     border-sky-500/30',
  emerald: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
}

export default function FamilyInsightsBar({ badges }: { badges: FamilyBadge[] }) {
  if (badges.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2 items-center">
      <span className="text-[10px] uppercase tracking-wider text-white/40 font-bold mr-1">Family insights</span>
      {badges.map(b => (
        <span
          key={b.key}
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border ${TONE[b.tone]}`}
        >
          <span aria-hidden>{b.emoji}</span>{b.label}
        </span>
      ))}
    </div>
  )
}
