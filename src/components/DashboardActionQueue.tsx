/**
 * Dashboard Action Queue — Phase 2.9.
 *
 * Server component. Pure presentation given pre-computed counts. The
 * loader (`dashboard-action-queue-loader.ts`) does the I/O; this
 * component does not call any derive function or query.
 *
 * RULES (Phase 1 crash post-mortem)
 *
 *   • Server component only — never `'use client'`
 *   • <Link> receives string `href` only; never `onClick={fn}` (that
 *     pattern caused the original Phase 1 crash by passing a function
 *     prop from a server to client component)
 *   • CSS-only muted state — `pointer-events-none` + opacity, no JS
 *   • No props with functions, Maps, Dates, or other non-serializable
 *     values
 *
 * BEHAVIOUR
 *
 *   • Hides zero-count rows (per user-confirmed Phase 2.9 spec)
 *   • Renders "Nothing requires attention today" when total === 0
 *   • Each row is a single <Link> with count + reason + destination
 *
 * NO graphs. NO charts. NO revenue widgets. NO forecasting. NO actions.
 */
import Link from 'next/link'
import type { ActionQueueCounts } from '@/lib/dashboard-action-queue-loader'

interface RowDef {
  key: keyof ActionQueueCounts
  label: string
  href: string
  emoji: string
  tone: 'rose' | 'amber' | 'yellow'
}

// Static palette — Tailwind JIT-safe (no string-built class names).
const TONE: Record<RowDef['tone'], { dot: string; chip: string; bar: string }> = {
  rose:   { dot: 'bg-rose-500',   chip: 'bg-rose-500/15  text-rose-300  border border-rose-500/30',  bar: 'before:bg-rose-500/60' },
  amber:  { dot: 'bg-amber-500',  chip: 'bg-amber-500/15 text-amber-300 border border-amber-500/30', bar: 'before:bg-amber-500/60' },
  yellow: { dot: 'bg-yellow-500', chip: 'bg-yellow-500/15 text-yellow-300 border border-yellow-500/30', bar: 'before:bg-yellow-500/60' },
}

// Row order matches the spec example: 🔴 Trial → 🔴 Payment → 🟠 At-Risk
// → 🟠 Attendance → 🟡 Reviews. Stable + deterministic.
const ROWS: RowDef[] = [
  { key: 'trialFollowUps',   label: 'Trial Follow-Ups',  href: '/dashboard/enrolments#trial-followup',        emoji: '🔴', tone: 'rose'   },
  { key: 'paymentIssues',    label: 'Payment Issues',     href: '/dashboard/parents?filter=payment_issues',    emoji: '🔴', tone: 'rose'   },
  { key: 'atRiskFamilies',   label: 'At-Risk Families',   href: '/dashboard/parents?filter=needs_attention',   emoji: '🟠', tone: 'amber'  },
  { key: 'attendanceRisks',  label: 'Attendance Risks',   href: '/dashboard/players?filter=attendance_risk',   emoji: '🟠', tone: 'amber'  },
  { key: 'reviewsDue',       label: 'Reviews Due',        href: '/dashboard/reviews',                          emoji: '🟡', tone: 'yellow' },
]

export default function DashboardActionQueue({
  counts,
  order,
}: {
  counts: ActionQueueCounts
  // Optional ranking override (Phase 2A·1A). When omitted the default
  // ROWS order is used — so existing callers render byte-identically.
  order?: Array<keyof ActionQueueCounts>
}) {
  // Apply an optional ranking, then filter out zero-count rows per spec.
  const orderedRows = order
    ? order
      .map(k => ROWS.find(r => r.key === k))
      .filter((r): r is RowDef => !!r)
    : ROWS
  const visibleRows = orderedRows.filter(r => (counts[r.key] ?? 0) > 0)

  return (
    <section className="bg-[#141414]/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl overflow-hidden shadow-[0_0_15px_rgba(78,205,230,0.05)]">
      {/* Header */}
      <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base" aria-hidden>🎯</span>
          <h2 className="text-sm font-bold text-white">Today</h2>
        </div>
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            counts.total === 0
              ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
              : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
          }`}
        >
          {counts.total === 0 ? 'All clear' : `${counts.total} ${counts.total === 1 ? 'action' : 'actions'}`}
        </span>
      </div>

      {/* Body */}
      {visibleRows.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm text-white/60">Nothing requires attention today</p>
          <p className="text-[11px] text-white/30 mt-1">
            Every cohort is empty — trial follow-ups, payment issues, at-risk families, attendance risks and reviews due
          </p>
        </div>
      ) : (
        <div className="divide-y divide-white/[0.05]">
          {visibleRows.map(r => {
            const count = counts[r.key]
            const tone = TONE[r.tone]
            return (
              <Link
                key={r.key}
                href={r.href}
                // String href only. NEVER pass onClick or function props
                // to <Link> from a server component (Phase 1 crash root
                // cause — see post-mortem in commit 9efc83d).
                className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-white/[0.03]"
              >
                <span className="text-lg shrink-0" aria-hidden>{r.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{r.label}</p>
                  <p className="text-[11px] text-white/40 truncate">Tap to review →</p>
                </div>
                <span className={`px-2 py-1 rounded-md text-xs font-bold tabular-nums shrink-0 ${tone.chip}`}>
                  {count}
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </section>
  )
}
