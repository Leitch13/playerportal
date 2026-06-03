/**
 * Quick Insights bar shown at the top of the Players page.
 *
 * Server-rendered: receives pre-counted totals from the page-level data
 * load — no client interactivity, no extra network calls. The four tiles
 * are clickable: each routes to the same page with a `?filter=…` URL
 * param, so a tap drops the owner into the filtered list.
 *
 * Counts are STATIC totals for the academy (NOT filtered by the table's
 * current search/sort/filter state). That's intentional — they're meant
 * to be a stable at-a-glance view.
 */
import Link from 'next/link'

export interface PlayersInsightsCounts {
  active: number
  pendingStarts: number
  trials: number
  paymentIssues: number
}

const TILES: Array<{
  key: keyof PlayersInsightsCounts
  label: string
  filterParam: string
  emoji: string
  tone: 'emerald' | 'amber' | 'sky' | 'rose'
}> = [
  { key: 'active',         label: 'Active players',  filterParam: 'active',        emoji: '🟢', tone: 'emerald' },
  { key: 'pendingStarts',  label: 'Pending starts',  filterParam: 'pending',       emoji: '🟡', tone: 'amber'   },
  { key: 'trials',         label: 'Trials',          filterParam: 'trial',         emoji: '🔵', tone: 'sky'     },
  { key: 'paymentIssues',  label: 'Payment issues',  filterParam: 'payment_issue', emoji: '⚠️', tone: 'rose'    },
]

// Static palette → Tailwind JIT-safe.
const TONE: Record<'emerald' | 'amber' | 'sky' | 'rose', { value: string; border: string; bg: string }> = {
  emerald: { value: 'text-emerald-300', border: 'border-emerald-500/30', bg: 'bg-emerald-500/[0.06] hover:bg-emerald-500/[0.10]' },
  amber:   { value: 'text-amber-300',   border: 'border-amber-500/30',   bg: 'bg-amber-500/[0.06] hover:bg-amber-500/[0.10]' },
  sky:     { value: 'text-sky-300',     border: 'border-sky-500/30',     bg: 'bg-sky-500/[0.06] hover:bg-sky-500/[0.10]' },
  rose:    { value: 'text-rose-300',    border: 'border-rose-500/30',    bg: 'bg-rose-500/[0.06] hover:bg-rose-500/[0.10]' },
}

export default function PlayersInsightsBar({ counts }: { counts: PlayersInsightsCounts }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {TILES.map(t => {
        const value = counts[t.key]
        const tone = TONE[t.tone]
        return (
          <Link
            key={t.key}
            href={`/dashboard/players?filter=${t.filterParam}`}
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
