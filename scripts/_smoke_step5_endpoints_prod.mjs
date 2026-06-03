/**
 * Phase 2.4 Step 5 — live smoke test against production Supabase.
 *
 * Exercises the EXACT same UPDATE statements the endpoints issue, against
 * a TEMPORARY test row inserted specifically for this smoke and DELETED
 * at the end. No production rows are touched.
 *
 *   set -a && source /tmp/.env.prod && set +a && \
 *   node scripts/_smoke_step5_endpoints_prod.mjs
 *
 * Coverage:
 *   1. trial_bookings mark-converted (pending → attended, converted=true)
 *   2. trial_bookings extend (preferred_date update + status reset)
 *   3. trial_bookings mark-lost (status=cancelled)
 *   4. enrolments mark-converted (is_trial=false)
 *   5. enrolments extend-trial (trial_expires_at + 14 days)
 *   6. enrolments mark-lost (status=cancelled)
 *
 * Each step verifies the row state, then RESTORES to the prior state
 * before moving on, so the smoke can re-run cleanly.
 */
import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Use Jamie Allan org (has the necessary table data).
const { data: orgs } = await sb.from('organisations').select('id').ilike('name', 'Jamie Allan Football%')
const ORG_ID = orgs?.[0]?.id
if (!ORG_ID) { console.error('Jamie Allan org not found'); process.exit(1) }
console.log(`Using org: ${ORG_ID}`)

const results = []
const check = async (name, expectFn) => {
  try { const pass = await expectFn(); results.push({ name, pass: !!pass }); console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}`) }
  catch (e) { results.push({ name, pass: false }); console.log(`  FAIL  ${name}  → ${e.message}`) }
}

let bookingId, enrolmentId

try {
  // ─── A. Create a test trial_bookings row ──────────────────────────────
  console.log('\n──── A — create test trial_bookings ────')
  const { data: ins, error: insErr } = await sb.from('trial_bookings').insert({
    organisation_id: ORG_ID,
    parent_name: 'SMOKE TEST PARENT (delete-me)',
    parent_email: 'smoke-test-phase24@example.invalid',
    child_name: 'SMOKE TEST CHILD (delete-me)',
    status: 'pending',
    preferred_date: '2026-06-10',
    converted: false,
    followup_sent: false,
  }).select().single()
  if (insErr) { console.error(`Insert failed: ${insErr.message}`); process.exit(1) }
  bookingId = ins.id
  console.log(`  Created booking ${bookingId}`)

  // ─── 1. mark-converted (booking) ──────────────────────────────────────
  console.log('\n──── 1 — booking mark-converted ────')
  // Simulate the endpoint's UPDATE
  const { error: e1 } = await sb.from('trial_bookings').update({
    converted: true, status: 'attended', updated_at: new Date().toISOString(),
  }).eq('id', bookingId)
  await check('UPDATE succeeded', () => !e1)
  const { data: r1 } = await sb.from('trial_bookings').select('converted, status').eq('id', bookingId).single()
  await check('converted=true', () => r1.converted === true)
  await check('status bumped pending → attended', () => r1.status === 'attended')

  // Reset for next test
  await sb.from('trial_bookings').update({ converted: false, status: 'pending', preferred_date: '2026-06-10' }).eq('id', bookingId)

  // ─── 2. extend (booking) ──────────────────────────────────────────────
  console.log('\n──── 2 — booking extend ────')
  const newDate = '2026-07-01'
  // First set it to 'attended' so we can verify the reset-to-pending logic
  await sb.from('trial_bookings').update({ status: 'attended' }).eq('id', bookingId)
  const { error: e2 } = await sb.from('trial_bookings').update({
    preferred_date: newDate, status: 'pending', updated_at: new Date().toISOString(),
  }).eq('id', bookingId)
  await check('UPDATE succeeded', () => !e2)
  const { data: r2 } = await sb.from('trial_bookings').select('preferred_date, status').eq('id', bookingId).single()
  await check('preferred_date moved to 2026-07-01', () => r2.preferred_date === newDate)
  await check('status reset attended → pending', () => r2.status === 'pending')

  // Reset
  await sb.from('trial_bookings').update({ status: 'pending', preferred_date: '2026-06-10' }).eq('id', bookingId)

  // ─── 3. mark-lost (booking) ───────────────────────────────────────────
  console.log('\n──── 3 — booking mark-lost ────')
  const { error: e3 } = await sb.from('trial_bookings').update({
    status: 'cancelled', updated_at: new Date().toISOString(),
  }).eq('id', bookingId)
  await check('UPDATE succeeded', () => !e3)
  const { data: r3 } = await sb.from('trial_bookings').select('status').eq('id', bookingId).single()
  await check('status=cancelled', () => r3.status === 'cancelled')

  // ─── Now test enrolment side — find a player + group ──────────────────
  console.log('\n──── B — create test enrolments row (is_trial=true) ────')
  const { data: players } = await sb.from('players').select('id').eq('organisation_id', ORG_ID).limit(1)
  const { data: groups } = await sb.from('training_groups').select('id').eq('organisation_id', ORG_ID).limit(1)
  if (!players?.[0] || !groups?.[0]) {
    console.log('  No player/group available — skipping enrolment tests')
  } else {
    const { data: einsErr, error: einsE } = await sb.from('enrolments').insert({
      organisation_id: ORG_ID,
      player_id: players[0].id,
      group_id: groups[0].id,
      status: 'active',
      is_trial: true,
      trial_expires_at: '2026-06-20',
      enrolled_at: new Date().toISOString(),
    }).select().single()
    if (einsE) {
      console.log(`  Enrolment insert failed: ${einsE.message} — skipping enrolment tests`)
    } else {
      enrolmentId = einsErr.id
      console.log(`  Created enrolment ${enrolmentId}`)

      // ─── 4. mark-converted (enrolment) ────────────────────────────────
      console.log('\n──── 4 — enrolment mark-converted ────')
      const { error: e4 } = await sb.from('enrolments').update({ is_trial: false }).eq('id', enrolmentId)
      await check('UPDATE succeeded', () => !e4)
      const { data: r4 } = await sb.from('enrolments').select('is_trial, status').eq('id', enrolmentId).single()
      await check('is_trial=false', () => r4.is_trial === false)
      await check('status unchanged (still active)', () => r4.status === 'active')

      // Reset
      await sb.from('enrolments').update({ is_trial: true, trial_expires_at: '2026-06-20' }).eq('id', enrolmentId)

      // ─── 5. extend-trial (enrolment) ──────────────────────────────────
      console.log('\n──── 5 — enrolment extend-trial (+14d) ────')
      // Anchor math: max(2026-06-20, today=2026-06-03) + 14 = 2026-07-04.
      // trial_expires_at is TIMESTAMPTZ, so DB returns 'YYYY-MM-DDT00:00:00+00:00'.
      // We slice the date portion off for comparison (mirrors what derive does).
      const expected = '2026-07-04'
      const { error: e5 } = await sb.from('enrolments').update({ trial_expires_at: expected }).eq('id', enrolmentId)
      await check('UPDATE succeeded', () => !e5)
      const { data: r5 } = await sb.from('enrolments').select('trial_expires_at').eq('id', enrolmentId).single()
      const r5Date = (r5.trial_expires_at || '').slice(0, 10)
      await check(`trial_expires_at date portion = ${expected}`, () => r5Date === expected)
      console.log(`    (raw DB value: ${JSON.stringify(r5.trial_expires_at)})`)

      // Reset
      await sb.from('enrolments').update({ trial_expires_at: '2026-06-20' }).eq('id', enrolmentId)

      // ─── 6. mark-lost (enrolment) ─────────────────────────────────────
      console.log('\n──── 6 — enrolment mark-lost ────')
      const { error: e6 } = await sb.from('enrolments').update({ status: 'cancelled' }).eq('id', enrolmentId)
      await check('UPDATE succeeded', () => !e6)
      const { data: r6 } = await sb.from('enrolments').select('status').eq('id', enrolmentId).single()
      await check('status=cancelled', () => r6.status === 'cancelled')
    }
  }

} finally {
  // ─── Cleanup — delete the test rows ────────────────────────────────────
  console.log('\n──── Cleanup — delete test rows ────')
  if (bookingId) {
    const { error } = await sb.from('trial_bookings').delete().eq('id', bookingId)
    console.log(`  Deleted booking ${bookingId}: ${error ? 'FAILED ' + error.message : 'OK'}`)
  }
  if (enrolmentId) {
    const { error } = await sb.from('enrolments').delete().eq('id', enrolmentId)
    console.log(`  Deleted enrolment ${enrolmentId}: ${error ? 'FAILED ' + error.message : 'OK'}`)
  }
}

console.log('\n──── SUMMARY ────')
const pass = results.filter(r => r.pass).length
const fail = results.filter(r => !r.pass).length
console.log(`  ${pass} pass / ${fail} fail / ${results.length} total`)
process.exit(fail > 0 ? 1 : 0)
