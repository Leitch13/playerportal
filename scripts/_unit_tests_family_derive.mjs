/**
 * Tests for src/lib/family-derive.ts — pure helpers for the Parent Detail
 * page (Phase 2.2). Re-implements each helper in vanilla JS so the tests
 * run without a TS compile step.
 *
 * Run with:  node scripts/_unit_tests_family_derive.mjs
 */

const NOW = Date.UTC(2026, 5, 2) // 2026-06-02 stable test clock

// ─── Re-implementations (kept in sync with src/lib/family-derive.ts) ──
function deriveSubStatus(subscriptions) {
  if (!subscriptions || subscriptions.length === 0) return 'none'
  const set = new Set(subscriptions.map(s => (s.status || '').toLowerCase()))
  if (set.has('past_due')) return 'past_due'
  if (set.has('active') || set.has('trialing')) return 'active'
  if (set.has('scheduled')) return 'pending'
  return 'cancelled'
}
function deriveRowStatus(enrolments) {
  if (!enrolments || enrolments.length === 0) return 'inactive'
  if (enrolments.some(e => (e.status || '') === 'active' && !e.is_trial)) return 'active'
  if (enrolments.some(e => e.is_trial && ((e.status || '') === 'active' || (e.status || '') === 'pending'))) return 'trial'
  if (enrolments.some(e => (e.status || '') === 'pending')) return 'pending'
  if (enrolments.some(e => (e.status || '') === 'paused')) return 'paused'
  return 'inactive'
}

function deriveFamilyValue(subs) {
  if (!subs) return 0
  return subs.reduce((sum, s) => {
    if (s.status !== 'active' && s.status !== 'trialing') return sum
    const a = Number(s.plan?.amount ?? 0)
    if (isNaN(a) || a <= 0) return sum
    return sum + a
  }, 0)
}

function deriveLastPaidPayment(payments) {
  if (!payments || payments.length === 0) return null
  const paid = payments
    .filter(p => (p.status || '').toLowerCase() === 'paid' && p.paid_date)
    .sort((a, b) => (b.paid_date || '').localeCompare(a.paid_date || ''))
  if (paid.length === 0) return null
  const top = paid[0]
  const label = top.description?.trim() || top.plan?.name?.trim() || 'Payment'
  return { amount: Number(top.amount_paid ?? 0) || 0, dateIso: top.paid_date, label }
}

function deriveFamilyBillingStatus(subs) {
  if (!subs || subs.length === 0) return 'none'
  const set = new Set(subs.map(s => (s.status || '').toLowerCase()))
  if (set.has('past_due')) return 'payment_issue'
  if (set.has('active') || set.has('trialing')) return 'healthy'
  if (set.has('scheduled')) return 'pending_start'
  return 'none'
}

function deriveFamilyBadges(opts) {
  const out = []
  const now = opts.nowMs ?? Date.now()
  const sevenDaysMs = 7 * 86_400_000

  if (opts.children.some(c => deriveSubStatus(c.subscriptions) === 'past_due')) {
    out.push({ key: 'payment_issue', label: 'Payment issue', tone: 'rose', emoji: '⚠️' })
  }

  let date = null
  const pendingChild = opts.children.find(c =>
    deriveRowStatus(c.enrolments) === 'pending' || deriveSubStatus(c.subscriptions) === 'pending',
  )
  if (pendingChild) {
    for (const c of opts.children) {
      for (const e of c.enrolments || []) {
        if ((e.status || '') === 'pending' && e.activates_on) { date = e.activates_on; break }
      }
      if (date) break
    }
    out.push({ key: 'pending_start', label: date ? `Pending start: ${date}` : 'Pending start', tone: 'amber', emoji: '⏳' })
  }

  const trialSoon = opts.children.some(c =>
    (c.enrolments || []).some(e =>
      e.is_trial && e.trial_expires_at && (() => {
        const t = new Date(e.trial_expires_at).getTime()
        if (isNaN(t)) return false
        return t - now <= sevenDaysMs && t >= now
      })(),
    ),
  )
  if (trialSoon) out.push({ key: 'trial_expiring', label: 'Trial expiring (7d)', tone: 'sky', emoji: '🔵' })

  const reviewDueCount = opts.children.filter(c => {
    if (!c.latestReviewDateIso) return true
    const t = new Date(c.latestReviewDateIso).getTime()
    if (isNaN(t)) return false
    return now - t > 30 * 86_400_000
  }).length
  if (reviewDueCount > 0) {
    out.push({ key: 'review_due', label: reviewDueCount === 1 ? 'Review due: 1' : `Review due: ${reviewDueCount}`, tone: 'amber', emoji: '📋' })
  }

  const dormantChild = opts.children.some(c => c.lastAttendanceDays === null || c.lastAttendanceDays > 30)
  const hasAnyActiveEnrol = opts.children.some(c => (c.enrolments || []).some(e => (e.status || '') === 'active'))
  if (dormantChild && hasAnyActiveEnrol) {
    out.push({ key: 'no_attendance_30d', label: 'No attendance (30d)', tone: 'amber', emoji: '⏰' })
  }

  if (opts.siblingDiscountEnabled && opts.childCount >= 2) {
    out.push({ key: 'sibling_eligible', label: 'Sibling discount eligible', tone: 'emerald', emoji: '👨‍👩‍👧' })
  }
  return out
}

// ─── Runner ────────────────────────────────────────────────────────────
const results = []
const eq = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want)
  results.push({ name, pass })
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`)
}

console.log('\n──── PHASE 1 — deriveFamilyValue ────')
eq('null → 0', deriveFamilyValue(null), 0)
eq('empty → 0', deriveFamilyValue([]), 0)
eq('active sums', deriveFamilyValue([
  { status: 'active', plan: { amount: 60 } },
  { status: 'active', plan: { amount: 120 } },
]), 180)
eq('trialing counts', deriveFamilyValue([{ status: 'trialing', plan: { amount: 28 } }]), 28)
eq('past_due NOT counted', deriveFamilyValue([
  { status: 'active', plan: { amount: 60 } },
  { status: 'past_due', plan: { amount: 120 } },
]), 60)
eq('cancelled NOT counted', deriveFamilyValue([{ status: 'cancelled', plan: { amount: 60 } }]), 0)
eq('null plan safely zero', deriveFamilyValue([{ status: 'active', plan: null }]), 0)
eq('Negative amount ignored', deriveFamilyValue([{ status: 'active', plan: { amount: -5 } }]), 0)

console.log('\n──── PHASE 2 — deriveLastPaidPayment ────')
eq('null → null', deriveLastPaidPayment(null), null)
eq('empty → null', deriveLastPaidPayment([]), null)
eq('No paid rows → null', deriveLastPaidPayment([{ status: 'pending', paid_date: '2026-05-01' }]), null)
eq('Single paid → returned',
  deriveLastPaidPayment([{ status: 'paid', amount_paid: 60, paid_date: '2026-05-27', plan: { name: '2 x Per Month' } }]),
  { amount: 60, dateIso: '2026-05-27', label: '2 x Per Month' })
eq('Most recent wins',
  deriveLastPaidPayment([
    { status: 'paid', amount_paid: 60, paid_date: '2026-04-01', plan: { name: 'Old' } },
    { status: 'paid', amount_paid: 90, paid_date: '2026-05-27', plan: { name: 'New' } },
  ]),
  { amount: 90, dateIso: '2026-05-27', label: 'New' })
eq('No plan name → "Payment" label',
  deriveLastPaidPayment([{ status: 'paid', amount_paid: 60, paid_date: '2026-05-27' }]),
  { amount: 60, dateIso: '2026-05-27', label: 'Payment' })
eq('Description preferred over plan name',
  deriveLastPaidPayment([{ status: 'paid', amount_paid: 60, paid_date: '2026-05-27', description: 'Camp', plan: { name: 'Mini Ballers' } }]),
  { amount: 60, dateIso: '2026-05-27', label: 'Camp' })

console.log('\n──── PHASE 3 — deriveFamilyBillingStatus ────')
eq('empty → none', deriveFamilyBillingStatus([]), 'none')
eq('past_due wins', deriveFamilyBillingStatus([{ status: 'active' }, { status: 'past_due' }]), 'payment_issue')
eq('active → healthy', deriveFamilyBillingStatus([{ status: 'active' }]), 'healthy')
eq('trialing → healthy', deriveFamilyBillingStatus([{ status: 'trialing' }]), 'healthy')
eq('scheduled only → pending_start', deriveFamilyBillingStatus([{ status: 'scheduled' }]), 'pending_start')
eq('cancelled only → none', deriveFamilyBillingStatus([{ status: 'cancelled' }]), 'none')

console.log('\n──── PHASE 4 — deriveFamilyBadges ────')
// Helper to make a child
const child = (over = {}) => ({
  id: over.id || 'p1',
  enrolments: over.enrolments ?? null,
  subscriptions: over.subscriptions ?? null,
  lastAttendanceDays: over.lastAttendanceDays ?? null,
  latestReviewDateIso: over.latestReviewDateIso ?? null,
})

// Single past_due child → payment_issue badge
{
  const badges = deriveFamilyBadges({
    children: [child({ subscriptions: [{ status: 'past_due' }] })],
    childCount: 1, nowMs: NOW,
  })
  eq('past_due → payment_issue badge present', badges.find(b => b.key === 'payment_issue')?.label, 'Payment issue')
}

// Pending enrolment with date → pending_start badge with date
{
  const badges = deriveFamilyBadges({
    children: [child({ enrolments: [{ status: 'pending', activates_on: '2026-06-15' }] })],
    childCount: 1, nowMs: NOW,
  })
  eq('pending enrolment surfaces date', badges.find(b => b.key === 'pending_start')?.label, 'Pending start: 2026-06-15')
}

// Trial expiring within 7d
{
  const expiry = new Date(NOW + 3 * 86_400_000).toISOString().slice(0, 10) // +3 days
  const badges = deriveFamilyBadges({
    children: [child({ enrolments: [{ status: 'active', is_trial: true, trial_expires_at: expiry }] })],
    childCount: 1, nowMs: NOW,
  })
  eq('trial in 3d → badge', badges.some(b => b.key === 'trial_expiring'), true)
}

// Trial expiring in 30d (NOT within 7d) → no badge
{
  const expiry = new Date(NOW + 30 * 86_400_000).toISOString().slice(0, 10)
  const badges = deriveFamilyBadges({
    children: [child({ enrolments: [{ status: 'active', is_trial: true, trial_expires_at: expiry }] })],
    childCount: 1, nowMs: NOW,
  })
  eq('trial in 30d → NO badge', badges.some(b => b.key === 'trial_expiring'), false)
}

// Review due count
{
  const badges = deriveFamilyBadges({
    children: [
      child({ id: 'c1', latestReviewDateIso: null }),                 // never reviewed
      child({ id: 'c2', latestReviewDateIso: '2026-05-31' }),          // 2 days ago → fresh
      child({ id: 'c3', latestReviewDateIso: '2025-12-01' }),          // 6 months ago → due
    ],
    childCount: 3, nowMs: NOW,
  })
  eq('review_due count = 2 (never + stale)', badges.find(b => b.key === 'review_due')?.label, 'Review due: 2')
}

// No attendance badge requires an active enrolment somewhere
{
  const dormantChild = child({
    enrolments: [{ status: 'active' }],
    lastAttendanceDays: 45,
  })
  const badges = deriveFamilyBadges({ children: [dormantChild], childCount: 1, nowMs: NOW })
  eq('dormant + active enrolment → no_attendance_30d', badges.some(b => b.key === 'no_attendance_30d'), true)
}

// Dormant but NO active enrolment → no badge (not dormant, just new)
{
  const newChild = child({
    enrolments: [{ status: 'pending' }],
    lastAttendanceDays: null,
  })
  const badges = deriveFamilyBadges({ children: [newChild], childCount: 1, nowMs: NOW })
  eq('null attendance + only pending → NO no_attendance badge', badges.some(b => b.key === 'no_attendance_30d'), false)
}

// Sibling-eligible gating
{
  const ok = deriveFamilyBadges({ children: [child(), child()], childCount: 2, siblingDiscountEnabled: true, nowMs: NOW })
  eq('2 kids + enabled → sibling badge', ok.some(b => b.key === 'sibling_eligible'), true)
  const off = deriveFamilyBadges({ children: [child(), child()], childCount: 2, siblingDiscountEnabled: false, nowMs: NOW })
  eq('2 kids + disabled → no sibling badge', off.some(b => b.key === 'sibling_eligible'), false)
  const solo = deriveFamilyBadges({ children: [child()], childCount: 1, siblingDiscountEnabled: true, nowMs: NOW })
  eq('1 kid + enabled → no sibling badge', solo.some(b => b.key === 'sibling_eligible'), false)
}

// Empty family → empty badges
eq('No children → empty badges', deriveFamilyBadges({ children: [], childCount: 0, nowMs: NOW }), [])

console.log('\n──── SUMMARY ────')
const pass = results.filter(r => r.pass).length
const fail = results.filter(r => !r.pass).length
console.log(`  ${pass} pass / ${fail} fail / ${results.length} total`)
process.exit(fail > 0 ? 1 : 0)
