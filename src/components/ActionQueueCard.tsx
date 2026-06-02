/**
 * Action Queue — top-of-dashboard widget that surfaces the four cohorts a
 * busy academy owner most needs to triage in 30 seconds:
 *
 *   1. Pending future starts (Stage 3 scheduled subscriptions)
 *   2. Failed / past-due payments
 *   3. Trials expiring within 7 days
 *   4. Players needing attention (review overdue or attendance drop)
 *
 * Plus an optional 5th row for unsigned waivers, only rendered when the count
 * is > 0 (the feature is opt-in per academy and many don't use it).
 *
 * Each row links directly to the relevant page so a single tap drops the
 * owner into the appropriate filtered view. Rows with count 0 collapse to
 * a muted "All clear" line — the card never shows scary zero-counts.
 *
 * Purely presentational. Data is computed server-side in AdminDashboard.
 */
import Link from 'next/link'

export interface ActionQueueCounts {
  pendingStarts: number
  pastDuePayments: number
  trialsExpiring7d: number
  needingAttention: number
  unsignedWaivers?: number  // optional — only shown when > 0
}

interface Row {
  key: keyof ActionQueueCounts
  label: string
  href: string
  emoji: string
  tone: 'rose' | 'amber' | 'sky' | 'violet'
}

// Static palette → Tailwind JIT-safe (no class names assembled at runtime).
const TONE: Record<Row['tone'], { dot: string; text: string; chip: string; bar: string }> = {
  rose:   { dot: 'bg-rose-500',   text: 'text-rose-200',   chip: 'bg-rose-500/15 text-rose-300 border border-rose-500/30',     bar: 'before:bg-rose-500/60' },
  amber:  { dot: 'bg-amber-500',  text: 'text-amber-200',  chip: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',  bar: 'before:bg-amber-500/60' },
  sky:    { dot: 'bg-sky-500',    text: 'text-sky-200',    chip: 'bg-sky-500/15 text-sky-300 border border-sky-500/30',        bar: 'before:bg-sky-500/60' },
  violet: { dot: 'bg-violet-500', text: 'text-violet-200', chip: 'bg-violet-500/15 text-violet-300 border border-violet-500/30',bar: 'before:bg-violet-500/60' },
}

export default function ActionQueueCard({ counts }: { counts: ActionQueueCounts }) {
  const rows: Row[] = [
    { key: 'pastDuePayments', label: 'Failed / past-due payments', href: '/dashboard/payments?status=past_due', emoji: '💳', tone: 'rose'   },
    { key: 'pendingStarts',   label: 'Pending future starts',      href: '/dashboard/enrolments#pending',       emoji: '📅', tone: 'amber'  },
    { key: 'trialsExpiring7d',label: 'Trials expiring in 7 days',  href: '/dashboard/enrolments#trial',         emoji: '⏰', tone: 'sky'    },
    { key: 'needingAttention',label: 'Players needing attention',  href: '/dashboard/players?filter=attention', emoji: '👀', tone: 'violet' },
  ]
  if ((counts.unsignedWaivers ?? 0) > 0) {
    rows.push({ key: 'unsignedWaivers', label: 'Unsigned waivers', href: '/dashboard/waivers', emoji: '📄', tone: 'amber' })
  }

  const totalActions = rows.reduce((sum, r) => sum + (counts[r.key] ?? 0), 0)

  return (
    <div className="bg-[#141414]/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl overflow-hidden shadow-[0_0_15px_rgba(78,205,230,0.05)]">
      <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">🎯</span>
          <h2 className="text-sm font-bold text-white">Action queue</h2>
        </div>
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            totalActions === 0
              ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
              : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
          }`}
        >
          {totalActions === 0 ? 'All clear' : `${totalActions} to handle`}
        </span>
      </div>

      <div className="divide-y divide-white/[0.05]">
        {rows.map((r) => {
          const count = counts[r.key] ?? 0
          const tone = TONE[r.tone]
          const muted = count === 0
          return (
            <Link
              key={r.key}
              href={muted ? '#' : r.href}
              onClick={muted ? (e) => e.preventDefault() : undefined}
              className={`flex items-center gap-3 px-5 py-3 transition-colors ${
                muted ? 'cursor-default opacity-50' : 'hover:bg-white/[0.03]'
              }`}
            >
              <span className="text-lg shrink-0" aria-hidden>{r.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{r.label}</p>
                {muted ? (
                  <p className="text-[11px] text-white/30 truncate">All clear</p>
                ) : (
                  <p className="text-[11px] text-white/40 truncate">Tap to review →</p>
                )}
              </div>
              <span className={`px-2 py-1 rounded-md text-xs font-bold tabular-nums shrink-0 ${muted ? 'text-white/30' : tone.chip}`}>
                {count}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
