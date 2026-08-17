// ============================================================================
// CommandCentre — Dashboard MVP (owner-first), flag-gated by DASHBOARD_MVP_ENABLED.
//
// Server component. Pure presentation over metrics computed in the dashboard
// loader (page.tsx). Leads with money + priorities + growth, in that order —
// "here's what matters and what to do next", not "here's what happened".
//
// Display-layer only: no writes, no Stripe, no schema. Reuses the existing
// DashboardActionQueue (priorities, deep-linked) and AcademyReadinessWidget
// (adaptive Activate state for not-yet-live academies). Recent Activity is
// deliberately omitted per the approved MVP scope.
// ============================================================================

import Link from 'next/link'
import AcademyReadinessWidget from '@/components/AcademyReadinessWidget'
import DashboardActionQueue from '@/components/DashboardActionQueue'
import AcademyHealthBar from '@/components/AcademyHealthBar'
import BookingShareBar from '@/components/BookingShareBar'
import { formatGBP, DASHBOARD_HEALTHBAR_ENABLED } from '@/lib/dashboard-metrics'

type ActionQueueCounts = React.ComponentProps<typeof DashboardActionQueue>['counts']
type ReadinessState = React.ComponentProps<typeof AcademyReadinessWidget>['state']

export interface WeekSession {
  id: string
  name: string
  day: string
  time: string | null
  location: string | null
  count: number
  capacity: number
}

export interface CommandCentreProps {
  firstName: string
  orgName: string | null
  recurringRevenue: number
  collectedThisMonth: number
  outstanding: number
  overdueAmount: number
  overdueCount: number
  activeSubs: number
  activePlayers: number
  totalPlayers: number
  playersNotPaying: number
  atRiskFamilies: number
  fifthCard: 'not_paying' | 'at_risk'
  trialFollowUps: number
  actionQueueCounts: ActionQueueCounts
  newLeadsThisWeek: number
  bookingUrl: string
  bookingSlug: string | null
  isLive: boolean
  readiness: ReadinessState
  weekSessions: WeekSession[]
  // Phase 2A·1A — already-computed metrics, used only when the Health Bar
  // is enabled. Optional so existing flag-OFF callers are unaffected.
  revenueTrend?: number
  attendanceRate?: number
}

// KPI cell — lives inside a single hairline-divided container (the grid
// supplies gap-px dividers). Values are always white; semantic colour is
// reserved for small delta/count spans inside `sub`.
function StatCard({
  label, value, sub, href,
}: {
  label: string
  value: string
  sub?: React.ReactNode
  href?: string
}) {
  const inner = (
    <div className="h-full bg-[#0f1a2b] p-4 transition hover:bg-[#142236]/40">
      <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-[#5b6c86]">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums text-[#eef2f9]">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-[#5b6c86]">{sub}</p>}
    </div>
  )
  return href ? <Link href={href} className="block h-full">{inner}</Link> : inner
}

export default function CommandCentre(props: CommandCentreProps) {
  const {
    firstName, orgName, recurringRevenue, collectedThisMonth, outstanding,
    overdueAmount, overdueCount, activeSubs, activePlayers, totalPlayers,
    playersNotPaying, atRiskFamilies, fifthCard, trialFollowUps,
    actionQueueCounts, newLeadsThisWeek, bookingUrl, bookingSlug, isLive,
    readiness, weekSessions, revenueTrend = 0, attendanceRate = 0,
  } = props

  const fifth = fifthCard === 'not_paying'
    ? {
      label: 'Players Not Paying',
      value: String(playersNotPaying),
      sub: `${totalPlayers} on roster · convert →`,
      href: '/dashboard/players?filter=no_sub',
    }
    : {
      label: 'At-Risk Families',
      value: String(atRiskFamilies),
      sub: 'needing attention →',
      href: '/dashboard/parents?filter=needs_attention',
    }

  const sessionsWithTimes = weekSessions.filter((s) => s.time)

  // ════════════════════════════════════════════════════════════════════════
  // Phase 2A · Phase 1A — Health Bar + 6-card Snapshot + promoted Action
  // Centre. Rendered ONLY when DASHBOARD_HEALTHBAR_ENABLED is on. The flag-OFF
  // path below is left byte-identical to today's live CommandCentre.
  // Pure composition over props already passed in — no new data.
  // ════════════════════════════════════════════════════════════════════════
  if (DASHBOARD_HEALTHBAR_ENABLED) {
    // Semantic colour lives only on the small delta span inside the sub-line.
    const collectedSub: React.ReactNode = revenueTrend !== 0
      ? (
        <>
          <span className={revenueTrend > 0 ? 'text-[#67c79a]' : 'text-[#e0736d]'}>
            {revenueTrend > 0 ? '↑' : '↓'} {Math.abs(revenueTrend)}%
          </span>
          {' '}vs last month
        </>
      )
      : 'paid so far this month'

    return (
      <div className="min-h-screen -m-6 bg-[#080e18] p-6 text-white lg:-m-8 lg:p-8">
        <div className="mx-auto max-w-5xl space-y-6">
          {/* ── Greeting ── */}
          <header className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Good morning, {firstName}</h1>
              <p className="mt-1 text-sm text-[#93a2ba]">
                Here&apos;s what matters at {orgName || 'your academy'} today.
              </p>
            </div>
            {bookingSlug && (
              <Link
                href={`/book/${bookingSlug}`}
                className="rounded-xl border border-[#293b58] bg-transparent px-4 py-2 text-sm font-medium text-[#93a2ba] transition hover:border-[#3a4f6e] hover:text-white"
              >
                View Booking Page
              </Link>
            )}
          </header>

          {/* ── SECTION 1: Academy Health Bar (Am I healthy?) ── */}
          <AcademyHealthBar
            isLive={isLive}
            stripeReadiness={readiness.stripeReadiness}
            isPilot={readiness.isPilot}
            trialDaysRemaining={readiness.trialDaysRemaining}
            doneCount={readiness.doneCount}
            totalCount={readiness.totalCount}
            overdueCount={overdueCount}
            overdueAmount={overdueAmount}
          />

          {/* Pre-live: expanded readiness checklist; Snapshot suppressed (no £0 cards). */}
          {!isLive && <AcademyReadinessWidget state={readiness} />}

          {/* ── SECTION 2: Business Snapshot — 6 cells, one hairline-divided container ── */}
          {isLive && (
            <div className="overflow-hidden rounded-2xl border border-[#1d2c42]">
              <div className="grid grid-cols-2 gap-px bg-[#1d2c42] md:grid-cols-3 lg:grid-cols-6">
                <StatCard
                  label="Recurring Revenue"
                  value={formatGBP(recurringRevenue)}
                  sub={`from ${activeSubs} active sub${activeSubs === 1 ? '' : 's'}`}
                  href="/dashboard/payments"
                />
                <StatCard
                  label="Collected This Month"
                  value={formatGBP(collectedThisMonth)}
                  sub={collectedSub}
                  href="/dashboard/payments"
                />
                <StatCard
                  label="Active Players"
                  value={String(activePlayers)}
                  sub={`of ${totalPlayers} · enrolled & paying`}
                  href="/dashboard/players"
                />
                <StatCard
                  label="Outstanding"
                  value={formatGBP(outstanding)}
                  sub={overdueCount > 0
                    ? <><span className="text-[#e0736d]">{overdueCount} overdue</span> · chase →</>
                    : 'all up to date'}
                  href="/dashboard/payments"
                />
                <StatCard
                  label="At-Risk Families"
                  value={String(atRiskFamilies)}
                  sub="needing attention →"
                  href="/dashboard/parents?filter=needs_attention"
                />
                <StatCard
                  label="Attendance"
                  value={attendanceRate > 0 ? `${attendanceRate}%` : '—'}
                  sub={attendanceRate > 0 ? 'last 30 days' : 'no sessions yet'}
                  href="/dashboard/attendance"
                />
              </div>
            </div>
          )}

          {/* ── SECTION 3: Action Centre — promoted full-width anchor ──
              Ranking: revenue risk → revenue opportunity → retention risk →
              operations. Reuses DashboardActionQueue with an order override;
              the component default (and the flag-OFF path) is unchanged. */}
          <DashboardActionQueue
            counts={actionQueueCounts}
            order={['paymentIssues', 'trialFollowUps', 'atRiskFamilies', 'attendanceRisks', 'reviewsDue']}
          />

          {/* ── This week's sessions (operations, below the fold) ── */}
          {sessionsWithTimes.length > 0 && (
            <div className="rounded-2xl border border-[#1d2c42] bg-[#0f1a2b] p-5">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-[#5b6c86]">This Week&apos;s Sessions</p>
                <Link href="/dashboard/calendar" className="text-xs font-medium text-[#4ecde6] hover:underline">Full timetable →</Link>
              </div>
              <ul className="divide-y divide-[#1d2c42]">
                {sessionsWithTimes.slice(0, 6).map((s) => (
                  <li key={s.id} className="flex items-center justify-between py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-[#eef2f9]">{s.name}</p>
                      <p className="text-[11px] text-[#5b6c86]">{s.day}{s.time ? ` · ${s.time}` : ''}{s.location ? ` · ${s.location}` : ''}</p>
                    </div>
                    <span className="shrink-0 font-mono text-[12px] tabular-nums text-[#93a2ba]">{s.count}/{s.capacity}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── Booking share + leads (below the fold; status now lives in the Health Bar) ── */}
          {bookingUrl && (
            <div className="rounded-2xl border border-[#1d2c42] bg-[#0f1a2b] p-5">
              <p className="mb-3 text-[10px] font-mono uppercase tracking-[0.15em] text-[#5b6c86]">Share Your Booking Page</p>
              <BookingShareBar bookingUrl={bookingUrl} academyName={orgName} />
              {newLeadsThisWeek > 0 && (
                <Link href="/dashboard/leads" className="mt-3 inline-block text-xs font-medium text-[#4ecde6] hover:underline">
                  {newLeadsThisWeek} new lead{newLeadsThisWeek === 1 ? '' : 's'} this week →
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen -m-6 bg-[#080e18] p-6 text-white lg:-m-8 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* ── Greeting ── */}
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Good morning, {firstName}</h1>
            <p className="mt-1 text-sm text-[#93a2ba]">
              Here&apos;s what matters at {orgName || 'your academy'} today.
            </p>
          </div>
          {bookingSlug && (
            <Link
              href={`/book/${bookingSlug}`}
              className="rounded-xl border border-[#293b58] bg-transparent px-4 py-2 text-sm font-medium text-[#93a2ba] transition hover:border-[#3a4f6e] hover:text-white"
            >
              View Booking Page
            </Link>
          )}
        </header>

        {/* ── Tier 1: top stat row — one hairline-divided container ── */}
        <div className="overflow-hidden rounded-2xl border border-[#1d2c42]">
          <div className="grid grid-cols-2 gap-px bg-[#1d2c42] md:grid-cols-3 lg:grid-cols-5">
            <StatCard
              label="Recurring Revenue"
              value={`${formatGBP(recurringRevenue)}`}
              sub={`from ${activeSubs} active subscription${activeSubs === 1 ? '' : 's'}`}
              href="/dashboard/payments"
            />
            <StatCard
              label="Collected This Month"
              value={formatGBP(collectedThisMonth)}
              sub="paid so far this month"
              href="/dashboard/payments"
            />
            <StatCard
              label="Outstanding"
              value={formatGBP(outstanding)}
              sub={overdueCount > 0
                ? <><span className="text-[#e0736d]">{overdueCount} overdue</span> · chase →</>
                : 'all up to date'}
              href="/dashboard/payments"
            />
            <StatCard
              label="Trials To Follow Up"
              value={String(trialFollowUps)}
              sub="awaiting your reply →"
              href="/dashboard/enrolments#trial-followup"
            />
            <StatCard label={fifth.label} value={fifth.value} sub={fifth.sub} href={fifth.href} />
          </div>
        </div>

        {/* Decision 1: active players = enrolled AND paying (the corrected metric). */}
        <p className="-mt-3 text-xs text-[#5b6c86]">
          <span className="font-semibold text-[#93a2ba]">{activePlayers}</span> of {totalPlayers} players active (enrolled &amp; paying)
        </p>

        {/* ── Adaptive Activate state (collapses to a summary once live) ── */}
        <AcademyReadinessWidget state={readiness} />

        {/* ── Tier 1+2: priorities · revenue · share ── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Priorities (reused) */}
          <div className="lg:col-span-1">
            <DashboardActionQueue counts={actionQueueCounts} />
          </div>

          {/* Revenue overview triad */}
          <div className="rounded-2xl border border-[#1d2c42] bg-[#0f1a2b] p-5 lg:col-span-1">
            <p className="mb-4 text-[10px] font-mono uppercase tracking-[0.15em] text-[#5b6c86]">Revenue Overview</p>
            <div className="space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-[#93a2ba]">Collected this month</span>
                <span className="text-lg font-bold tabular-nums text-[#eef2f9]">{formatGBP(collectedThisMonth)}</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-[#93a2ba]">Outstanding{overdueCount > 0 ? <span className="text-[#e0736d]">{` (${formatGBP(overdueAmount)} overdue)`}</span> : ''}</span>
                <span className="text-lg font-bold tabular-nums text-[#eef2f9]">{formatGBP(outstanding)}</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-[#93a2ba]">Recurring (forecast)</span>
                <span className="text-lg font-bold tabular-nums text-[#eef2f9]">{formatGBP(recurringRevenue)}<span className="text-xs text-[#5b6c86]">/mo</span></span>
              </div>
            </div>
            <Link href="/dashboard/payments" className="mt-4 inline-block text-xs font-medium text-[#4ecde6] hover:underline">
              View payments →
            </Link>
          </div>

          {/* Academy Live + share */}
          <div className="rounded-2xl border border-[#1d2c42] bg-[#0f1a2b] p-5 lg:col-span-1">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-[#5b6c86]">Academy Live</p>
              {isLive && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#1d2c42] px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-[#93a2ba]">
                  <span aria-hidden className="h-[5px] w-[5px] shrink-0 rounded-full bg-[#67c79a]" />
                  Live
                </span>
              )}
            </div>
            <p className="mb-3 text-sm text-[#93a2ba]">
              {isLive ? 'Your booking page is live — share it to get more players.' : 'Finish setup to take your booking page live.'}
            </p>
            {bookingUrl
              ? <BookingShareBar bookingUrl={bookingUrl} academyName={orgName} />
              : <p className="text-xs text-[#5b6c86]">Set your academy URL in Settings to share your booking page.</p>}
            {newLeadsThisWeek > 0 && (
              <Link href="/dashboard/leads" className="mt-3 inline-block text-xs font-medium text-[#4ecde6] hover:underline">
                {newLeadsThisWeek} new lead{newLeadsThisWeek === 1 ? '' : 's'} this week →
              </Link>
            )}
          </div>
        </div>

        {/* ── Tier 4: operations — this week's sessions (adaptive) ── */}
        {sessionsWithTimes.length > 0 && (
          <div className="rounded-2xl border border-[#1d2c42] bg-[#0f1a2b] p-5">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-[#5b6c86]">This Week&apos;s Sessions</p>
              <Link href="/dashboard/calendar" className="text-xs font-medium text-[#4ecde6] hover:underline">Full timetable →</Link>
            </div>
            <ul className="divide-y divide-[#1d2c42]">
              {sessionsWithTimes.slice(0, 6).map((s) => (
                <li key={s.id} className="flex items-center justify-between py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-[#eef2f9]">{s.name}</p>
                    <p className="text-[11px] text-[#5b6c86]">{s.day}{s.time ? ` · ${s.time}` : ''}{s.location ? ` · ${s.location}` : ''}</p>
                  </div>
                  <span className="shrink-0 font-mono text-[12px] tabular-nums text-[#93a2ba]">{s.count}/{s.capacity}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
