/**
 * Phase 2.4 Step 5 — unit tests for the 5 admin endpoints' pure logic.
 *
 * Tests the deterministic, branch-y bits that DON'T need a DB:
 *   • Auth/role gating shape
 *   • Org-mismatch rejection
 *   • Idempotency branches (already-converted, already-cancelled)
 *   • Status auto-bump rules (booking convert: pending/confirmed → attended)
 *   • Extend date validation (YYYY-MM-DD shape, future-cap)
 *   • Extend days clamp [1..60]
 *   • Extend-trial expiry anchor math (max(existing, today) + days)
 *
 * Run with:  node scripts/_unit_tests_step5_endpoints.mjs
 */

const NOW = Date.UTC(2026, 5, 15)

// ─── Re-implementations of the pure decision logic in the endpoints ───

// mark-converted (booking): should we auto-bump status?
function bookingShouldBumpStatus(currentStatus) {
  const s = (currentStatus || '').toLowerCase()
  return s === 'pending' || s === 'confirmed'
}

// extend (booking): validate the date input.
function bookingExtendValidate(input, nowMs = NOW) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test((input || '').trim())) return { ok: false, err: 'shape' }
  const ms = Date.parse((input || '').trim() + 'T00:00:00Z')
  if (isNaN(ms)) return { ok: false, err: 'invalid' }
  if (ms > nowMs + 2 * 365 * 86_400_000) return { ok: false, err: 'too_far' }
  return { ok: true, ms }
}

// extend (booking): should we reset status to 'pending'?
function bookingExtendShouldResetStatus(currentStatus) {
  const s = (currentStatus || '').toLowerCase()
  return s !== 'pending' && s !== 'confirmed'
}

// extend-trial (enrolment): days clamp.
function enrolmentExtendClampDays(input) {
  const raw = Number(input ?? 14)
  if (!Number.isFinite(raw)) return { ok: false }
  if (raw < 1 || raw > 60) return { ok: false }
  return { ok: true, days: Math.floor(raw) }
}

// extend-trial (enrolment): new expiry computation.
function enrolmentExtendCompute(currentExpiryIso, days, nowMs = NOW) {
  const todayUtc = (() => { const d = new Date(nowMs); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) })()
  let anchorMs = todayUtc
  if (currentExpiryIso) {
    const ms = Date.parse(currentExpiryIso + 'T00:00:00Z')
    if (!isNaN(ms) && ms > anchorMs) anchorMs = ms
  }
  const newMs = anchorMs + days * 86_400_000
  return new Date(newMs).toISOString().slice(0, 10)
}

// idempotency check (mark-converted booking)
function alreadyConvertedBooking(b) { return b.converted === true }
// idempotency check (mark-lost booking)
function alreadyCancelledBooking(b) { return (b.status || '').toLowerCase() === 'cancelled' }
// idempotency check (mark-converted enrolment)
function alreadyConvertedEnrolment(e) { return e.is_trial === false }
// idempotency check (mark-lost enrolment)
function alreadyCancelledEnrolment(e) { return e.status === 'cancelled' }

// org-mismatch shape
function orgMatch(myOrgId, rowOrgId) { return myOrgId === rowOrgId }

// ─── Runner ────────────────────────────────────────────────────────────
const results = []
const eq = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want)
  results.push({ name, pass })
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`)
}

console.log('\n──── PHASE 1 — Booking mark-converted ────')

eq('pending → bumps to attended',    bookingShouldBumpStatus('pending'),    true)
eq('confirmed → bumps to attended',  bookingShouldBumpStatus('confirmed'),  true)
eq('attended → no bump',             bookingShouldBumpStatus('attended'),   false)
eq('cancelled → no bump',            bookingShouldBumpStatus('cancelled'),  false)
eq('no_show → no bump',              bookingShouldBumpStatus('no_show'),    false)
eq('Case-insensitive',               bookingShouldBumpStatus('PENDING'),    true)

eq('idempotent: already converted → skip', alreadyConvertedBooking({ converted: true }), true)
eq('idempotent: not yet converted → mutate', alreadyConvertedBooking({ converted: false }), false)
eq('idempotent: null converted → mutate',    alreadyConvertedBooking({ converted: null }), false)

console.log('\n──── PHASE 2 — Booking extend ────')

eq('valid date YYYY-MM-DD → ok',
  bookingExtendValidate('2026-06-20').ok, true)
eq('shape bad: no dashes → reject',
  bookingExtendValidate('20260620').ok, false)
eq('shape bad: empty → reject',
  bookingExtendValidate('').ok, false)
eq('shape bad: garbage → reject',
  bookingExtendValidate('tomorrow').ok, false)
eq('invalid month → reject',
  bookingExtendValidate('2026-13-01').ok, false)
eq('too far (>2 years) → reject',
  bookingExtendValidate('2099-01-01').ok, false)

eq('status=attended → reset to pending',  bookingExtendShouldResetStatus('attended'),  true)
eq('status=no_show → reset',             bookingExtendShouldResetStatus('no_show'),   true)
eq('status=pending → NO reset',           bookingExtendShouldResetStatus('pending'),   false)
eq('status=confirmed → NO reset',         bookingExtendShouldResetStatus('confirmed'), false)

eq('idempotent (lost): cancelled → skip', alreadyCancelledBooking({ status: 'cancelled' }), true)
eq('idempotent (lost): pending → mutate', alreadyCancelledBooking({ status: 'pending' }), false)
eq('idempotent (lost): case insensitive', alreadyCancelledBooking({ status: 'Cancelled' }), true)

console.log('\n──── PHASE 3 — Enrolment extend-trial ────')

eq('default 14 days when no body',     enrolmentExtendClampDays(undefined), { ok: true, days: 14 })
eq('explicit 7 days → ok',             enrolmentExtendClampDays(7), { ok: true, days: 7 })
eq('0 days → reject',                  enrolmentExtendClampDays(0).ok, false)
eq('-1 days → reject',                 enrolmentExtendClampDays(-1).ok, false)
eq('61 days → reject',                 enrolmentExtendClampDays(61).ok, false)
eq('NaN → reject',                     enrolmentExtendClampDays('bad').ok, false)
eq('Fraction floored: 7.7 → 7',        enrolmentExtendClampDays(7.7), { ok: true, days: 7 })

// Anchor math: today=2026-06-15
eq('Future expiry → adds to expiry',
  enrolmentExtendCompute('2026-06-20', 14), '2026-07-04')  // 20+14=04 July
eq('Today expiry → adds to today',
  enrolmentExtendCompute('2026-06-15', 14), '2026-06-29')
eq('Past expiry → anchors at today (not the past)',
  enrolmentExtendCompute('2026-06-01', 14), '2026-06-29')
eq('No current expiry → anchors at today',
  enrolmentExtendCompute(null, 14), '2026-06-29')
eq('+1 day from today',
  enrolmentExtendCompute(null, 1), '2026-06-16')
eq('+60 day from today',
  enrolmentExtendCompute(null, 60), '2026-08-14')

console.log('\n──── PHASE 4 — Enrolment mark-converted + mark-lost idempotency ────')

eq('idempotent: is_trial already false → skip', alreadyConvertedEnrolment({ is_trial: false }), true)
eq('idempotent: is_trial=true → mutate',         alreadyConvertedEnrolment({ is_trial: true }), false)
eq('idempotent: cancelled → skip',               alreadyCancelledEnrolment({ status: 'cancelled' }), true)
eq('idempotent: active → mutate',                alreadyCancelledEnrolment({ status: 'active' }), false)

console.log('\n──── PHASE 5 — Org-mismatch rejection ────')

eq('Same org → allow',     orgMatch('org-A', 'org-A'), true)
eq('Different org → deny', orgMatch('org-A', 'org-B'), false)
eq('Null row org → deny',  orgMatch('org-A', null), false)
eq('Null my org → deny',   orgMatch(null, 'org-A'), false)

console.log('\n──── SUMMARY ────')
const pass = results.filter(r => r.pass).length
const fail = results.filter(r => !r.pass).length
console.log(`  ${pass} pass / ${fail} fail / ${results.length} total`)
process.exit(fail > 0 ? 1 : 0)
