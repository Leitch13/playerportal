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
  tone: 'danger' | 'warn'
}

// Static palette — Tailwind JIT-safe (no string-built class names). Severity
// is expressed by a small 6px dot + a semantic-coloured count (no filled
// badge blobs, no emoji).
const TONE: Record<RowDef['tone'], { dot: string; count: string }> = {
  danger: { dot: 'bg-[#e0736d]', count: 'text-[#e0736d]' },
  warn:   { dot: 'bg-[#d8a95a]', count: 'text-[#d8a95a]' },
}

// Row order matches the spec example: Trial → Payment → At-Risk
// → Attendance → Reviews. Stable + deterministic.
const ROWS: RowDef[] = [
  { key: 'trialFollowUps',   label: 'Trial Follow-Ups',  href: '/dashboard/enrolments#trial-followup',        tone: 'danger' },
  { key: 'paymentIssues',    label: 'Payment Issues',     href: '/dashboard/parents?filter=payment_issues',    tone: 'danger' },
  { key: 'atRiskFamilies',   label: 'At-Risk Families',   href: '/dashboard/parents?filter=needs_attention',   tone: 'warn'   },
  { key: 'attendanceRisks',  label: 'Attendance Risks',   href: '/dashboard/players?filter=attendance_risk',   tone: 'warn'   },
  { key: 'reviewsDue',       label: 'Reviews Due',        href: '/dashboard/reviews',                          tone: 'warn'   },
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
    <section className="bg-[#0f1a2b] border border-[#1d2c42] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-[#1d2c42] flex items-center justify-between">
        <h2 className="text-[10px] font-mono uppercase tracking-[0.15em] text-[#5b6c86]">Today</h2>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[#1d2c42] font-mono text-[10px] uppercase tracking-wider text-[#93a2ba]">
          {counts.total === 0 && <span aria-hidden className="h-[5px] w-[5px] shrink-0 rounded-full bg-[#67c79a]" />}
          {counts.total === 0 ? 'All clear' : `${counts.total} ${counts.total === 1 ? 'action' : 'actions'}`}
        </span>
      </div>

      {/* Body */}
      {visibleRows.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm text-[#93a2ba]">Nothing requires attention today</p>
          <p className="text-[11px] text-[#5b6c86] mt-1">
            Every cohort is empty — trial follow-ups, payment issues, at-risk families, attendance risks and reviews due
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[#1d2c42]">
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
                className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-[#142236]/40"
              >
                <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone.dot}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[#eef2f9] truncate">{r.label}</p>
                  <p className="text-[11px] text-[#5b6c86] truncate">Tap to review →</p>
                </div>
                <span className={`shrink-0 text-right font-mono text-[13px] tabular-nums ${tone.count}`}>
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
