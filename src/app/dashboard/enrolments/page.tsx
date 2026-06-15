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
import EnrolmentsActionBand from '@/components/enrolments/EnrolmentsActionBand'

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

export default async function EnrolmentsPage() {
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
      .from('players')
      .select('id, first_name, last_name')
      .eq('organisation_id', orgId)
      .order('first_name'),
    supabase
      .from('training_groups')
      .select('id, name, day_of_week')
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
      bandConcerns = buildAttendanceConcerns(active, byPlayer, nowMs)
    }
  }

  // Group active enrolments by class for the existing display
  const byGroup: Record<string, EnrolmentRow[]> = {}
  for (const e of active) {
    const k = e.group?.name || 'Unassigned'
    if (!byGroup[k]) byGroup[k] = []
    byGroup[k].push(e)
  }
  const groupedActive = Object.entries(byGroup).sort((a, b) => b[1].length - a[1].length)

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Enrolments</h1>
        {/* ─── Phase 1: five-state chip row + Phase 2.4 follow-up chip ─── */}
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
          <Chip href="#active"          label="Active"           value={active.length}          tone="emerald" />
          <Chip href="#pending"         label="Pending"          value={pending.length}         tone="amber" />
          <Chip href="#trial"           label="Trial"            value={trials.length}          tone="sky" />
          <Chip href="#trial-followup"  label="Follow-up due"    value={trialFollowUps.length}  tone="rose" />
          <Chip href="#paused"          label="Paused"           value={paused.length}          tone="violet" />
          <Chip href="#cancelled"       label="Cancelled"        value={cancelled.length}       tone="muted" />
        </div>
      </div>

      {ENROLMENTS_REVOPS_ENABLED && (
        <EnrolmentsActionBand
          trialsEndingSoon={bandTrials}
          attendanceConcerns={bandConcerns}
          conversion={bandConversion}
        />
      )}

      <EnrolmentForm players={players || []} groups={groups || []} orgId={orgId} />

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
              <SectionHeading title="Pending future starts" count={pending.length} tone="amber" />
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                <Table headers={['Player', 'Class', 'Start date', 'Days until', 'Actions']}>
                  {pending.map(e => {
                    const start = e.activates_on || ''
                    return (
                      <tr key={e.id} className="border-t border-white/[0.04]">
                        <Td>{e.player?.first_name} {e.player?.last_name}</Td>
                        <Td className="text-white/70">{e.group?.name}{e.group?.day_of_week ? ` · ${e.group.day_of_week}` : ''}</Td>
                        <Td className="text-white/70">{start ? fmtDate(start) : '—'}</Td>
                        <Td className="text-amber-300">{start ? countdownLabel(start) : '—'}</Td>
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

          {/* ─── TRIAL ─── */}
          {trials.length > 0 && (
            <section id="trial">
              <SectionHeading title="Trial enrolments" count={trials.length} tone="sky" />
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                <Table headers={['Player', 'Class', 'Trial expiry', 'Actions']}>
                  {trials.map(e => {
                    const exp = e.trial_expires_at || ''
                    return (
                      <tr key={e.id} className="border-t border-white/[0.04]">
                        <Td>{e.player?.first_name} {e.player?.last_name}</Td>
                        <Td className="text-white/70">{e.group?.name}{e.group?.day_of_week ? ` · ${e.group.day_of_week}` : ''}</Td>
                        <Td className={daysFromNow(exp) < 0 ? 'text-rose-300' : 'text-sky-300'}>
                          {exp ? `${fmtDate(exp)} · ${countdownLabel(exp)}` : '—'}
                        </Td>
                        <Td>
                          <TrialEnrolmentActions enrolmentId={e.id} />
                        </Td>
                      </tr>
                    )
                  })}
                </Table>
              </div>
            </section>
          )}

          {/* ─── ACTIVE BY CLASS (existing) ─── */}
          {groupedActive.length > 0 && (
            <section id="active">
              <SectionHeading title="Active by class" count={active.length} tone="emerald" />
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.05]">
                {groupedActive.map(([className, list]) => (
                  <div key={className} className="p-4">
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-white">{className}</h3>
                        <span className="text-[10px] uppercase tracking-wider text-white/40 bg-white/[0.06] px-2 py-0.5 rounded-full font-bold">{list.length}</span>
                      </div>
                      {list[0]?.group && (list[0].group.day_of_week || list[0].group.time_slot) && (
                        <span className="text-[11px] text-white/40">{list[0].group.day_of_week}{list[0].group.time_slot ? ` · ${list[0].group.time_slot}` : ''}</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {list.map(e => (
                        <Link key={e.id} href={`/dashboard/players?search=${encodeURIComponent(e.player?.first_name || '')}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[12px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/15 transition-colors">
                          ⚽ {e.player?.first_name} {e.player?.last_name}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ─── PAUSED ─── */}
          {paused.length > 0 && (
            <section id="paused">
              <SectionHeading title="Paused" count={paused.length} tone="violet" />
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.05]">
                {paused.map(e => <CompactRow key={e.id} e={e} />)}
              </div>
            </section>
          )}

          {/* ─── CANCELLED ─── */}
          {cancelled.length > 0 && (
            <section id="cancelled">
              <SectionHeading title="Cancelled / inactive" count={cancelled.length} tone="muted" />
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.05]">
                {cancelled.slice(0, 20).map(e => <CompactRow key={e.id} e={e} />)}
                {cancelled.length > 20 && (
                  <div className="px-4 py-2 text-[11px] text-white/40 italic">+ {cancelled.length - 20} more older cancellations</div>
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

const TONE_CLASS: Record<string, { value: string; chip: string; section: string }> = {
  emerald: { value: 'text-emerald-400', chip: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',     section: 'text-emerald-300' },
  amber:   { value: 'text-amber-400',   chip: 'bg-amber-500/10 text-amber-300 border-amber-500/30',           section: 'text-amber-300' },
  sky:     { value: 'text-sky-400',     chip: 'bg-sky-500/10 text-sky-300 border-sky-500/30',                  section: 'text-sky-300' },
  violet:  { value: 'text-violet-400',  chip: 'bg-violet-500/10 text-violet-300 border-violet-500/30',         section: 'text-violet-300' },
  rose:    { value: 'text-rose-400',    chip: 'bg-rose-500/10 text-rose-300 border-rose-500/30',               section: 'text-rose-300' },
  muted:   { value: 'text-white/40',    chip: 'bg-white/[0.04] text-white/60 border-white/[0.08]',             section: 'text-white/60' },
}

function Chip({ href, label, value, tone }: { href: string; label: string; value: number; tone: keyof typeof TONE_CLASS }) {
  const meta = TONE_CLASS[tone]
  return (
    <Link
      href={value > 0 ? href : '#'}
      className={`rounded-xl border p-3 transition-colors ${meta.chip} ${value > 0 ? 'hover:opacity-90' : 'opacity-60 cursor-default'}`}
    >
      <div className={`text-2xl sm:text-3xl font-extrabold leading-none ${meta.value}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider mt-1">{label}</div>
    </Link>
  )
}

function SectionHeading({ title, count, tone }: { title: string; count: number; tone: keyof typeof TONE_CLASS }) {
  const meta = TONE_CLASS[tone]
  return (
    <div className="flex items-baseline gap-2 mb-2">
      <h2 className={`text-xs font-bold uppercase tracking-wider ${meta.section}`}>{title}</h2>
      <span className="text-xs text-white/30">{count}</span>
    </div>
  )
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-white/[0.02]">
          {headers.map(h => (
            <th key={h} className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-white/40 font-bold">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  )
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2.5 align-middle ${className || 'text-white'}`}>{children}</td>
}

function CompactRow({ e }: { e: EnrolmentRow }) {
  return (
    <div className="px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-white/[0.02] transition-colors">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-white truncate">{e.player?.first_name} {e.player?.last_name}</div>
        <div className="text-[11px] text-white/40 truncate">{e.group?.name}{e.group?.day_of_week ? ` · ${e.group.day_of_week}` : ''}</div>
      </div>
      <EnrolmentStatusToggle enrolmentId={e.id} currentStatus={e.status} />
    </div>
  )
}
