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
//
// First-run: `ghosted` renders a zero value muted (not a bold white
// failure) and promotes the sub-line to guidance copy. Defaults to false,
// so every existing call site renders byte-identically.
function StatCard({
  label, value, sub, href, ghosted = false,
}: {
  label: string
  value: string
  sub?: React.ReactNode
  href?: string
  ghosted?: boolean
}) {
  const inner = (
    <div className="h-full bg-[#0f1a2b] p-4 transition hover:bg-[#142236]/40">
      <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-[#5b6c86]">{label}</p>
      {ghosted ? (
        <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums text-[#5b6c86]">{value}</p>
      ) : (
        <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums text-[#eef2f9]">{value}</p>
      )}
      {sub && (ghosted
        ? <p className="mt-1 text-[11px] leading-relaxed text-[#93a2ba]">{sub}</p>
        : <p className="mt-0.5 text-[11px] text-[#5b6c86]">{sub}</p>)}
    </div>
  )
  return href ? <Link href={href} className="block h-full">{inner}</Link> : inner
}

// ════════════════════════════════════════════════════════════════════════
// First-run setup journey — renders INSTEAD of the action queue while the
// academy has zero classes OR zero players (dead-£0 state). Disappears
// entirely once both exist, at which point the dashboard is byte-identical
// to today. Pure presentation over props already computed in page.tsx:
// no new queries, no writes.
//   Step 2 done  = readiness.stripeReadiness === 'ready_to_take_payments'
//   Step 3 done  = weekSessions.length > 0   (all training_groups rows)
//   Step 4 done  = totalPlayers > 0          (a signup proves sharing worked)
// Exactly ONE cyan primary — the current (first incomplete) step. Later
// incomplete steps render a ghost "After step N" non-link.
// ════════════════════════════════════════════════════════════════════════
function FirstRunJourney({
  stripeReady, hasClasses, hasAnyPlayers, bookingUrl,
}: {
  stripeReady: boolean
  hasClasses: boolean
  hasAnyPlayers: boolean
  bookingUrl: string
}) {
  const steps: Array<{
    title: string
    desc: string
    done: boolean
    cta: { label: string; href: string } | null
  }> = [
    {
      title: 'Create your account',
      desc: 'Done — welcome aboard',
      done: true,
      cta: null,
    },
    {
      title: 'Connect Stripe so parents can pay you',
      desc: stripeReady
        ? 'Done — payouts go straight to your bank'
        : 'Payouts go straight to your bank — no invoices to chase.',
      done: stripeReady,
      cta: { label: 'Connect Stripe', href: '/dashboard/settings?tab=billing' },
    },
    {
      title: 'Create your first class',
      desc: 'Name, day, time, price — 2 minutes. Everything else hangs off this.',
      done: hasClasses,
      cta: { label: 'Create a class', href: '/dashboard/groups' },
    },
    {
      title: 'Share your booking page',
      desc: 'Parents book & pay themselves — no forms, no chasing.',
      done: hasAnyPlayers,
      // Anchor-scrolls to the existing share bar panel below (or Settings
      // when no booking slug exists yet, since the share panel is hidden).
      cta: { label: 'Share your page', href: bookingUrl ? '#share-booking-page' : '/dashboard/settings' },
    },
  ]

  const doneCount = steps.filter((s) => s.done).length
  const currentIdx = steps.findIndex((s) => !s.done)
  const pct = Math.round((doneCount / steps.length) * 100)

  return (
    <div className="overflow-hidden rounded-2xl border border-[#1d2c42] bg-[#0f1a2b]">
      {/* Header — title + progress */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1d2c42] px-4 py-3.5 sm:px-5">
        <p className="text-sm font-semibold text-[#eef2f9]">Get set up — about 10 minutes</p>
        <span className="flex items-center gap-2.5">
          <span className="h-1 w-[120px] overflow-hidden rounded-full bg-[#1d2c42]">
            <span className="block h-full rounded-full bg-[#4ecde6]" style={{ width: `${pct}%` }} />
          </span>
          <span className="font-mono text-[10px] tabular-nums text-[#5b6c86]">{doneCount}/{steps.length}</span>
        </span>
      </div>

      {steps.map((step, i) => {
        const isCurrent = i === currentIdx
        const isFutureTodo = !step.done && !isCurrent
        return (
          <div
            key={step.title}
            className={`grid grid-cols-[26px_1fr_auto] items-center gap-3 px-4 py-3 sm:px-5 ${i > 0 ? 'border-t border-[#1d2c42]' : ''}`}
          >
            {/* Status circle */}
            {step.done ? (
              <span aria-hidden className="grid h-[22px] w-[22px] place-items-center rounded-full bg-[#67c79a]/15 font-mono text-[10px] text-[#67c79a]"></span>
            ) : isCurrent ? (
              <span aria-hidden className="grid h-[22px] w-[22px] place-items-center rounded-full bg-[#4ecde6]/15 font-mono text-[10px] text-[#4ecde6] shadow-[0_0_0_4px_rgba(78,205,230,0.06)]">{i + 1}</span>
            ) : (
              <span aria-hidden className="grid h-[22px] w-[22px] place-items-center rounded-full border border-[#293b58] font-mono text-[10px] text-[#5b6c86]">{i + 1}</span>
            )}

            {/* Title + description */}
            <div className="min-w-0">
              <p className={step.done
                ? 'text-[13px] font-semibold text-[#93a2ba] line-through decoration-[#93a2ba]/40'
                : 'text-[13px] font-semibold text-[#eef2f9]'}
              >
                {step.title}
              </p>
              <p className="mt-px text-[11px] text-[#5b6c86]">{step.desc}</p>
            </div>

            {/* Right-hand action — one cyan primary per moment (the current step) */}
            {step.done ? (
              <span className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-[#67c79a]">Done</span>
            ) : isCurrent && step.cta ? (
              step.cta.href.startsWith('#') ? (
                <a
                  href={step.cta.href}
                  className="shrink-0 rounded-[9px] bg-[#4ecde6] px-3.5 py-1.5 text-[11.5px] font-bold text-[#04141a] transition hover:opacity-90"
                >
                  {step.cta.label}
                </a>
              ) : (
                <Link
                  href={step.cta.href}
                  className="shrink-0 rounded-[9px] bg-[#4ecde6] px-3.5 py-1.5 text-[11.5px] font-bold text-[#04141a] transition hover:opacity-90"
                >
                  {step.cta.label}
                </Link>
              )
            ) : isFutureTodo ? (
              <span className="shrink-0 rounded-[9px] border border-[#293b58] px-3.5 py-1.5 text-[11.5px] font-semibold text-[#93a2ba]">
                After step {currentIdx + 1}
              </span>
            ) : null}
          </div>
        )
      })}
    </div>
  )
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

  // ── First-run derivations — all from props already computed in page.tsx ──
  // weekSessions is built from EVERY training_groups row for the org (not
  // just timed ones), so its length is the academy's class count.
  // totalPlayers (any player row) rather than activePlayers (enrolled AND
  // paying) gates the journey, so an established academy whose subs lapse
  // can never regress into the setup card.
  const hasClasses = weekSessions.length > 0
  const hasAnyPlayers = totalPlayers > 0
  const isFirstRun = !hasClasses || !hasAnyPlayers
  const stripeReady = readiness.stripeReadiness === 'ready_to_take_payments'

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

    // ── Oct 2026 — the calm dashboard. Same numbers, fewer of them, and no
    // alarm counts. The old "Today · 117 actions" queue listed every family as
    // at risk and every child as an attendance risk; an owner learned to
    // ignore it. Now: what the academy earns, the two things that are real
    // problems (a failed payment, a trial nobody followed up), this week's
    // classes, and the booking link. The softer counts (reviews due, not been
    // in a while) are one quiet line of links, not a list of warnings. ──
    const allClear = isLive && stripeReady && overdueCount === 0
      && (readiness.isPilot || readiness.trialDaysRemaining == null || readiness.trialDaysRemaining > 7)
    const todo: Array<{ key: string; text: string; href: string; cta: string }> = []
    if (actionQueueCounts.paymentIssues > 0) todo.push({
      key: 'pay',
      text: `${actionQueueCounts.paymentIssues} ${actionQueueCounts.paymentIssues === 1 ? 'family has' : 'families have'} a payment problem`,
      href: '/dashboard/parents?filter=payment_issues', cta: 'See who',
    })
    if (overdueCount > 0) todo.push({
      key: 'overdue',
      text: `${overdueCount} overdue ${overdueCount === 1 ? 'payment' : 'payments'}, ${formatGBP(overdueAmount)} to collect`,
      href: '/dashboard/payments?tab=overview&filter=overdue', cta: 'Chase',
    })
    if (trialFollowUps > 0) todo.push({
      key: 'trial',
      text: `${trialFollowUps} ${trialFollowUps === 1 ? 'trial is' : 'trials are'} waiting on a follow-up`,
      href: '/dashboard/enrolments#trial-followup', cta: 'Follow up',
    })
    if (newLeadsThisWeek > 0) todo.push({
      key: 'leads',
      text: `${newLeadsThisWeek} new ${newLeadsThisWeek === 1 ? 'enquiry' : 'enquiries'} this week`,
      href: '/dashboard/leads', cta: 'Open',
    })
    const softer: Array<{ text: string; href: string }> = []
    if (actionQueueCounts.reviewsDue > 0) softer.push({ text: `${actionQueueCounts.reviewsDue} player reports due`, href: '/dashboard/reviews' })
    if (actionQueueCounts.attendanceRisks > 0) softer.push({ text: `${actionQueueCounts.attendanceRisks} not been in a while`, href: '/dashboard/players?filter=attendance_risk' })
    const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    const week = [...sessionsWithTimes].sort((x, y) => (DAYS.indexOf(x.day) + 1 || 9) - (DAYS.indexOf(y.day) + 1 || 9) || (x.time || '').localeCompare(y.time || ''))
    const figure = (label: string, value: string, sub: React.ReactNode, href: string, muted = false) => (
      <Link href={href} className="block rounded-[13px] px-4 py-3.5 transition-colors hover:bg-[#142236]">
        <p className="text-xs text-[#93a2ba]">{label}</p>
        <p className={`mt-1 text-[26px] font-semibold leading-none tracking-tight tabular-nums ${muted ? 'text-[#5b6c86]' : 'text-[#eef2f9]'}`}>{value}</p>
        <p className="mt-1.5 text-xs text-[#5b6c86]">{sub}</p>
      </Link>
    )

    return (
      <div className="min-h-screen -m-6 bg-[#080e18] p-6 text-white lg:-m-8 lg:p-8">
        <div className="mx-auto max-w-5xl space-y-5" data-testid="calm-dashboard">
          {/* ── Greeting ── */}
          <header className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">Hello, {firstName}</h1>
              <p className="mt-1 text-sm text-[#93a2ba]">{orgName || 'Your academy'}</p>
            </div>
            {bookingSlug && (
              <Link
                href={`/book/${bookingSlug}`}
                className="rounded-[10px] border border-[#293b58] px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:border-[#4ecde6]"
              >
                View booking page
              </Link>
            )}
          </header>

          {/* Status chips only when something about the account needs saying. */}
          {!allClear && (
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
          )}

          {/* Pre-live: expanded readiness checklist; the money row waits until live. */}
          {!isLive && <AcademyReadinessWidget state={readiness} />}

          {/* ── The money, in four numbers ── */}
          {isLive && (
            <section aria-label="This month" className="grid grid-cols-2 gap-1 rounded-[15px] border border-[#1d2c42] bg-[#0f1a2b] p-1.5 lg:grid-cols-4" data-testid="dash-figures">
              {figure('Coming in each month', formatGBP(recurringRevenue),
                activeSubs === 0 ? 'Starts when your first member joins' : `from ${activeSubs} ${activeSubs === 1 ? 'membership' : 'memberships'}`,
                '/dashboard/payments', activeSubs === 0 && recurringRevenue === 0)}
              {figure('Taken this month', formatGBP(collectedThisMonth), collectedSub, '/dashboard/payments', activeSubs === 0 && collectedThisMonth === 0)}
              {figure('Paying players', String(activePlayers),
                activePlayers === 0 ? 'Invite your contacts to enrol' : `of ${totalPlayers} on your books`,
                activePlayers === 0 ? '/dashboard/contacts' : '/dashboard/players', activePlayers === 0)}
              {figure('Still to collect', formatGBP(outstanding),
                overdueCount > 0 ? <span className="text-[#d8a95a]">{overdueCount} overdue</span> : 'Everyone is up to date',
                '/dashboard/payments', outstanding === 0)}
            </section>
          )}

          {/* ── Needs you: real problems only. First-run shows the setup journey instead. ── */}
          {isLive && isFirstRun ? (
            <FirstRunJourney
              stripeReady={stripeReady}
              hasClasses={hasClasses}
              hasAnyPlayers={hasAnyPlayers}
              bookingUrl={bookingUrl}
            />
          ) : (
            <section aria-label="Needs you" className="rounded-[15px] border border-[#1d2c42] bg-[#0f1a2b] px-4 py-4 sm:px-5" data-testid="dash-todo">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.07em] text-[#5b6c86]">Needs you{todo.length > 0 ? ` · ${todo.length}` : ''}</h2>
              {todo.length === 0 ? (
                <p className="mt-2 text-sm text-[#93a2ba]">Nothing right now. No payment problems and no trials waiting.</p>
              ) : (
                <ul className="mt-1.5 divide-y divide-[#1d2c42]">
                  {todo.map((t) => (
                    <li key={t.key} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 py-2.5">
                      <p className="flex min-w-0 items-center gap-2.5 text-sm text-[#eef2f9]">
                        <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-[#d8a95a]" />
                        {t.text}
                      </p>
                      <Link href={t.href} className="shrink-0 rounded-[9px] border border-[#293b58] px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:border-[#4ecde6]">{t.cta}</Link>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-[#1d2c42] pt-3 text-xs text-[#5b6c86]">
                <Link href="/dashboard/enrolments?view=notpaying" className="hover:text-white">In a class, not paying</Link>
                <Link href="/dashboard/parents?filter=look" className="hover:text-white">Families that need a look</Link>
                {softer.map((x) => <Link key={x.href} href={x.href} className="hover:text-white">{x.text}</Link>)}
              </p>
            </section>
          )}

          {/* ── First-run: no classes yet — a dashed invitation, not a blank. ── */}
          {isLive && !hasClasses && (
            <div className="rounded-[15px] border border-[#1d2c42] bg-[#0f1a2b] p-5">
              <div className="rounded-xl border border-dashed border-[#293b58] px-5 py-6 text-center">
                <p className="text-[13.5px] font-semibold text-[#eef2f9]">No classes yet</p>
                <p className="mx-auto mt-1 max-w-[40ch] text-[11.5px] text-[#5b6c86]">
                  Create your first class and your weekly timetable builds itself — capacity, registers, the lot.
                </p>
                <Link
                  href="/dashboard/groups"
                  className="mt-3 inline-block rounded-[9px] border border-[#293b58] px-3.5 py-1.5 text-[11.5px] font-semibold text-[#93a2ba] transition hover:border-[#3a4f6e] hover:text-white"
                >
                  Create your first class
                </Link>
              </div>
            </div>
          )}

          {/* ── This week's classes ── */}
          {week.length > 0 && (
            <section aria-label="This week" className="rounded-[15px] border border-[#1d2c42] bg-[#0f1a2b]" data-testid="dash-week">
              <div className="flex items-center justify-between px-4 pb-1 pt-4 sm:px-5">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.07em] text-[#5b6c86]">This week · {week.length} {week.length === 1 ? 'class' : 'classes'}</h2>
                <Link href="/dashboard/calendar" className="text-xs font-semibold text-[#4ecde6] hover:text-white">Timetable</Link>
              </div>
              <ul className="divide-y divide-[#1d2c42] px-4 sm:px-5">
                {week.slice(0, 8).map((s) => {
                  const pct = s.capacity > 0 ? Math.min(100, Math.round((s.count / s.capacity) * 100)) : 0
                  return (
                    <li key={s.id} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 py-3 sm:grid-cols-[190px_1fr_120px_auto]">
                      <p className="whitespace-nowrap text-[13px] text-[#93a2ba] sm:order-1"><span className="font-semibold text-[#eef2f9]">{s.day}</span>{s.time ? <span className="ml-2 tabular-nums">{s.time}</span> : null}</p>
                      <p className="col-span-2 min-w-0 truncate text-sm font-medium text-[#eef2f9] sm:order-2 sm:col-span-1">{s.name}{s.location ? <span className="font-normal text-[#5b6c86]"> · {s.location}</span> : null}</p>
                      <div className="hidden h-[5px] overflow-hidden rounded-full bg-[#1d2c42] sm:order-3 sm:block" aria-hidden><div className="h-full rounded-full bg-[#4ecde6]" style={{ width: `${pct}%` }} /></div>
                      <p className="col-start-2 row-start-1 whitespace-nowrap text-right text-[13px] tabular-nums text-[#93a2ba] sm:order-4 sm:col-start-auto sm:row-start-auto"><span className="font-semibold text-[#eef2f9]">{s.count}</span> of {s.capacity}</p>
                    </li>
                  )
                })}
              </ul>
              {week.length > 8 && <p className="px-5 pb-4 pt-2 text-xs text-[#5b6c86]">+{week.length - 8} more on the <Link href="/dashboard/calendar" className="text-[#4ecde6]">timetable</Link></p>}
            </section>
          )}

          {/* ── Booking link ── */}
          {bookingUrl && (
            <section id="share-booking-page" className="scroll-mt-24 rounded-[15px] border border-[#1d2c42] bg-[#0f1a2b] p-4 sm:p-5">
              <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.07em] text-[#5b6c86]">Your booking link</h2>
              <BookingShareBar bookingUrl={bookingUrl} academyName={orgName} />
              {!hasAnyPlayers && (
                <p className="mt-3 text-[11px] leading-relaxed text-[#5b6c86]">
                  This link is your shop window — parents pick a class, pay, and appear in your dashboard automatically.
                </p>
              )}
            </section>
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
