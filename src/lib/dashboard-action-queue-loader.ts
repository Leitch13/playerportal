/**
 * Dashboard Action Queue loader — Phase 2.9.
 *
 * Aggregates the 5 operational counts academy owners scan on login:
 *   • Trial Follow-Ups       (Phase 2.4)
 *   • Payment Issues
 *   • At-Risk Families       (Phase 2.6)
 *   • Attendance Risks       (Phase 2.8)
 *   • Reviews Due
 *
 * READ-ONLY. No mutations. No writes. No side effects.
 *
 * The loader DOES NOT recalculate risk, attendance, trials, or contact
 * status. It REUSES the same derive functions the destination pages
 * already call, so the Action Queue count on the dashboard always matches
 * the row count on the page it links to.
 *
 * Failure-tolerant: every signal counter is wrapped so a Postgrest error
 * on one arm returns 0 rather than crashing the dashboard. This was the
 * single biggest learning from the Phase 1 incident — the dashboard
 * MUST render even when an upstream feed fails.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { loadTrialFollowUpRows } from '@/lib/trial-followups-loader'
import { loadLastContactedMap } from '@/lib/contact-loader'
import { pickMoreUrgentStage, type TrialStage } from '@/lib/trial-derive'
import {
  deriveFamilyBadges,
  type FamilyChild,
  type FamilyBadge,
} from '@/lib/family-derive'
import {
  deriveReviewDue,
  daysSinceIso,
  summariseAttendance,
  type AttendanceRow,
} from '@/lib/players-derive'
import { deriveRisk } from '@/lib/at-risk-derive'
import { deriveAttendanceRisk } from '@/lib/attendance-risk-derive'

// ─── Public types ──────────────────────────────────────────────────────

export interface ActionQueueCounts {
  trialFollowUps: number
  paymentIssues: number
  atRiskFamilies: number
  attendanceRisks: number
  reviewsDue: number
  total: number
}

// ─── Top-level loader ─────────────────────────────────────────────────

/**
 * Aggregate counts for the dashboard Action Queue. Every signal runs in
 * parallel; any failing arm degrades to 0 so the dashboard still renders.
 */
export async function loadDashboardActionQueue(
  supabase: SupabaseClient,
  orgId: string,
): Promise<ActionQueueCounts> {
  const empty: ActionQueueCounts = {
    trialFollowUps: 0, paymentIssues: 0, atRiskFamilies: 0,
    attendanceRisks: 0, reviewsDue: 0, total: 0,
  }
  if (!orgId) return empty

  const [trialFollowUps, paymentIssues, atRiskFamilies, attendanceRisks, reviewsDue] = await Promise.all([
    countTrialFollowUps(supabase, orgId),
    countPaymentIssues(supabase, orgId),
    countAtRiskFamilies(supabase, orgId),
    countAttendanceRisks(supabase, orgId),
    countReviewsDue(supabase, orgId),
  ])
  const total = trialFollowUps + paymentIssues + atRiskFamilies + attendanceRisks + reviewsDue
  return { trialFollowUps, paymentIssues, atRiskFamilies, attendanceRisks, reviewsDue, total }
}

// ─── Per-signal counters ──────────────────────────────────────────────

/**
 * Trial Follow-Ups — `needsFollowUp(stage)` cohort across both backing
 * systems (Phase 2.4). Loader returns rows; we just want the count.
 */
async function countTrialFollowUps(supabase: SupabaseClient, orgId: string): Promise<number> {
  try {
    const rows = await loadTrialFollowUpRows(supabase, orgId)
    return rows.length
  } catch {
    return 0
  }
}

/**
 * Payment Issues — number of DISTINCT parents (families) with at least
 * one `past_due` subscription. Matches `deriveFamilyBillingStatus` which
 * returns 'payment_issue' as soon as ANY of the family's subs is past_due.
 */
async function countPaymentIssues(supabase: SupabaseClient, orgId: string): Promise<number> {
  try {
    const { data } = await supabase
      .from('subscriptions')
      .select('parent_id')
      .eq('organisation_id', orgId)
      .eq('status', 'past_due')
    if (!data) return 0
    const set = new Set<string>()
    for (const r of data) if (r.parent_id) set.add(r.parent_id as string)
    return set.size
  } catch {
    return 0
  }
}

/**
 * At-Risk Families — calls the SAME `deriveRisk` function the Parents
 * page calls per row. We replicate the input set the page builds.
 *
 * The Parents page input contract:
 *   • trialStage    — from trial-followups-loader, rolled up via pickMoreUrgentStage
 *   • badges        — from deriveFamilyBadges(children, childCount, siblingDiscountEnabled)
 *   • contactSignal — from loadLastContactedMap
 *
 * Same input → same output → no drift between dashboard and Parents page.
 */
async function countAtRiskFamilies(supabase: SupabaseClient, orgId: string): Promise<number> {
  try {
    const { data: parents } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('organisation_id', orgId)
      .eq('role', 'parent')
    if (!parents || parents.length === 0) return 0
    const parentIds = parents.map(p => p.id)

    const [{ data: childrenRaw }, { data: subsRows }, contactMap, followUps] = await Promise.all([
      supabase
        .from('players')
        .select(`
          id, parent_id,
          enrolments(status, is_trial, trial_expires_at, activates_on, group:training_groups(name))
        `)
        .eq('organisation_id', orgId)
        .in('parent_id', parentIds),
      supabase
        .from('subscriptions')
        .select('parent_id, player_id, status, plan:subscription_plans(name, amount)')
        .eq('organisation_id', orgId)
        .in('parent_id', parentIds),
      loadLastContactedMap(supabase, parentIds).catch(() => new Map()),
      loadTrialFollowUpRows(supabase, orgId).catch(() => []),
    ])

    const children = (childrenRaw || []) as Array<{
      id: string
      parent_id: string
      enrolments: Array<{ status: string | null; is_trial: boolean | null; trial_expires_at: string | null; activates_on: string | null }> | null
    }>
    const childIds = children.map(c => c.id)

    const childrenByParent = new Map<string, typeof children>()
    for (const c of children) {
      const list = childrenByParent.get(c.parent_id) || []
      list.push(c); childrenByParent.set(c.parent_id, list)
    }

    type SubRow = { parent_id: string | null; player_id: string | null; status: string | null }
    const subsByChild = new Map<string, Array<{ status: string | null }>>()
    for (const s of (subsRows || []) as SubRow[]) {
      if (!s.player_id) continue
      const a = subsByChild.get(s.player_id) || []
      a.push({ status: s.status }); subsByChild.set(s.player_id, a)
    }

    // Attendance + review windows scoped to ALL children at once.
    const lastAttendanceByChild = new Map<string, number | null>()
    const latestReviewByChild = new Map<string, string | null>()
    if (childIds.length > 0) {
      const thirtyDaysAgoIso = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)
      const [{ data: att }, { data: revs }] = await Promise.all([
        supabase.from('attendance').select('player_id, session_date, present').in('player_id', childIds).gte('session_date', thirtyDaysAgoIso),
        supabase.from('progress_reviews').select('player_id, review_date').in('player_id', childIds).order('review_date', { ascending: false }),
      ])
      const summary = summariseAttendance((att || []) as AttendanceRow[])
      for (const [pid, s] of summary) lastAttendanceByChild.set(pid, daysSinceIso(s.lastDateIso))
      for (const r of (revs || []) as Array<{ player_id: string; review_date: string }>) {
        if (!latestReviewByChild.has(r.player_id)) latestReviewByChild.set(r.player_id, r.review_date)
      }
    }

    // Trial stage map by parent_id — same rollup the Parents page does.
    const followUpStageByParentId = new Map<string, TrialStage>()
    const followUpStageByEmail = new Map<string, TrialStage>()
    for (const f of followUps) {
      if (f.parentId) {
        const prev = followUpStageByParentId.get(f.parentId)
        followUpStageByParentId.set(f.parentId, prev ? pickMoreUrgentStage(prev, f.stage) : f.stage)
      } else if (f.parentEmail) {
        const key = f.parentEmail.trim().toLowerCase()
        if (key) {
          const prev = followUpStageByEmail.get(key)
          followUpStageByEmail.set(key, prev ? pickMoreUrgentStage(prev, f.stage) : f.stage)
        }
      }
    }

    // Org sibling-discount flag (the Parents page reads this too).
    let siblingDiscountEnabled = false
    try {
      const { data: orgInfo } = await supabase.from('organisations').select('sibling_discount_enabled').eq('id', orgId).maybeSingle()
      siblingDiscountEnabled = !!(orgInfo as { sibling_discount_enabled?: boolean } | null)?.sibling_discount_enabled
    } catch { /* defaults to false */ }

    // Run the SAME deriveRisk per parent the Parents page runs. Count non-healthy.
    let nonHealthy = 0
    for (const p of parents) {
      const kids = childrenByParent.get(p.id) || []
      const familyChildren: FamilyChild[] = kids.map(c => ({
        id: c.id,
        enrolments: c.enrolments,
        subscriptions: subsByChild.get(c.id) || null,
        lastAttendanceDays: lastAttendanceByChild.get(c.id) ?? null,
        latestReviewDateIso: latestReviewByChild.get(c.id) || null,
      }))
      const badges: FamilyBadge[] = deriveFamilyBadges({
        children: familyChildren,
        childCount: kids.length,
        siblingDiscountEnabled,
      })
      // FK first, email second — exact match with Parents page.
      const fk = followUpStageByParentId.get(p.id) ?? null
      const emailMatch = p.email ? followUpStageByEmail.get(p.email.trim().toLowerCase()) ?? null : null
      const trialStage: TrialStage | null = (fk && emailMatch)
        ? pickMoreUrgentStage(fk, emailMatch)
        : (fk ?? emailMatch)
      const contactSignal = contactMap.get(p.id) || null
      const assessment = deriveRisk({ trialStage, badges, contactSignal })
      if (assessment.riskLevel !== 'healthy') nonHealthy++
    }
    return nonHealthy
  } catch {
    return 0
  }
}

/**
 * Attendance Risks — calls the SAME `deriveAttendanceRisk` function the
 * Players page calls per row. We replicate the input set:
 *   • attendance history (last 365d)
 *   • enrolment status + earliest active enrolled_at
 */
async function countAttendanceRisks(supabase: SupabaseClient, orgId: string): Promise<number> {
  try {
    const { data: players } = await supabase
      .from('players')
      .select('id, enrolments(status, enrolled_at)')
      .eq('organisation_id', orgId)
    if (!players || players.length === 0) return 0

    const activePlayers = players.filter(p => (p.enrolments || []).some(e => (e.status || '') === 'active'))
    if (activePlayers.length === 0) return 0

    const playerIds = activePlayers.map(p => p.id)
    const yearAgoIso = new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10)
    const { data: att } = await supabase
      .from('attendance')
      .select('player_id, session_date, present')
      .in('player_id', playerIds)
      .gte('session_date', yearAgoIso)
    const histByPlayer = new Map<string, Array<{ session_date: string; present: boolean }>>()
    for (const r of (att || []) as Array<{ player_id: string; session_date: string; present: boolean }>) {
      const arr = histByPlayer.get(r.player_id) || []
      arr.push({ session_date: r.session_date, present: r.present })
      histByPlayer.set(r.player_id, arr)
    }

    let count = 0
    for (const p of activePlayers) {
      const activeEnrolments = (p.enrolments || []).filter(e => (e.status || '') === 'active')
      const earliestEnrolledAt = activeEnrolments.map(e => e.enrolled_at).filter((v): v is string => !!v).sort()[0] || null
      const a = deriveAttendanceRisk({
        attendanceHistory: histByPlayer.get(p.id) || [],
        enrolmentStatus: 'active',
        enrolledAt: earliestEnrolledAt,
      })
      if (a.riskLevel === 'high' || a.riskLevel === 'medium') count++
    }
    return count
  } catch {
    return 0
  }
}

/**
 * Reviews Due — DISTINCT active enrolled players whose latest progress_
 * reviews row is null OR > 30 days old. Mirrors the existing
 * PlayersNeedingAttention 'overdue_review' check and players-derive's
 * `deriveReviewDue` 30-day threshold.
 */
async function countReviewsDue(supabase: SupabaseClient, orgId: string): Promise<number> {
  try {
    // 1) Active enrolled players in this org.
    const { data: enrolPlayers } = await supabase
      .from('enrolments')
      .select('player_id')
      .eq('organisation_id', orgId)
      .eq('status', 'active')
    if (!enrolPlayers || enrolPlayers.length === 0) return 0
    const playerIds = [...new Set(enrolPlayers.map(e => e.player_id).filter((v): v is string => !!v))]
    if (playerIds.length === 0) return 0

    // 2) Latest review date per player.
    const { data: revs } = await supabase
      .from('progress_reviews')
      .select('player_id, review_date')
      .in('player_id', playerIds)
      .order('review_date', { ascending: false })
    const latestByPlayer = new Map<string, string>()
    for (const r of (revs || []) as Array<{ player_id: string; review_date: string }>) {
      if (!latestByPlayer.has(r.player_id)) latestByPlayer.set(r.player_id, r.review_date)
    }

    // 3) Apply deriveReviewDue (same 30-day threshold the badges use).
    let count = 0
    for (const pid of playerIds) {
      if (deriveReviewDue(latestByPlayer.get(pid) || null)) count++
    }
    return count
  } catch {
    return 0
  }
}

