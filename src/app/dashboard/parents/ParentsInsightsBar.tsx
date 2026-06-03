/**
 * Quick Insights bar for the Parents List v2 page.
 *
 * Four tiles. Per user adjustment: NO MRR surfaced anywhere. Each tile is
 * clickable and routes to the same page with `?filter=…` so a tap drops
 * the owner into the filtered cohort.
 */
import Link from 'next/link'

export interface ParentsInsightsCounts {
  total: number
  healthy: number
  paymentIssues: number
  needsAttention: number
}

const TILES: Array<{
  key: keyof ParentsInsightsCounts
  label: string
  filterParam: string
  emoji: string
  tone: 'white' | 'emerald' | 'rose' | 'amber'
}> = [
  { key: 'total',          label: 'Total families',  filterParam: 'all',            emoji: '👨‍👩‍👧', tone: 'white'   },
  { key: 'healthy',        label: 'Healthy',         filterParam: 'healthy',        emoji: '🟢',      tone: 'emerald' },
  { key: 'paymentIssues',  label: 'Payment issues',  filterParam: 'payment_issues', emoji: '⚠️',      tone: 'rose'    },
  { key: 'needsAttention', label: 'Needs attention', filterParam: 'attention',      emoji: '⏰',      tone: 'amber'   },
]

const TONE: Record<'white' | 'emerald' | 'rose' | 'amber', { value: string; border: string; bg: string }> = {
  white:   { value: 'text-white',         border: 'border-white/[0.08]', bg: 'bg-white/[0.03] hover:bg-white/[0.06]' },
  emerald: { value: 'text-emerald-300',   border: 'border-emerald-500/30', bg: 'bg-emerald-500/[0.06] hover:bg-emerald-500/[0.10]' },
  rose:    { value: 'text-rose-300',      border: 'border-rose-500/30',    bg: 'bg-rose-500/[0.06] hover:bg-rose-500/[0.10]' },
  amber:   { value: 'text-amber-300',     border: 'border-amber-500/30',   bg: 'bg-amber-500/[0.06] hover:bg-amber-500/[0.10]' },
}

export default function ParentsInsightsBar({ counts }: { counts: ParentsInsightsCounts }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {TILES.map(t => {
        const value = counts[t.key]
        const tone = TONE[t.tone]
        return (
          <Link
            key={t.key}
            href={`/dashboard/parents?filter=${t.filterParam}`}
            className={`rounded-2xl border p-4 transition-colors ${tone.border} ${tone.bg}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm" aria-hidden>{t.emoji}</span>
              <span className="text-[10px] uppercase tracking-wider text-white/50 font-bold">{t.label}</span>
            </div>
            <div className={`text-3xl font-extrabold leading-none tabular-nums ${tone.value}`}>{value}</div>
          </Link>
        )
      })}
    </div>
  )
}
