/**
 * Trial follow-up loader — Phase 2.4 step 2.
 *
 * Reads BOTH trial systems for an org and returns a unified set of rows
 * that the Enrolments page (and later: Parents / Players list filters,
 * Parent Detail badge, TrialManager tab) can surface.
 *
 * READ-ONLY. No mutations. No Stripe. No cron. No emails. No new admin
 * endpoints in this step — actions are wired in Phase 2.4 step 3 after
 * approval.
 *
 *   • trial_bookings        — has parent_name/email/phone + child_name as
 *                             text fields. There is NO FK to parents/players
 *                             on these rows, so we can't deep-link to a
 *                             Parent Detail page; only mailto: works.
 *   • enrolments.is_trial   — has player_id (→ parent profile + group).
 *                             Deep-linkable to Parent Detail.
 *
 * Stage derivation is delegated to src/lib/trial-derive.ts so this file
 * stays I/O-only. The cohort returned here is `needsFollowUp(stage)` =
 * { awaiting_followup, stale_followup } — the action queue surface.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  deriveTrialStageFromBooking,
  deriveTrialStageFromEnrolment,
  needsFollowUp,
  daysSinceTrialDate,
  type TrialStage,
} from '@/lib/trial-derive'

// ─── Unified row shape ─────────────────────────────────────────────────

export interface TrialFollowUpRow {
  source: 'booking' | 'enrolment'
  id: string                     // trial_bookings.id OR enrolments.id

  stage: TrialStage              // 'awaiting_followup' | 'stale_followup'
  childName: string
  parentName: string | null
  parentEmail: string | null
  parentPhone: string | null
  parentId: string | null        // null for trial_bookings (no FK)
  playerId: string | null        // null for trial_bookings (no player row yet)
  groupName: string | null

  /**
   * For bookings: preferred_date (ISO YYYY-MM-DD).
   * For enrolments: trial_expires_at (ISO YYYY-MM-DD).
   * Used as the column header value AND for sort.
   */
  trialDateIso: string | null
  daysSinceTrial: number | null

  /**
   * Action links. All read-only routes that already exist.
   *   viewHref      — current trial detail surface
   *   messageHref   — mailto:parent (no new messaging infra)
   *   parentHref    — Parent Detail page (only set for enrolments)
   */
  viewHref: string
  messageHref: string | null
  parentHref: string | null
}

// ─── Loader ────────────────────────────────────────────────────────────

/**
 * Pull the org's "trial follow-up due" cohort from BOTH systems.
 *
 * @param supabase  server-side client (already org-scoped via RLS;
 *                  we also pass organisation_id explicitly as defence-in-depth)
 * @param orgId     org UUID — the explicit defensive filter
 * @param nowMs     injected for testability; defaults to Date.now()
 */
export async function loadTrialFollowUpRows(
  supabase: SupabaseClient,
  orgId: string,
  nowMs: number = Date.now(),
): Promise<TrialFollowUpRow[]> {
  // Run both pulls in parallel — they hit different tables, never block.
  const [bookingRows, enrolmentRows] = await Promise.all([
    loadFromTrialBookings(supabase, orgId, nowMs),
    loadFromEnrolmentTrials(supabase, orgId, nowMs),
  ])

  const merged = [...bookingRows, ...enrolmentRows]

  // Sort: stale_followup first (most urgent), then by daysSinceTrial DESC
  // so the oldest unresolved trials surface at the top.
  return merged.sort((a, b) => {
    const aStale = a.stage === 'stale_followup' ? 0 : 1
    const bStale = b.stage === 'stale_followup' ? 0 : 1
    if (aStale !== bStale) return aStale - bStale
    return (b.daysSinceTrial ?? 0) - (a.daysSinceTrial ?? 0)
  })
}

// ─── trial_bookings → follow-up rows ──────────────────────────────────

type BookingRow = {
  id: string
  status: string
  preferred_date: string | null
  followup_sent: boolean | null
  converted: boolean | null
  updated_at: string | null
  parent_name: string
  parent_email: string
  parent_phone: string | null
  child_name: string
  group: { name: string } | null
}

async function loadFromTrialBookings(
  supabase: SupabaseClient,
  orgId: string,
  nowMs: number,
): Promise<TrialFollowUpRow[]> {
  // Read-only select. We intentionally fetch ALL active trial_bookings for
  // the org (not just attended/past — the derive layer handles pending-past
  // and converted/lost filtering). On orgs with thousands of historical
  // bookings, the WHERE on converted=false trims the cold tail.
  const { data, error } = await supabase
    .from('trial_bookings')
    .select(`
      id, status, preferred_date, followup_sent, converted, updated_at,
      parent_name, parent_email, parent_phone, child_name,
      group:training_groups(name)
    `)
    .eq('organisation_id', orgId)
    .or('converted.is.null,converted.eq.false')
    .neq('status', 'cancelled')
    .neq('status', 'no_show')
    .order('preferred_date', { ascending: false })

  if (error || !data) return []

  const rows = data as unknown as BookingRow[]
  const out: TrialFollowUpRow[] = []
  for (const b of rows) {
    const stage = deriveTrialStageFromBooking(
      {
        id: b.id,
        status: b.status,
        preferred_date: b.preferred_date,
        followup_sent: b.followup_sent,
        converted: b.converted,
        updated_at: b.updated_at,
      },
      nowMs,
    )
    if (!needsFollowUp(stage)) continue
    out.push({
      source: 'booking',
      id: b.id,
      stage,
      childName: b.child_name || '',
      parentName: b.parent_name || null,
      parentEmail: b.parent_email || null,
      parentPhone: b.parent_phone || null,
      parentId: null,
      playerId: null,
      groupName: b.group?.name ?? null,
      trialDateIso: b.preferred_date,
      daysSinceTrial: daysSinceTrialDate(
        { preferred_date: b.preferred_date, updated_at: b.updated_at },
        nowMs,
      ),
      viewHref: '/dashboard/trials',
      messageHref: b.parent_email ? `mailto:${b.parent_email}` : null,
      parentHref: null, // trial_bookings has no FK to parent profile
    })
  }
  return out
}

// ─── enrolments.is_trial → follow-up rows ─────────────────────────────

type EnrolmentTrialRow = {
  id: string
  status: string
  is_trial: boolean | null
  trial_expires_at: string | null
  activates_on: string | null
  player_id: string | null
  player: {
    id: string
    first_name: string | null
    last_name: string | null
    parent_id: string | null
    parent: { full_name: string | null; email: string | null; phone: string | null } | null
  } | null
  group: { name: string | null } | null
}

async function loadFromEnrolmentTrials(
  supabase: SupabaseClient,
  orgId: string,
  nowMs: number,
): Promise<TrialFollowUpRow[]> {
  // NOTE: the enrolment_status enum is ('active', 'paused', 'cancelled', 'pending').
  // We deliberately only exclude 'cancelled' here — 'paused' rows are derived
  // to 'lost' downstream and filtered out by needsFollowUp(stage), so they're
  // safe to fetch. We also keep this list TIGHT because Postgrest `neq` on an
  // enum column casts the RHS through the enum type — passing a non-member
  // value (e.g. 'inactive') would 400 the whole query.
  const { data, error } = await supabase
    .from('enrolments')
    .select(`
      id, status, is_trial, trial_expires_at, activates_on, player_id,
      player:players!enrolments_player_id_fkey(
        id, first_name, last_name, parent_id,
        parent:profiles!players_parent_id_fkey(full_name, email, phone)
      ),
      group:training_groups(name)
    `)
    .eq('organisation_id', orgId)
    .eq('is_trial', true)
    .neq('status', 'cancelled')
    .order('trial_expires_at', { ascending: true })

  if (error || !data) return []

  const rows = data as unknown as EnrolmentTrialRow[]
  const out: TrialFollowUpRow[] = []
  for (const e of rows) {
    const stage = deriveTrialStageFromEnrolment(
      {
        id: e.id,
        status: e.status,
        is_trial: e.is_trial,
        trial_expires_at: e.trial_expires_at,
        activates_on: e.activates_on,
      },
      nowMs,
    )
    if (!needsFollowUp(stage)) continue

    const childName = [e.player?.first_name, e.player?.last_name]
      .filter(Boolean).join(' ').trim() || 'Unknown player'

    // daysSinceTrial for enrolments = days since trial_expires_at passed.
    // trial_expires_at is declared TIMESTAMPTZ so it returns as
    // 'YYYY-MM-DDTHH:MM:SS+00:00'. We feed it to Date.parse directly when
    // it already has a time component; otherwise we anchor at UTC midnight.
    let daysSince: number | null = null
    if (e.trial_expires_at) {
      const raw = e.trial_expires_at
      const expMs = Date.parse(/[T ]/.test(raw) ? raw : raw + 'T00:00:00Z')
      if (!isNaN(expMs)) daysSince = Math.max(0, Math.floor((nowMs - expMs) / 86_400_000))
    }

    out.push({
      source: 'enrolment',
      id: e.id,
      stage,
      childName,
      parentName: e.player?.parent?.full_name ?? null,
      parentEmail: e.player?.parent?.email ?? null,
      parentPhone: e.player?.parent?.phone ?? null,
      parentId: e.player?.parent_id ?? null,
      playerId: e.player?.id ?? null,
      groupName: e.group?.name ?? null,
      trialDateIso: e.trial_expires_at,
      daysSinceTrial: daysSince,
      viewHref: e.player?.id
        ? `/dashboard/players/${e.player.id}`
        : '/dashboard/enrolments#trial',
      messageHref: e.player?.parent?.email
        ? `mailto:${e.player.parent.email}`
        : null,
      parentHref: e.player?.parent_id
        ? `/dashboard/parents/${e.player.parent_id}`
        : null,
    })
  }
  return out
}
