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
import BookingShareBar from '@/components/BookingShareBar'
import { formatGBP } from '@/lib/dashboard-metrics'

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
}

function StatCard({
  label, value, sub, href, tone = 'neutral',
}: {
  label: string
  value: string
  sub?: string
  href?: string
  tone?: 'neutral' | 'good' | 'warn' | 'bad'
}) {
  const valueColor =
    tone === 'good' ? 'text-emerald-400'
      : tone === 'warn' ? 'text-amber-400'
        : tone === 'bad' ? 'text-red-400'
          : 'text-white'
  const inner = (
    <div className="h-full rounded-2xl border border-white/10 bg-[#141414] p-4 transition hover:border-white/20">
      <p className="text-[11px] font-medium uppercase tracking-wider text-white/40">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${valueColor}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-white/40">{sub}</p>}
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
    readiness, weekSessions,
  } = props

  const fifth = fifthCard === 'not_paying'
    ? {
      label: 'Players Not Paying',
      value: String(playersNotPaying),
      sub: `${totalPlayers} on roster · convert →`,
      href: '/dashboard/players?filter=no_sub',
      tone: (playersNotPaying > 0 ? 'warn' : 'neutral') as 'warn' | 'neutral',
    }
    : {
      label: 'At-Risk Families',
      value: String(atRiskFamilies),
      sub: 'needing attention →',
      href: '/dashboard/parents?filter=needs_attention',
      tone: (atRiskFamilies > 0 ? 'warn' : 'neutral') as 'warn' | 'neutral',
    }

  const sessionsWithTimes = weekSessions.filter((s) => s.time)

  return (
    <div className="min-h-screen -m-6 bg-[#0a0a0a] p-6 text-white lg:-m-8 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* ── Greeting ── */}
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">Good morning, {firstName} 👋</h1>
            <p className="mt-1 text-sm text-white/50">
              Here&apos;s what matters at {orgName || 'your academy'} today.
            </p>
          </div>
          {bookingSlug && (
            <Link
              href={`/book/${bookingSlug}`}
              className="rounded-xl border border-[#4ecde6]/30 bg-[#4ecde6]/10 px-4 py-2 text-sm font-semibold text-[#4ecde6] transition hover:bg-[#4ecde6]/20"
            >
              View Booking Page
            </Link>
          )}
        </header>

        {/* ── Tier 1: top stat row ── */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          <StatCard
            label="Recurring Revenue"
            value={`${formatGBP(recurringRevenue)}`}
            sub={`from ${activeSubs} active subscription${activeSubs === 1 ? '' : 's'}`}
            href="/dashboard/payments"
            tone="neutral"
          />
          <StatCard
            label="Collected This Month"
            value={formatGBP(collectedThisMonth)}
            sub="paid so far this month"
            href="/dashboard/payments"
            tone={collectedThisMonth > 0 ? 'good' : 'neutral'}
          />
          <StatCard
            label="Outstanding"
            value={formatGBP(outstanding)}
            sub={overdueCount > 0 ? `${overdueCount} overdue · chase →` : 'all up to date'}
            href="/dashboard/payments"
            tone={overdueCount > 0 ? 'bad' : 'neutral'}
          />
          <StatCard
            label="Trials To Follow Up"
            value={String(trialFollowUps)}
            sub="awaiting your reply →"
            href="/dashboard/enrolments#trial-followup"
            tone={trialFollowUps > 0 ? 'warn' : 'neutral'}
          />
          <StatCard label={fifth.label} value={fifth.value} sub={fifth.sub} href={fifth.href} tone={fifth.tone} />
        </div>

        {/* Decision 1: active players = enrolled AND paying (the corrected metric). */}
        <p className="-mt-3 text-xs text-white/40">
          <span className="font-semibold text-white/70">{activePlayers}</span> of {totalPlayers} players active (enrolled &amp; paying)
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
          <div className="rounded-2xl border border-white/10 bg-[#141414] p-5 lg:col-span-1">
            <p className="mb-4 text-xs font-medium uppercase tracking-wider text-white/40">Revenue Overview</p>
            <div className="space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-white/60">Collected this month</span>
                <span className="text-lg font-bold text-emerald-400">{formatGBP(collectedThisMonth)}</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-white/60">Outstanding{overdueCount > 0 ? ` (${formatGBP(overdueAmount)} overdue)` : ''}</span>
                <span className={`text-lg font-bold ${outstanding > 0 ? 'text-red-400' : 'text-white'}`}>{formatGBP(outstanding)}</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-white/60">Recurring (forecast)</span>
                <span className="text-lg font-bold text-[#4ecde6]">{formatGBP(recurringRevenue)}<span className="text-xs text-white/40">/mo</span></span>
              </div>
            </div>
            <Link href="/dashboard/payments" className="mt-4 inline-block text-xs font-medium text-[#4ecde6] hover:underline">
              View payments →
            </Link>
          </div>

          {/* Academy Live + share */}
          <div className="rounded-2xl border border-white/10 bg-[#141414] p-5 lg:col-span-1">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wider text-white/40">Academy Live</p>
              {isLive && (
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">Live</span>
              )}
            </div>
            <p className="mb-3 text-sm text-white/60">
              {isLive ? 'Your booking page is live — share it to get more players.' : 'Finish setup to take your booking page live.'}
            </p>
            {bookingUrl
              ? <BookingShareBar bookingUrl={bookingUrl} academyName={orgName} />
              : <p className="text-xs text-white/40">Set your academy URL in Settings to share your booking page.</p>}
            {newLeadsThisWeek > 0 && (
              <Link href="/dashboard/leads" className="mt-3 inline-block text-xs font-medium text-[#4ecde6] hover:underline">
                {newLeadsThisWeek} new lead{newLeadsThisWeek === 1 ? '' : 's'} this week →
              </Link>
            )}
          </div>
        </div>

        {/* ── Tier 4: operations — this week's sessions (adaptive) ── */}
        {sessionsWithTimes.length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-[#141414] p-5">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wider text-white/40">This Week&apos;s Sessions</p>
              <Link href="/dashboard/calendar" className="text-xs font-medium text-[#4ecde6] hover:underline">Full timetable →</Link>
            </div>
            <ul className="divide-y divide-white/5">
              {sessionsWithTimes.slice(0, 6).map((s) => (
                <li key={s.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-white">{s.name}</p>
                    <p className="text-xs text-white/40">{s.day}{s.time ? ` · ${s.time}` : ''}{s.location ? ` · ${s.location}` : ''}</p>
                  </div>
                  <span className="shrink-0 text-xs text-white/50">{s.count}/{s.capacity}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
