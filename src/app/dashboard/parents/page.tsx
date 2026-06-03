/**
 * Parents List v2 — server-side data load + page chrome.
 *
 * Phase 2.3a transforms the page into the academy owner's family
 * management hub. Three new components compose the body:
 *   - ParentsInsightsBar      (4 tiles, no MRR surfaced per spec)
 *   - FamiliesRequiringAttention (Phase 2.6 — grouped High/Medium)
 *   - ParentsTable            (client — search / filter / sort / actions)
 *
 * Read-only across the board. Subscriptions, payments, attendance,
 * reviews — all SELECTs. No Stripe SDK call, no webhook touched, no
 * email send, no cron contact. The existing `ParentProfileEditor`
 * modal is kept as-is and surfaced in the new table.
 *
 * Every query is explicitly org-scoped + parent-role-filtered for
 * defence-in-depth (RLS plus belt).
 */
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import EmptyState from '@/components/EmptyState'
import ParentsInsightsBar from './ParentsInsightsBar'
import ParentsTable, { type ParentsTableRow } from './ParentsTable'
// Phase 2.6 — Families Requiring Attention (grouped High/Medium). Replaces
// the prior single-tone AtRiskSection.
import FamiliesRequiringAttention from './FamiliesRequiringAttention'
import {
  deriveFamilyValue,
  deriveFamilyBillingStatus,
  deriveFamilyBadges,
  type FamilyChild,
} from '@/lib/family-derive'
import {
  summariseAttendance,
  daysSinceIso,
  type AttendanceRow,
} from '@/lib/players-derive'
import { needsAttention } from '@/lib/parents-derive'
// Phase 2.4: trial follow-up loader (same contract as the Enrolments page).
// Reused verbatim — derivation logic lives in trial-derive.ts.
import { loadTrialFollowUpRows } from '@/lib/trial-followups-loader'
import { deriveTrialFollowUpBadge, pickMoreUrgentStage, type TrialStage } from '@/lib/trial-derive'
// Phase 2.5 — Last Contacted signal. Same loader/derive split as Phase 2.4:
// I/O lives in contact-loader; the derive layer never queries.
import { loadLastContactedMap } from '@/lib/contact-loader'
// Phase 2.6 — At-Risk family rollup. Pure derive layer that consumes the
// existing trial / contact / family-badge derive modules' outputs.
import { deriveRisk } from '@/lib/at-risk-derive'

// Cap defensively at 500 families per render. Above this → Phase 2.3b paginates.
const ROW_CAP = 500

export default async function ParentsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string; sort?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')

  // CRITICAL: scope every query to the current admin's own org.
  const { data: orgId } = await supabase.rpc('get_my_org')
  if (!orgId) redirect('/dashboard')

  // ─── Read sibling-discount toggle (used only to decide whether the
  //     'sibling_eligible' badge fires; READ-ONLY) ─────────────────────
  let siblingDiscountEnabled = false
  try {
    const { data: orgInfo } = await supabase
      .from('organisations')
      .select('sibling_discount_enabled')
      .eq('id', orgId)
      .maybeSingle()
    siblingDiscountEnabled = !!(orgInfo as { sibling_discount_enabled?: boolean } | null)?.sibling_discount_enabled
  } catch { /* defaults to false */ }

  // ─── 1. Parents (profiles with role='parent') ────────────────────────
  const { data: parents } = await supabase
    .from('profiles')
    .select(`
      id, full_name, email, phone, address,
      secondary_contact_name, secondary_contact_phone, notes, created_at
    `)
    .eq('organisation_id', orgId)
    .eq('role', 'parent')
    .order('full_name')
    .limit(ROW_CAP)

  type ParentProfile = {
    id: string
    full_name: string | null
    email: string | null
    phone: string | null
    address: string | null
    secondary_contact_name: string | null
    secondary_contact_phone: string | null
    notes: string | null
    created_at: string
  }
  const parentList = (parents || []) as ParentProfile[]
  const parentIds = parentList.map(p => p.id)

  // ─── 2. Players for these parents (with enrolments+group joined) ─────
  const { data: childrenRaw } = parentIds.length > 0
    ? await supabase
        .from('players')
        .select(`
          id, first_name, last_name, parent_id,
          enrolments(status, is_trial, trial_expires_at, activates_on, group:training_groups(name))
        `)
        .eq('organisation_id', orgId)
        .in('parent_id', parentIds)
    : { data: [] }

  const children = (childrenRaw || []) as unknown as Array<{
    id: string
    first_name: string
    last_name: string
    parent_id: string
    enrolments: Array<{ status: string | null; is_trial: boolean | null; trial_expires_at: string | null; activates_on: string | null; group: { name: string } | null }> | null
  }>
  const childrenByParent = new Map<string, typeof children>()
  for (const c of children) {
    const list = childrenByParent.get(c.parent_id) || []
    list.push(c)
    childrenByParent.set(c.parent_id, list)
  }

  // ─── 3. Subscriptions per parent (READ ONLY — status + plan amount) ──
  const { data: subsRows } = parentIds.length > 0
    ? await supabase
        .from('subscriptions')
        .select('parent_id, player_id, status, plan:subscription_plans(name, amount)')
        .eq('organisation_id', orgId)
        .in('parent_id', parentIds)
    : { data: [] }

  type SubRow = { parent_id: string | null; player_id: string | null; status: string | null; plan: { name?: string | null; amount?: number | null } | null }
  const subsByParent = new Map<string, SubRow[]>()
  const subsByChild  = new Map<string, Array<{ status: string | null }>>()
  for (const s of (subsRows || []) as SubRow[]) {
    if (s.parent_id) {
      const a = subsByParent.get(s.parent_id) || []
      a.push(s)
      subsByParent.set(s.parent_id, a)
    }
    if (s.player_id) {
      const a = subsByChild.get(s.player_id) || []
      a.push({ status: s.status })
      subsByChild.set(s.player_id, a)
    }
  }

  // ─── 4. 30-day attendance window for ALL children ────────────────────
  const childIds = children.map(c => c.id)
  let attendanceSummary = new Map<string, ReturnType<typeof summariseAttendance> extends Map<string, infer V> ? V : never>()
  if (childIds.length > 0) {
    const thirtyDaysAgoIso = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)
    const { data: attRows } = await supabase
      .from('attendance')
      .select('player_id, session_date, present')
      .in('player_id', childIds)
      .gte('session_date', thirtyDaysAgoIso)
    attendanceSummary = summariseAttendance((attRows || []) as AttendanceRow[])
  }

  // ─── 5. Latest review per child ──────────────────────────────────────
  const latestReviewByChild = new Map<string, string>()
  if (childIds.length > 0) {
    const { data: reviewRows } = await supabase
      .from('progress_reviews')
      .select('player_id, review_date')
      .in('player_id', childIds)
      .order('review_date', { ascending: false })
    for (const r of (reviewRows || []) as Array<{ player_id: string; review_date: string }>) {
      if (!latestReviewByChild.has(r.player_id)) latestReviewByChild.set(r.player_id, r.review_date)
    }
  }

  // ─── 5a. Phase 2.5 — Last Contacted signal per parent ────────────────
  // Reads BOTH messaging systems (legacy public.messages + new
  // public.conversation_messages) in parallel and maxes the latest. Failure
  // swallowed inside the loader → empty map; the page never crashes.
  // READ-ONLY. No writes. No Stripe / cron / email touched.
  const contactSignalByParent = await loadLastContactedMap(supabase, parentIds).catch(() => new Map())

  // ─── 5b. Phase 2.4 — Trial follow-up cohort + parent lookup maps ─────
  // Reuses the same loader as the Enrolments page. READ-ONLY. Failure is
  // swallowed (returns []) so a Postgrest hiccup never blocks the table.
  //
  // Two lookup paths:
  //   1. parentId       — for enrolment-source follow-up rows (have FK)
  //   2. parent email   — for booking-source rows (no FK; user-approved
  //                       email match where safe)
  //
  // Booking rows that don't match any parent profile by either path are
  // DROPPED here — they continue to surface in /dashboard/enrolments and
  // /dashboard/trials but never become a fuzzy family-row link.
  const trialFollowUps = await loadTrialFollowUpRows(supabase, orgId).catch(() => [])

  const followUpStageByParentId = new Map<string, TrialStage>()
  const followUpStageByEmail   = new Map<string, TrialStage>()

  for (const f of trialFollowUps) {
    if (f.parentId) {
      // Enrolment-source row — match on FK.
      const prev = followUpStageByParentId.get(f.parentId)
      followUpStageByParentId.set(
        f.parentId,
        prev ? pickMoreUrgentStage(prev, f.stage) : f.stage,
      )
    } else if (f.parentEmail) {
      // Booking-source row — exact lower-cased email match. If no parent
      // profile owns this email, the row is silently dropped on this page
      // (it remains visible on the Enrolments / Trials pages).
      const key = f.parentEmail.trim().toLowerCase()
      if (key) {
        const prev = followUpStageByEmail.get(key)
        followUpStageByEmail.set(key, prev ? pickMoreUrgentStage(prev, f.stage) : f.stage)
      }
    }
    // else: no FK + no email — booking row has no identifying handle; it
    // can only be triaged via the Enrolments / Trials surfaces.
  }

  // ─── 6. Per-family row construction ──────────────────────────────────
  const tableRows: ParentsTableRow[] = parentList.map(p => {
    const kids = childrenByParent.get(p.id) || []
    const parentSubs = subsByParent.get(p.id) || []
    const familyChildren: FamilyChild[] = kids.map(c => {
      const att = attendanceSummary.get(c.id)
      return {
        id: c.id,
        enrolments: c.enrolments,
        subscriptions: subsByChild.get(c.id) || null,
        lastAttendanceDays: att ? daysSinceIso(att.lastDateIso) : null,
        latestReviewDateIso: latestReviewByChild.get(c.id) || null,
      }
    })

    const familyValue = deriveFamilyValue(
      parentSubs.map(s => ({ status: s.status, plan: s.plan as { amount?: number | null } | null })),
    )
    const billingStatus = deriveFamilyBillingStatus(parentSubs.map(s => ({ status: s.status })))
    const badges = deriveFamilyBadges({
      children: familyChildren,
      childCount: kids.length,
      siblingDiscountEnabled,
    })

    // ─── Phase 2.4 — attach trial follow-up badge if the family matches ──
    //   Match priority:
    //     1. parentId match (enrolment-source follow-up rows)
    //     2. email match    (booking-source — exact, case-insensitive)
    //   The badge reflects the MORE URGENT stage across both sources for
    //   this family. Booking rows that don't match any profile here are
    //   simply not surfaced on this page — they remain visible on the
    //   Enrolments / Trials pages (per spec rule 4).
    const followUpFromFk = followUpStageByParentId.get(p.id) ?? null
    const followUpFromEmail = p.email
      ? followUpStageByEmail.get(p.email.trim().toLowerCase()) ?? null
      : null
    let trialFollowUpStage: TrialStage | null = null
    if (followUpFromFk && followUpFromEmail) {
      trialFollowUpStage = pickMoreUrgentStage(followUpFromFk, followUpFromEmail)
    } else {
      trialFollowUpStage = followUpFromFk ?? followUpFromEmail
    }
    if (trialFollowUpStage) {
      const badge = deriveTrialFollowUpBadge(trialFollowUpStage)
      if (badge) badges.push(badge)
    }

    // ── Phase 2.6 — At-Risk rollup for THIS family ──
    // Pure derive over the already-computed signals. No DB call here.
    const contactSignal = contactSignalByParent.get(p.id) || null
    const riskAssessment = deriveRisk({
      trialStage: trialFollowUpStage,
      badges,
      contactSignal,
    })

    return {
      id: p.id,
      parentName: p.full_name || '(unnamed)',
      parentEmail: p.email,
      parentPhone: p.phone,
      childCount: kids.length,
      childrenNames: kids.map(c => `${c.first_name} ${c.last_name}`.trim()),
      familyValue,
      billingStatus,
      badges,
      joinedAtIso: p.created_at,
      // Phase 2.5 — attach the rolled-up contact signal. null when the
      // parent has no record in either messaging system.
      contactSignal,
      // Phase 2.6 — At-Risk rollup. Derived above from trial / contact /
      // badge signals; consumed by the new chip filters + the Families
      // Requiring Attention section.
      riskAssessment,
      editor: {
        id: p.id,
        // ParentProfileEditor's existing prop contract expects a non-null
        // string here. Coerce null → '' to keep the editor working without
        // touching its public API.
        full_name: p.full_name || '',
        phone: p.phone,
        address: p.address,
        secondary_contact_name: p.secondary_contact_name,
        secondary_contact_phone: p.secondary_contact_phone,
        notes: p.notes,
      },
    }
  })

  // ─── 7. Insights counts (org-wide totals, NOT filtered view-bound) ───
  const counts = {
    total:          tableRows.length,
    healthy:        tableRows.filter(r => r.billingStatus === 'healthy').length,
    paymentIssues:  tableRows.filter(r => r.billingStatus === 'payment_issue').length,
    needsAttention: tableRows.filter(r => needsAttention(r)).length,
  }

  // ─── 8. At-risk subset for the inline section ─────────────────────────
  // Renders only when the current filter is "all" AND there's at least one
  // High or Medium risk family to surface. Phase 2.6 grouped by tier.
  const atRiskAll = tableRows.filter(r =>
    r.riskAssessment && r.riskAssessment.riskLevel !== 'healthy',
  )
  const filterIsAll = !params.filter || params.filter === 'all'
  const showAtRiskSection = filterIsAll && atRiskAll.length > 0

  return (
    <div className="bg-[#0a0a0a] -m-6 lg:-m-8 p-6 lg:p-8 min-h-screen text-white">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Parents</h1>

        <ParentsInsightsBar counts={counts} />

        {tableRows.length === 0 ? (
          <EmptyState message="No parents registered yet." />
        ) : (
          <>
            {showAtRiskSection && (
              <FamiliesRequiringAttention families={atRiskAll} />
            )}
            <ParentsTable rows={tableRows} />
          </>
        )}
      </div>
    </div>
  )
}
