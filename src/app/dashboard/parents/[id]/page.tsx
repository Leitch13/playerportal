/**
 * Parent Detail Page — /dashboard/parents/{id}
 *
 * The single source of truth for an academy owner managing a family.
 * Brings together the parent profile + children + read-only billing
 * health + family insights + a communication shortcut row.
 *
 * Read-only across the board. NO Stripe API call, NO webhook, NO write,
 * NO new billing or messaging code. Subscription and payment data are
 * surfaced from the existing tables only.
 *
 * Org-scoping is explicit on every query (defence-in-depth).
 */
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import FamilyInsightsBar from './FamilyInsightsBar'
import ChildrenTable, { type ChildRow } from './ChildrenTable'
import CommunicationPanel from './CommunicationPanel'
import {
  deriveAge,
  deriveActiveClassNames,
  deriveRowStatus,
  deriveSubStatus,
  summariseAttendance,
  daysSinceIso,
  type AttendanceRow,
} from '@/lib/players-derive'
import {
  deriveFamilyBadges,
  deriveFamilyBillingStatus,
  deriveFamilyValue,
  deriveLastPaidPayment,
  type FamilyChild,
} from '@/lib/family-derive'
// Phase 2.4 — trial follow-up surfaces. Match THIS parent against the org's
// follow-up cohort. FK first (enrolment-source), email-exact second (booking-
// source, only when the email matches THIS parent's email). The badge is
// appended to the existing FamilyInsightsBar — no new section.
import { loadTrialFollowUpRows } from '@/lib/trial-followups-loader'
import { deriveTrialFollowUpBadge, pickMoreUrgentStage, type TrialStage } from '@/lib/trial-derive'
// Phase 2.5 — Last Contacted signal for the CommunicationPanel stats.
import { loadLastContactedMap } from '@/lib/contact-loader'
// Phase 2.6 — At-Risk rollup + banner. Display-only.
import { deriveRisk } from '@/lib/at-risk-derive'
import AtRiskBanner from './AtRiskBanner'

export default async function ParentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: parentId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')

  const { data: orgId } = await supabase.rpc('get_my_org')
  if (!orgId) redirect('/dashboard')

  // ── 1. Parent profile (org-scoped to defend against cross-tenant URL guesses) ──
  const { data: parentProfile } = await supabase
    .from('profiles')
    .select(`
      id, full_name, email, phone, address,
      secondary_contact_name, secondary_contact_phone, notes, created_at
    `)
    .eq('id', parentId)
    .eq('organisation_id', orgId)
    .eq('role', 'parent')
    .maybeSingle()

  if (!parentProfile) notFound()

  // ── 2. Children belonging to this parent + their enrolments + groups ──
  const { data: childrenRaw } = await supabase
    .from('players')
    .select(`
      id, first_name, last_name, photo_url, date_of_birth, created_at,
      enrolments(status, is_trial, trial_expires_at, activates_on, group:training_groups(name))
    `)
    .eq('organisation_id', orgId)
    .eq('parent_id', parentId)
    .order('first_name')

  const children = (childrenRaw || []) as unknown as Array<{
    id: string
    first_name: string
    last_name: string
    photo_url: string | null
    date_of_birth: string | null
    created_at: string
    enrolments: Array<{ status: string | null; is_trial: boolean | null; trial_expires_at: string | null; activates_on: string | null; group: { name: string } | null }> | null
  }>
  const childIds = children.map(c => c.id)

  // ── 3. Subscriptions for this parent (READ-ONLY: status + plan amount) ──
  const { data: subsRows } = await supabase
    .from('subscriptions')
    .select('id, player_id, parent_id, status, plan:subscription_plans(name, amount)')
    .eq('organisation_id', orgId)
    .eq('parent_id', parentId)

  // ── 4. Payments for this parent (READ-ONLY) ──
  const { data: paymentsRows } = await supabase
    .from('payments')
    .select('amount, amount_paid, status, paid_date, plan:subscription_plans(name)')
    .eq('organisation_id', orgId)
    .eq('parent_id', parentId)
    .order('paid_date', { ascending: false, nullsFirst: false })
    .limit(50)

  // ── 5. Attendance window (30d) for children ──
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

  // ── 6. Latest review per child ──
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

  // ── 7. Message count for the "Open conversation" button (READ-ONLY) ──
  // Counts messages where this parent is sender OR recipient within the org.
  // No body fetched — count only, per the scope adjustment.
  let messageCount = 0
  try {
    const { count } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('organisation_id', orgId)
      .or(`sender_id.eq.${parentId},recipient_id.eq.${parentId}`)
    messageCount = count ?? 0
  } catch {
    messageCount = 0
  }

  // ── 8. Sibling-discount eligibility (org setting only — READ-ONLY) ──
  let siblingDiscountEnabled = false
  try {
    const { data: orgInfo } = await supabase
      .from('organisations')
      .select('sibling_discount_enabled')
      .eq('id', orgId)
      .maybeSingle()
    siblingDiscountEnabled = !!(orgInfo as { sibling_discount_enabled?: boolean } | null)?.sibling_discount_enabled
  } catch { /* defaults to false */ }

  // ── 9. Per-child derivation ──
  const subsByChild = new Map<string, Array<{ status: string | null }>>()
  for (const s of (subsRows || []) as Array<{ player_id: string | null; status: string | null }>) {
    if (!s.player_id) continue
    const list = subsByChild.get(s.player_id) || []
    list.push({ status: s.status })
    subsByChild.set(s.player_id, list)
  }

  const childRows: ChildRow[] = children.map(c => {
    const att = attendanceSummary.get(c.id)
    return {
      id: c.id,
      first_name: c.first_name,
      last_name: c.last_name,
      photo_url: c.photo_url,
      rowStatus: deriveRowStatus(c.enrolments),
      subStatus: deriveSubStatus(subsByChild.get(c.id) || null),
      className: deriveActiveClassNames(c.enrolments),
      attendancePct: att?.pct ?? null,
      lastAttendanceDays: att ? daysSinceIso(att.lastDateIso) : null,
    }
  })

  // ── 10. Family roll-ups ──
  const familyChildren: FamilyChild[] = children.map(c => ({
    id: c.id,
    enrolments: c.enrolments,
    subscriptions: subsByChild.get(c.id) || null,
    lastAttendanceDays: (() => {
      const a = attendanceSummary.get(c.id)
      return a ? daysSinceIso(a.lastDateIso) : null
    })(),
    latestReviewDateIso: latestReviewByChild.get(c.id) || null,
  }))

  const allSubsForValue = (subsRows || []).map(s => ({
    status: s.status,
    plan: s.plan as { amount?: number | null } | null,
  })) as Array<{ status: string | null; plan: { amount?: number | null } | null }>

  const familyValue = deriveFamilyValue(allSubsForValue)
  const familyStatus = deriveFamilyBillingStatus((subsRows || []).map(s => ({ status: s.status })))
  const lastPaid = deriveLastPaidPayment(paymentsRows as Parameters<typeof deriveLastPaidPayment>[0])
  const badges = deriveFamilyBadges({
    children: familyChildren,
    childCount: children.length,
    siblingDiscountEnabled,
  })

  // ── Phase 2.4 — Trial follow-up badge for THIS family ──
  // Loader runs against the WHOLE org and we filter to rows belonging to
  // this parent. We accept either match:
  //   • parentId match (enrolment-source)
  //   • parent_email exact match (booking-source) ONLY if the email matches
  //     THIS parent's profile email — never fuzzy.
  // pickMoreUrgentStage keeps the rose 'stale' tone when both sources exist.
  const followUpRows = await loadTrialFollowUpRows(supabase, orgId).catch(() => [])
  const myEmail = (parentProfile.email || '').trim().toLowerCase()
  let myFollowUpStage: TrialStage | null = null
  for (const f of followUpRows) {
    let match = false
    if (f.parentId && f.parentId === parentId) match = true
    else if (!f.parentId && f.parentEmail && myEmail && f.parentEmail.trim().toLowerCase() === myEmail) match = true
    if (!match) continue
    myFollowUpStage = myFollowUpStage
      ? pickMoreUrgentStage(myFollowUpStage, f.stage)
      : f.stage
  }
  if (myFollowUpStage) {
    const fbadge = deriveTrialFollowUpBadge(myFollowUpStage)
    if (fbadge) badges.push(fbadge)
  }

  // ── Phase 2.5 — Last Contacted signal for THIS parent ──
  const contactMap = await loadLastContactedMap(supabase, [parentId]).catch(() => new Map())
  const contactSignal = contactMap.get(parentId) || null

  // ── Phase 2.6 — At-Risk rollup for THIS family ──
  // Pure derive — no DB call. Same inputs the Parents-list page computes.
  const riskAssessment = deriveRisk({
    trialStage: myFollowUpStage,
    badges,
    contactSignal,
  })
  const activeSubsCount = (subsRows || []).filter(s => s.status === 'active' || s.status === 'trialing').length

  // ── 11. Compute display strings ──
  const joinedLabel = parentProfile.created_at
    ? new Date(parentProfile.created_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
    : '—'

  const familyChip = familyStatus === 'healthy'      ? { label: 'Healthy',       cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', emoji: '🟢' }
                   : familyStatus === 'payment_issue' ? { label: 'Payment Issue', cls: 'bg-rose-500/15 text-rose-300 border-rose-500/30',            emoji: '⚠️' }
                   : familyStatus === 'pending_start' ? { label: 'Pending Start', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30',         emoji: '⏳' }
                   :                                    { label: 'No subscription', cls: 'bg-white/[0.04] text-white/50 border-white/[0.10]',       emoji: '·'  }

  return (
    <div className="bg-[#0a0a0a] -m-6 lg:-m-8 p-6 lg:p-8 min-h-screen text-white">
      <div className="space-y-6">
        {/* ── Breadcrumb ── */}
        <div className="text-xs text-white/40">
          <Link href="/dashboard/parents" className="hover:text-white/70">← Parents</Link>
          <span className="mx-1.5">/</span>
          <span className="text-white/60">{parentProfile.full_name || 'Family'}</span>
        </div>

        {/* ── Phase 2.6 — At-Risk banner (display only). Renders nothing
              for healthy families so the page chrome doesn't shift. ── */}
        <AtRiskBanner assessment={riskAssessment} />

        {/* ── Family Summary ── */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-white">{parentProfile.full_name || 'Parent'}</h1>
              <p className="text-sm text-white/60 mt-1">
                {children.length} {children.length === 1 ? 'child' : 'children'}
                {familyValue > 0 && <> · £{familyValue.toFixed(0)}/month</>}
                {activeSubsCount > 0 && <> · {activeSubsCount} active subscription{activeSubsCount === 1 ? '' : 's'}</>}
                {joinedLabel !== '—' && <> · Member since {joinedLabel}</>}
              </p>
            </div>
            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border ${familyChip.cls}`}>
              <span aria-hidden>{familyChip.emoji}</span>{familyChip.label}
            </span>
          </div>

          {(parentProfile.email || parentProfile.phone || parentProfile.address || parentProfile.secondary_contact_name || parentProfile.notes) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 pt-2 border-t border-white/[0.06] text-xs text-white/60">
              {parentProfile.email && <div><span className="text-white/40">Email:</span> <a className="text-[#4ecde6] hover:underline" href={`mailto:${parentProfile.email}`}>{parentProfile.email}</a></div>}
              {parentProfile.phone && <div><span className="text-white/40">Phone:</span> {parentProfile.phone}</div>}
              {parentProfile.address && <div className="sm:col-span-2"><span className="text-white/40">Address:</span> {parentProfile.address}</div>}
              {parentProfile.secondary_contact_name && (
                <div className="sm:col-span-2"><span className="text-white/40">Alt contact:</span> {parentProfile.secondary_contact_name}{parentProfile.secondary_contact_phone ? ` · ${parentProfile.secondary_contact_phone}` : ''}</div>
              )}
              {parentProfile.notes && <div className="sm:col-span-2 italic"><span className="text-white/40 not-italic">Notes:</span> {parentProfile.notes}</div>}
            </div>
          )}
        </div>

        {/* ── Family Insights badges (only if any) ── */}
        <FamilyInsightsBar badges={badges} />

        {/* ── Billing Health (READ-ONLY) ── */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-white/60 mb-3">Billing health</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-white/40">Status</div>
              <div className="mt-1">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${familyChip.cls}`}>
                  <span aria-hidden>{familyChip.emoji}</span>{familyChip.label}
                </span>
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-white/40">Last successful payment</div>
              {lastPaid ? (
                <div className="mt-1 text-white">
                  <span className="font-semibold tabular-nums">£{lastPaid.amount.toFixed(2)}</span>
                  <span className="text-white/50"> · {new Date(lastPaid.dateIso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  <div className="text-[11px] text-white/40 mt-0.5 truncate" title={lastPaid.label}>{lastPaid.label}</div>
                </div>
              ) : (
                <div className="mt-1 text-white/40 text-xs">No payments recorded</div>
              )}
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-white/40">Family monthly value</div>
              <div className="mt-1 text-white font-semibold tabular-nums">{familyValue > 0 ? `£${familyValue.toFixed(2)}` : '—'}</div>
            </div>
          </div>
        </div>

        {/* ── Children ── */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-white/60 mb-3">Children ({children.length})</h3>
          <ChildrenTable rows={childRows} />
        </div>

        {/* ── Communication ── */}
        <CommunicationPanel
          parentId={parentProfile.id}
          parentEmail={parentProfile.email}
          parentPhone={parentProfile.phone}
          messageCount={messageCount}
          contactSignal={contactSignal}
        />
      </div>
    </div>
  )
}
