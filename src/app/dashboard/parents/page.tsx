/**
 * Parents List v2 — server-side data load + page chrome.
 *
 * Phase 2.3a transforms the page into the academy owner's family
 * management hub. Three new components compose the body:
 *   - ParentsInsightsBar      (4 tiles, no MRR surfaced per spec)
 *   - AtRiskSection           (only when filter=all AND ≥1 at-risk family)
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
import AtRiskSection from './AtRiskSection'
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
  // Renders only when the current filter is "all" AND there's something
  // actionable to surface (otherwise the chips already isolate the cohort).
  const atRiskAll = tableRows.filter(r => needsAttention(r))
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
              <AtRiskSection families={atRiskAll} totalCount={atRiskAll.length} />
            )}
            <ParentsTable rows={tableRows} />
          </>
        )}
      </div>
    </div>
  )
}
