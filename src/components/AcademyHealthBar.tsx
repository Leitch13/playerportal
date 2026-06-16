// ============================================================================
// AcademyHealthBar — Phase 2A · Phase 1A.
//
// Slim, always-top "is my academy healthy?" strip for the owner dashboard.
// Server component, pure presentation. Composes signals ALREADY available to
// CommandCentre (readiness state + grace-aware overdue) into one glance —
// Live · Stripe · Plan · Readiness% · critical-alert count.
//
// Display-layer only: no writes, no Stripe calls, no new queries, no schema.
// Rendered solely behind DASHBOARD_HEALTHBAR_ENABLED. Any signal that isn't
// confidently available (e.g. platform plan status) is omitted gracefully
// rather than invented.
// ============================================================================

import { formatGBP } from '@/lib/dashboard-metrics'
import type { StripeReadiness } from '@/lib/academy-readiness'

export interface AcademyHealthBarProps {
  isLive: boolean
  stripeReadiness: StripeReadiness
  isPilot: boolean
  trialDaysRemaining: number | null
  doneCount: number
  totalCount: number
  overdueCount: number
  overdueAmount: number
}

type Tone = 'good' | 'warn' | 'bad' | 'neutral'

const TONE: Record<Tone, string> = {
  good: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  warn: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  bad: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
  neutral: 'border-white/10 bg-white/[0.04] text-white/70',
}

function Chip({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${TONE[tone]}`}>
      {children}
    </span>
  )
}

export default function AcademyHealthBar({
  isLive,
  stripeReadiness,
  isPilot,
  trialDaysRemaining,
  doneCount,
  totalCount,
  overdueCount,
  overdueAmount,
}: AcademyHealthBarProps) {
  const readinessPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 100

  // ── Critical-alert count: each red/amber operational condition counts once.
  const stripeNotReady =
    stripeReadiness === 'not_connected' || stripeReadiness === 'verification_pending'
  const alertCount =
    (overdueCount > 0 ? 1 : 0) +
    (!isLive ? 1 : 0) +
    (stripeNotReady && !isPilot ? 1 : 0)

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-[#141414] px-4 py-2.5">
      {/* Live status */}
      <Chip tone={isLive ? 'good' : 'warn'}>
        <span aria-hidden>{isLive ? '●' : '◐'}</span>
        {isLive ? 'Live' : 'Not live yet'}
      </Chip>

      {/* Stripe status — omit on 'unknown' (degraded check) rather than mislead */}
      {stripeReadiness === 'ready_to_take_payments' && <Chip tone="good">Stripe Ready</Chip>}
      {stripeReadiness === 'verification_pending' && <Chip tone="warn">Stripe Verifying</Chip>}
      {stripeReadiness === 'not_connected' && <Chip tone="bad">Stripe Not connected</Chip>}

      {/* Plan — only what we can state confidently. Pilots bypass plan gating. */}
      {trialDaysRemaining != null ? (
        <Chip tone={trialDaysRemaining <= 3 ? 'warn' : 'neutral'}>
          Trial · {trialDaysRemaining} day{trialDaysRemaining === 1 ? '' : 's'} left
        </Chip>
      ) : (!isPilot && isLive ? (
        <Chip tone="neutral">Plan Active</Chip>
      ) : null)}

      {/* Readiness % — only while setup is incomplete */}
      {readinessPct < 100 && <Chip tone="warn">Setup {readinessPct}%</Chip>}

      {/* Critical alerts — pushed to the right */}
      <div className="ml-auto">
        {alertCount > 0 ? (
          <Chip tone="bad">
            <span aria-hidden>⚠</span>
            {alertCount} alert{alertCount === 1 ? '' : 's'}
            {overdueCount > 0 ? ` · ${formatGBP(overdueAmount)} overdue` : ''}
          </Chip>
        ) : (
          <Chip tone="good">All systems go</Chip>
        )}
      </div>
    </div>
  )
}
