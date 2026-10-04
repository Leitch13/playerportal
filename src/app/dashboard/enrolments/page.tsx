import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import EmptyState from '@/components/EmptyState'
import EnrolmentForm from './EnrolmentForm'
import EnrolmentStatusToggle from './EnrolmentStatusToggle'
import PendingEnrolmentActions from './PendingEnrolmentActions'
import TrialEnrolmentActions from './TrialEnrolmentActions'
import TrialFollowUpSection from './TrialFollowUpSection'
// Phase 2.4: trial follow-up loader. Pulls both trial_bookings + enrolments.is_trial
// and returns the unified `needsFollowUp` cohort. Read-only — no mutations.
import { loadTrialFollowUpRows } from '@/lib/trial-followups-loader'
// Enrolments Revenue Ops Phase 1A — read-only "Daily Actions" band. Flag-gated;
// OFF ⇒ no extra reads, byte-identical page.
import {
  ENROLMENTS_REVOPS_ENABLED,
  trialsEndingSoon,
  conversionSummary,
  buildAttendanceConcerns,
  type ActionTrial,
  type AttendanceConcern,
  type ConversionSummary,
} from '@/lib/enrolments-revops'
import { loadTrialConversionData } from '@/lib/trial-conversion-loader'
import { loadPaymentStatusByPlayer, type PaymentVerdict } from '@/lib/enrolment-payment-status'
import EnrolmentsActionBand from '@/components/enrolments/EnrolmentsActionBand'
// The same Request payment button the player page has, in its compact form.
import RequestPaymentButton from '../players/[id]/RequestPaymentButton'

type EnrolmentRow = {
  id: string
  status: string
  enrolled_at: string
  player_id: string
  group_id: string
  is_trial?: boolean | null
  trial_expires_at?: string | null
  activates_on?: string | null
  player: { first_name: string; last_name: string; age_group?: string } | null
  group: { name: string; day_of_week?: string; time_slot?: string } | null
}

export default async function EnrolmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>
}) {
  // Oct 2026 — the calm page. ?view=notpaying narrows "Active by class" to the
  // children in a class with no live membership. Display only.
  const onlyNotPaying = (await searchParams).view === 'notpaying'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')

  // CRITICAL: scope all queries to the admin's own org. RLS alone is not
  // enough — super-admins bypass it. Without the explicit filter the page
  // surfaces every academy's enrolments / players / groups.
  const { data: orgId } = await supabase.rpc('get_my_org')
  if (!orgId) redirect('/dashboard')

  // Phase 2.4: trial follow-up cohort loaded in parallel with the existing
  // enrolments/players/groups pulls. Failure is swallowed inside the loader
  // (returns []) so a Postgrest hiccup never blocks the rest of the page.
  const [
    { data: enrolments },
    { data: players },
    { data: groups },
    trialFollowUps,
  ] = await Promise.all([
    supabase
      .from('enrolments')
      .select(`
        id, status, enrolled_at, player_id, group_id,
        is_trial, trial_expires_at, activates_on,
        player:players(first_name, last_name, age_group),
        group:training_groups(name, day_of_week, time_slot)
      `)
      .eq('organisation_id', orgId)
      .order('enrolled_at', { ascending: false }),
    supabase
      .from('players_active')
      // players_active (migration 109): an archived child must not be
      // offered as assignable to a class.
      .select('id, first_name, last_name')
      .eq('organisation_id', orgId)
      .order('first_name'),
    supabase
      .from('training_groups')
      .select('id, name, day_of_week, time_slot, max_capacity')
      .eq('organisation_id', orgId)
      .order('name'),
    loadTrialFollowUpRows(supabase, orgId).catch(() => []),
  ])

  const rows = (enrolments || []) as unknown as EnrolmentRow[]
  // Trials are a CROSS-CUTTING marker (is_trial=true), separate from status.
  // Surface them as their own section so the academy can convert/end them
  // before they auto-expire. A trial enrolment can be active (mid-trial) or
  // pending (Stage 3 future-start trial).
  const trials = rows.filter(e => e.is_trial && (e.status === 'active' || e.status === 'pending'))
  // Stage 3 pending enrolments — waiting for the cron at 02:00 UTC OR the
  // admin's "Activate now" override below. Hidden from the page before
  // Phase 1; now first-class.
  const pending = rows.filter(e => e.status === 'pending' && !e.is_trial)
  const active = rows.filter(e => e.status === 'active' && !e.is_trial)
  const paused = rows.filter(e => e.status === 'paused')
  const cancelled = rows.filter(e => e.status === 'cancelled' || e.status === 'inactive')

  // ── Payment markers: who on this roster is actually paying? One bounded
  // read; see src/lib/enrolment-payment-status.ts for the verdict rules. ──
  const { data: orgRow } = await supabase
    .from('organisations')
    .select('stripe_account_id')
    .eq('id', orgId)
    .single()
  const rosterPlayerIds = [...new Set([...active, ...trials].map(e => e.player_id))]
  const payMap = await loadPaymentStatusByPlayer(
    supabase, orgId, rosterPlayerIds, !!orgRow?.stripe_account_id
  )
  const notPayingActive = active.filter(e => (payMap.get(e.player_id) ?? 'no_sub') !== 'paying')
  const payingCount = active.length - notPayingActive.length

  // ── Enrol → "send a payment link?" The Enrol form offers the academy's
  // existing Request payment step straight after a child is enrolled, instead
  // of leaving them to find the child again under "In a class, not paying".
  // Admins only (the request-payment route refuses anyone else). READ-ONLY:
  // the active plans, and which children already have a membership or a
  // request waiting (those get no offer, because the route would refuse). ──
  let enrolPlans: Array<{ id: string; name: string; amount: number | null }> = []
  let enrolHasMembership: string[] = []
  let enrolCanRequest = false
  {
    const { data: myRole } = await supabase.rpc('get_my_role')
    enrolCanRequest = myRole === 'admin'
    if (enrolCanRequest) {
      const [{ data: planRows }, { data: subRows }] = await Promise.all([
        supabase.from('subscription_plans').select('id, name, amount')
          .eq('organisation_id', orgId).eq('active', true).order('sort_order', { ascending: true }),
        supabase.from('subscriptions').select('player_id')
          .eq('organisation_id', orgId).not('player_id', 'is', null)
          .in('status', ['active', 'trialing', 'past_due', 'pending_migration', 'paused', 'scheduled']),
      ])
      enrolPlans = (planRows || []) as typeof enrolPlans
      enrolHasMembership = [...new Set(((subRows || []) as Array<{ player_id: string }>).map(r => r.player_id))]
    }
  }

  // ── "In a class, not paying" → chase it from here. Loaded only for that
  // view, and only for admins (the route refuses anyone else): the academy's
  // active plans, and which of these children already have a payment request
  // waiting. READ-ONLY. ──
  let chasePlans: Array<{ id: string; name: string; amount: number | null }> = []
  const pendingSentByPlayer = new Map<string, string>()
  const blockedByPlayer = new Set<string>()
  let canChase = false
  if (onlyNotPaying && notPayingActive.length > 0) {
    const { data: role } = await supabase.rpc('get_my_role')
    canChase = role === 'admin'
    if (canChase) {
      const ids = [...new Set(notPayingActive.map(e => e.player_id))]
      const [{ data: planRows }, { data: subRows }] = await Promise.all([
        supabase.from('subscription_plans').select('id, name, amount')
          .eq('organisation_id', orgId).eq('active', true).order('sort_order', { ascending: true }),
        supabase.from('subscriptions').select('player_id, status, invite_sent_at, created_at')
          .eq('organisation_id', orgId).in('player_id', ids)
          .in('status', ['active', 'trialing', 'past_due', 'pending_migration']),
      ])
      chasePlans = (planRows || []) as typeof chasePlans
      for (const r of (subRows || []) as Array<{ player_id: string | null; status: string; invite_sent_at: string | null; created_at: string }>) {
        if (!r.player_id) continue
        if (r.status === 'pending_migration') pendingSentByPlayer.set(r.player_id, r.invite_sent_at || r.created_at)
        // A live membership row that isn't billing: the route would refuse a new
        // request ("already has a subscription"), so no button; it needs Payments.
        else blockedByPlayer.add(r.player_id)
      }
    }
  }
  const fmtShort = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/London' })

  // ── Enrolments Revenue Ops Phase 1A — read-only Daily Actions band. ──
  // Built only when the flag is ON: trials-ending-soon from already-loaded
  // `trials`, plus two flag-gated reads (trial conversion counts, recent
  // attendance for active members). Flag OFF ⇒ none of this runs, so the page
  // fires no extra queries and renders byte-identical.
  let bandTrials: ActionTrial[] = []
  let bandConcerns: AttendanceConcern[] = []
  let bandConversion: ConversionSummary | null = null
  if (ENROLMENTS_REVOPS_ENABLED) {
    const nowMs = Date.now()
    bandTrials = trialsEndingSoon(trials, nowMs, 7)
    // Gross conversion % via the existing trial-conversion loader (read-only).
    const conv = await loadTrialConversionData(supabase, orgId).catch(() => null)
    bandConversion = conversionSummary({
      activeTrials: trials.length,
      endingThisWeek: bandTrials.filter((t) => (t.daysLeft ?? -99) >= 0).length,
      followUpDue: trialFollowUps.length,
      counts: conv?.counts ?? null,
    })
    // Attendance risk for ACTIVE members only — one bounded read (90-day window).
    const activePlayerIds = [...new Set(active.map((e) => e.player_id))]
    if (activePlayerIds.length > 0) {
      const cutoff = new Date(nowMs - 90 * 86_400_000).toISOString().slice(0, 10)
      const { data: att } = await supabase
        .from('attendance')
        .select('player_id, session_date, present')
        .in('player_id', activePlayerIds)
        .gte('session_date', cutoff)
      const byPlayer = new Map<string, Array<{ session_date: string; present: boolean }>>()
      for (const a of (att || []) as Array<{ player_id: string; session_date: string; present: boolean }>) {
        const arr = byPlayer.get(a.player_id) ?? []
        arr.push({ session_date: a.session_date, present: a.present })
        byPlayer.set(a.player_id, arr)
      }
      // An academy that doesn't take its registers in the app has no attendance
      // rows at all, which reads as "every child is at risk". Only flag drift
      // when there is a register to drift from.
      bandConcerns = byPlayer.size > 0 ? buildAttendanceConcerns(active, byPlayer, nowMs) : []
    }
  }

  // Group active enrolments by class for the existing display. The class's
  // head-count always comes from everyone in it, even when the view is
  // narrowed to the children who aren't paying.
  const byGroup: Record<string, EnrolmentRow[]> = {}
  const classSize: Record<string, number> = {}
  const notPayingIds = new Set(notPayingActive.map(e => e.id))
  for (const e of active) {
    const k = e.group?.name || 'Unassigned'
    classSize[k] = (classSize[k] || 0) + 1
    if (onlyNotPaying && !notPayingIds.has(e.id)) continue
    if (!byGroup[k]) byGroup[k] = []
    byGroup[k].push(e)
  }
  const groupedActive = Object.entries(byGroup).sort((a, b) => (classSize[b[0]] || 0) - (classSize[a[0]] || 0))
  const classCount = Object.keys(classSize).length

  // Helpers used by Pending + Trial rows
  const todayMs = Date.now()
  const dayMs = 86_400_000
  const fmtDate = (iso: string) =>
    new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
    })
  const daysFromNow = (iso: string): number => {
    const t = new Date(iso + 'T00:00:00Z').getTime()
    return Math.ceil((t - todayMs) / dayMs)
  }
  const countdownLabel = (iso: string): string => {
    const n = daysFromNow(iso)
    if (n < 0) return `${-n} day${-n === 1 ? '' : 's'} overdue`
    if (n === 0) return 'today'
    if (n === 1) return 'tomorrow'
    return `in ${n} days`
  }

  // Chip sub-lines — the number says what, this says whether to care.
  const trialsEndingThisWeek = trials.filter(e => {
    const exp = e.trial_expires_at
    if (!exp) return false
    const n = daysFromNow(exp)
    return n >= 0 && n <= 7
  }).length
  const nextPendingStart = pending
    .map(e => e.activates_on)
    .filter(Boolean)
    .sort()[0] as string | undefined

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Enrolments</h1>
        <p className="mt-1 text-sm text-[#93a2ba] tabular-nums">
          {active.length} {active.length === 1 ? 'child' : 'children'} in {classCount} {classCount === 1 ? 'class' : 'classes'}
          {active.length > 0 ? ` · ${payingCount} paying` : ''}
        </p>
        {/* One quiet row of jump links; only the sections that have someone in them. */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Chip href="#active"         label="Active"        value={active.length} />
          <Chip href="#pending"        label="Starting soon" value={pending.length}
                detail={nextPendingStart ? `next ${countdownLabel(nextPendingStart)}` : undefined} />
          <Chip href="#trial"          label="On trial"      value={trials.length}
                detail={trialsEndingThisWeek > 0 ? `${trialsEndingThisWeek} end${trialsEndingThisWeek === 1 ? 's' : ''} this week` : undefined} />
          <Chip href="#trial-followup" label="Trial follow-up due" value={trialFollowUps.length} />
          <Chip href="#paused"         label="Paused"        value={paused.length} />
          <Chip href="#cancelled"      label="Cancelled"     value={cancelled.length} />
        </div>
      </div>

      {/* The old amber "N enrolled, not paying" banner lived here. Its job is now the
          "In a class, not paying" filter on Active by class, further down. */}

      {ENROLMENTS_REVOPS_ENABLED && (
        <EnrolmentsActionBand
          trialsEndingSoon={bandTrials}
          attendanceConcerns={bandConcerns}
          conversion={bandConversion}
        />
      )}

      <EnrolmentForm players={players || []} groups={groups || []} orgId={orgId} canRequestPayment={enrolCanRequest} plans={enrolPlans} hasMembership={enrolHasMembership} />

      {/* ─── Phase 2.4: TRIAL FOLLOW-UP DUE ─────────────────────────────
          Rendered OUTSIDE the empty-state branch so brand-new orgs that
          only have trial_bookings (no enrolments yet) still see their
          follow-up queue. Renders nothing when the cohort is empty.
      ─────────────────────────────────────────────────────────────────── */}
      <TrialFollowUpSection rows={trialFollowUps} />

      {rows.length === 0 ? (
        <EmptyState message="No enrolments yet." />
      ) : (
        <div className="space-y-6">
          {/* ─── PENDING (Stage 3 future-start) ─── */}
          {pending.length > 0 && (
            <section id="pending">
              <SectionHeading title="Starting soon" count={pending.length} />
              <div className="rounded-[15px] border border-[#1d2c42] bg-[#0f1a2b] overflow-x-auto">
                <Table headers={['Player', 'Class', 'Start date', 'Days until', 'Actions']}>
                  {pending.map(e => {
                    const start = e.activates_on || ''
                    return (
                      <tr key={e.id} className="border-t border-[#1d2c42]">
                        <Td>{e.player?.first_name} {e.player?.last_name}</Td>
                        <Td className="text-white/70">{e.group?.name}{e.group?.day_of_week ? ` · ${e.group.day_of_week}` : ''}</Td>
                        <Td className="text-white/70">{start ? fmtDate(start) : '—'}</Td>
                        <Td className="text-[#93a2ba]">{start ? countdownLabel(start) : '—'}</Td>
                        <Td>
                          <PendingEnrolmentActions
                            enrolmentId={e.id}
                            playerId={e.player_id}
                          />
                        </Td>
                      </tr>
                    )
                  })}
                </Table>
              </div>
            </section>
          )}

          {/* ─── TRIAL — decision cards, urgent ones flagged ─── */}
          {trials.length > 0 && (
            <section id="trial">
              <SectionHeading title="On trial" count={trials.length} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {trials.map(e => {
                  const exp = e.trial_expires_at || ''
                  const n = exp ? daysFromNow(exp) : null
                  const urgent = n != null && n <= 1
                  return (
                    <div key={e.id}
                      className={`rounded-[15px] border bg-[#0f1a2b] p-4 ${urgent ? 'border-[#d8a95a]/40' : 'border-[#1d2c42]'}`}>
                      <div className="text-[15px] font-semibold text-white">{e.player?.first_name} {e.player?.last_name}</div>
                      <div className="mt-0.5 text-xs text-white/40">
                        {e.group?.name}{e.group?.day_of_week ? ` · ${e.group.day_of_week}` : ''}{e.group?.time_slot ? ` ${e.group.time_slot}` : ''}
                      </div>
                      {exp && (
                        <span className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          n != null && n < 0 ? 'bg-[#e0736d]/[0.13] text-[#e0736d]'
                          : urgent ? 'bg-[#d8a95a]/[0.13] text-[#d8a95a]'
                          : 'bg-[#93a2ba]/[0.10] text-[#93a2ba]'
                        }`}>
                          {n != null && n < 0 ? countdownLabel(exp) : n === 0 ? 'Ends today' : n === 1 ? 'Ends tomorrow' : `${n} days left`}
                        </span>
                      )}
                      <div className="mt-3">
                        <TrialEnrolmentActions enrolmentId={e.id} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* ─── ACTIVE BY CLASS — capacity + who's actually paying ─── */}
          {active.length > 0 && (
            <section id="active">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <SectionHeading title="Active by class" count={active.length} />
                {/* The one filter that matters: in a class, money not coming in. */}
                <div className="inline-flex gap-0.5 rounded-[10px] border border-[#1d2c42] bg-[#0f1a2b] p-[3px]" role="group" aria-label="Who to show">
                  <SegLink href="/dashboard/enrolments#active" active={!onlyNotPaying}>
                    Everyone <Count>{active.length}</Count>
                  </SegLink>
                  <SegLink href="/dashboard/enrolments?view=notpaying#active" active={onlyNotPaying}>
                    In a class, not paying <Count warn={notPayingActive.length > 0}>{notPayingActive.length}</Count>
                  </SegLink>
                </div>
              </div>
              {onlyNotPaying && notPayingActive.length > 0 && (
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-[#1d2c42] bg-[#0f1a2b] px-4 py-3">
                  <p className="text-[13px] text-[#93a2ba]">
                    {canChase
                      ? 'These children are in a class with no membership being paid. Press Request payment and their parent is emailed a link to add their card.'
                      : 'These children are in a class with no membership being paid. An academy admin can send their parent a payment request.'}
                  </p>
                  <Link href="/dashboard/payments" className="rounded-[10px] border border-[#293b58] bg-[#142236] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:border-[#4ecde6]/50">
                    Go to Payments
                  </Link>
                </div>
              )}
              {groupedActive.length === 0 ? (
                <div className="rounded-[15px] border border-[#1d2c42] bg-[#0f1a2b] px-4 py-10 text-center text-sm text-[#93a2ba]">
                  Everyone in a class is paying.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {groupedActive.map(([className, list]) => {
                    const cap = (groups || []).find(g => g.id === list[0]?.group_id) as
                      | { max_capacity?: number | null } | undefined
                    const capacity = Number(cap?.max_capacity) || null
                    const size = classSize[className] || list.length
                    const fillPct = capacity ? Math.min(100, Math.round((size / capacity) * 100)) : null
                    return (
                      <div key={className} className="rounded-[15px] border border-[#1d2c42] bg-[#0f1a2b] p-4">
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="truncate text-[15px] font-semibold text-white">{className}</h3>
                            {list[0]?.group && (list[0].group.day_of_week || list[0].group.time_slot) && (
                              <div className="mt-0.5 text-xs text-[#93a2ba]">{list[0].group.day_of_week}{list[0].group.time_slot ? ` · ${list[0].group.time_slot}` : ''}</div>
                            )}
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="text-[13px] font-semibold tabular-nums text-white">
                              {size}{capacity ? <span className="font-normal text-[#93a2ba]"> of {capacity} places</span> : <span className="font-normal text-[#93a2ba]"> {size === 1 ? 'child' : 'children'}</span>}
                            </div>
                            {fillPct != null && (
                              <div className="mt-1.5 ml-auto h-1 w-[110px] overflow-hidden rounded-full bg-[#1d2c42]">
                                <div className="h-full rounded-full bg-[#4ecde6]" style={{ width: `${fillPct}%` }} />
                              </div>
                            )}
                          </div>
                        </div>
                        {onlyNotPaying ? (
                          // The chase list: one row per child, with what to do about it.
                          <ul className="divide-y divide-[#1d2c42] rounded-[12px] border border-[#1d2c42] bg-[#080e18]">
                            {list.map(e => {
                              const fullName = `${e.player?.first_name || ''} ${e.player?.last_name || ''}`.trim()
                              const verdict: PaymentVerdict = payMap.get(e.player_id) ?? 'no_sub'
                              const pendingSent = pendingSentByPlayer.get(e.player_id) || null
                              const blocked = blockedByPlayer.has(e.player_id) || verdict === 'not_billing'
                              return (
                                <li key={e.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-3.5 py-2.5">
                                  <div className="min-w-0">
                                    <Link href={`/dashboard/players?search=${encodeURIComponent(fullName)}`} className="block truncate text-sm font-semibold text-white hover:text-[#4ecde6]">
                                      {fullName}
                                    </Link>
                                    <div className="text-xs text-[#93a2ba]">
                                      {pendingSent
                                        ? `Payment link sent ${fmtShort(pendingSent)}, not paid yet`
                                        : blocked
                                          ? 'Has a membership that isn\'t billing'
                                          : 'No membership set up'}
                                    </div>
                                  </div>
                                  {canChase && (
                                    pendingSent ? (
                                      <RequestPaymentButton playerId={e.player_id} playerFirstName={e.player?.first_name || 'this player'} plans={chasePlans} compact pendingSentAt={pendingSent} />
                                    ) : blocked ? (
                                      <Link href="/dashboard/payments" className="text-xs font-semibold text-[#93a2ba] hover:text-white">Sort in Payments</Link>
                                    ) : chasePlans.length > 0 ? (
                                      <RequestPaymentButton playerId={e.player_id} playerFirstName={e.player?.first_name || 'this player'} plans={chasePlans} compact />
                                    ) : (
                                      <Link href="/dashboard/payments?tab=manage" className="text-xs font-semibold text-[#93a2ba] hover:text-white">Add a plan first</Link>
                                    )
                                  )}
                                </li>
                              )
                            })}
                          </ul>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {list.map(e => {
                              const fullName = `${e.player?.first_name || ''} ${e.player?.last_name || ''}`.trim()
                              const verdict: PaymentVerdict = payMap.get(e.player_id) ?? 'no_sub'
                              const paying = verdict === 'paying'
                              return (
                                <Link key={e.id} href={`/dashboard/players?search=${encodeURIComponent(fullName)}`}
                                  title={paying ? 'Paying member' : verdict === 'not_billing' ? 'Has a membership, but it is not billing through Stripe' : 'In this class with no membership set up'}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#1d2c42] bg-[#080e18] px-2.5 py-1.5 text-[12px] font-medium text-white/90 transition-colors hover:border-[#293b58]">
                                  {!paying && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#d8a95a]" />}
                                  {fullName}
                                  {!paying && onlyNotPaying && (
                                    <span className="text-[11px] font-semibold text-[#d8a95a]">
                                      {verdict === 'not_billing' ? 'Not billing' : 'Not paying'}
                                    </span>
                                  )}
                                  {!paying && !onlyNotPaying && <span className="sr-only">(not paying)</span>}
                                </Link>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
              {!onlyNotPaying && notPayingActive.length > 0 && (
                <p className="mt-3 flex items-center gap-1.5 text-xs text-[#5b6c86]">
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#d8a95a]" />
                  In a class with no membership being paid.
                </p>
              )}
            </section>
          )}

          {/* ─── PAUSED ─── */}
          {paused.length > 0 && (
            <section id="paused">
              <SectionHeading title="Paused" count={paused.length} />
              <div className="rounded-[15px] border border-[#1d2c42] bg-[#0f1a2b] divide-y divide-[#1d2c42]">
                {paused.map(e => <CompactRow key={e.id} e={e} />)}
              </div>
            </section>
          )}

          {/* ─── CANCELLED ─── */}
          {cancelled.length > 0 && (
            <section id="cancelled">
              <SectionHeading title="Cancelled" count={cancelled.length} />
              <div className="rounded-[15px] border border-[#1d2c42] bg-[#0f1a2b] divide-y divide-[#1d2c42]">
                {cancelled.slice(0, 20).map(e => <CompactRow key={e.id} e={e} />)}
                {cancelled.length > 20 && (
                  <div className="px-4 py-2.5 text-xs text-[#5b6c86]">+ {cancelled.length - 20} older cancellations</div>
                )}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Sub-components — kept inline so the page is one self-contained file.
// ─────────────────────────────────────────────────────────────────────────

/** A quiet jump link to a section. Sections with nobody in them aren't shown. */
function Chip({ href, label, value, detail }: { href: string; label: string; value: number; detail?: string }) {
  if (value === 0) return null
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-full border border-[#1d2c42] bg-[#0f1a2b] px-3 py-1.5 text-[13px] font-medium text-[#93a2ba] transition-colors hover:border-[#293b58] hover:text-white"
    >
      {label}
      <span className="rounded-full bg-[#1d2c42] px-1.5 py-px text-[11px] font-semibold tabular-nums text-white">{value}</span>
      {detail && <span className="text-[11px] text-[#5b6c86]">{detail}</span>}
    </Link>
  )
}

function SectionHeading({ title, count }: { title: string; count: number }) {
  return (
    <div className="mb-2 flex items-baseline gap-2">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.07em] text-[#5b6c86]">{title}</h2>
      <span className="text-xs tabular-nums text-[#5b6c86]">{count}</span>
    </div>
  )
}

function SegLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      className={`inline-flex items-center gap-2 rounded-[7px] px-3 py-1.5 text-[13px] font-semibold transition-colors ${active ? 'bg-[#142236] text-white' : 'text-[#93a2ba] hover:text-white'}`}
    >
      {children}
    </Link>
  )
}

function Count({ children, warn }: { children: React.ReactNode; warn?: boolean }) {
  return (
    <span className={`rounded-full px-1.5 py-px text-[11px] font-semibold tabular-nums ${warn ? 'bg-[#d8a95a]/[0.16] text-[#d8a95a]' : 'bg-[#1d2c42] text-[#93a2ba]'}`}>
      {children}
    </span>
  )
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-white/[0.015]">
          {headers.map(h => (
            <th key={h} className="text-left px-4 py-2.5 text-[11px] uppercase tracking-[0.07em] text-[#5b6c86] font-semibold">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  )
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-middle ${className || 'text-white'}`}>{children}</td>
}

function CompactRow({ e }: { e: EnrolmentRow }) {
  return (
    <div className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-[#142236] transition-colors">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-white truncate">{e.player?.first_name} {e.player?.last_name}</div>
        <div className="text-xs text-[#93a2ba] truncate">{e.group?.name}{e.group?.day_of_week ? ` · ${e.group.day_of_week}` : ''}</div>
      </div>
      <EnrolmentStatusToggle enrolmentId={e.id} currentStatus={e.status} />
    </div>
  )
}
