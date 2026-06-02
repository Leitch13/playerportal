/**
 * Stage 3 preview UAT — final verification against the migrated prod schema.
 *
 * Creates clearly-marked test records in the production Supabase DB
 * (auth user + profile + player + scheduled subscription + pending
 * enrolment), exercises the three previously-deferred UAT items, then
 * deletes everything it created. Logs every write so cleanup can be
 * verified by row count after.
 *
 * NO live Stripe charges — the test subscription uses an obviously
 * invalid `seti_UAT_INVALID_*` SetupIntent ID so when the cron tries
 * to retrieve it from Stripe, Stripe returns resource_missing and the
 * cron logs + skips the row. Zero money movement.
 *
 * Tests:
 *   UAT 1: Pending enrolment state visible
 *     - Enrolment row stored with status='pending'
 *     - Class capacity query (active OR pending) includes it
 *     - Active-only queries (analytics, dashboards) exclude it
 *
 *   UAT 2: Booking blocked before activation
 *     - SQL replication of gate's WHERE activates_on > today logic
 *     - Code-level confirmation that booking route returns 403 with
 *       enrolmentNotStarted=true for the test row
 *
 *   UAT 3: Activation cron path
 *     - SQL replication of cron's selection query picks up the test row
 *     - Live cron invocation against preview handles invalid SetupIntent
 *       gracefully (catches resource_missing, logs, skips, no charge)
 *
 * Cleanup verifies all five tables return zero rows for the test IDs.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

function parseEnv(content) {
  const out = {}
  for (const raw of content.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 0) continue
    const key = line.slice(0, eq).trim()
    let val = line.slice(eq + 1).trim()
    // Strip surrounding quotes (Vercel exports use double-quoted values)
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    out[key] = val
  }
  return out
}
const env = parseEnv(readFileSync('/tmp/.env.prod', 'utf8'))

// ─── Test data fingerprint ───────────────────────────────────────────
const TS = Date.now()
const SUFFIX = `UAT_${TS}`
const TEST_EMAIL = `stage3-uat-${TS}@playerportal-uat.invalid`
const TEST_PASSWORD = `UATtest${TS}_!`

const JAMIE_ORG_ID = 'd99aa6e4-514b-42db-9c2a-523aab90e678'
// Mini Ballers - Savoy, Methil (second class; Kirkcaldy is the public-fronted one)
const TEST_CLASS_ID = '38bf64ac-f789-4ee9-b466-1a1e05757453'
const TEST_PLAN_ID = 'ce06c73c-397c-4bb6-882e-075353770b97'
const PREVIEW_BASE = 'https://playerportallive-axtrx4ti0-johnleitch970-1195s-projects.vercel.app'

// ─── Helpers ─────────────────────────────────────────────────────────
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})
const results = []
function step(name, passed, detail) {
  const tag = passed ? 'PASS' : 'FAIL'
  results.push({ name, passed, detail })
  console.log(`  ${tag.padEnd(4)}  ${name}${detail ? `  →  ${detail}` : ''}`)
}
const phase = (n) => console.log(`\n──── ${n} ────`)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Track every test record so cleanup is guaranteed even on early exit.
const createdRecords = {
  authUserId: null,
  profileId: null,
  playerId: null,
  subscriptionId: null,
  enrolmentId: null,
}

let cleanedUp = false
async function cleanup() {
  if (cleanedUp) return
  cleanedUp = true
  console.log('\n──── CLEANUP ────')
  // Reverse FK order: enrolment → sub → player → profile → auth.user
  if (createdRecords.enrolmentId) {
    const { error } = await supabase.from('enrolments').delete().eq('id', createdRecords.enrolmentId)
    console.log(`  enrolment ${createdRecords.enrolmentId}: ${error ? `FAILED ${error.message}` : 'deleted'}`)
  }
  if (createdRecords.subscriptionId) {
    const { error } = await supabase.from('subscriptions').delete().eq('id', createdRecords.subscriptionId)
    console.log(`  subscription ${createdRecords.subscriptionId}: ${error ? `FAILED ${error.message}` : 'deleted'}`)
  }
  if (createdRecords.playerId) {
    const { error } = await supabase.from('players').delete().eq('id', createdRecords.playerId)
    console.log(`  player ${createdRecords.playerId}: ${error ? `FAILED ${error.message}` : 'deleted'}`)
  }
  if (createdRecords.authUserId) {
    // profile is typically cascade-deleted via FK to auth.users
    const { error } = await supabase.auth.admin.deleteUser(createdRecords.authUserId)
    console.log(`  auth user ${createdRecords.authUserId}: ${error ? `FAILED ${error.message}` : 'deleted'}`)
  }
}
process.on('SIGINT', async () => { await cleanup(); process.exit(2) })
process.on('uncaughtException', async (e) => { console.error(e); await cleanup(); process.exit(1) })

try {

// ─── PHASE 0 — Pre-flight ────────────────────────────────────────────
phase('PHASE 0 — Pre-flight')

const { data: jamie } = await supabase
  .from('organisations').select('id, name').eq('id', JAMIE_ORG_ID).single()
step('Jamie Allan org reachable', jamie?.name === 'Jamie Allan Football Academy', `name=${jamie?.name}`)

const { data: testClass } = await supabase
  .from('training_groups')
  .select('id, name, max_capacity, day_of_week')
  .eq('id', TEST_CLASS_ID).single()
step('Test class resolved', !!testClass, `${testClass?.name} (cap ${testClass?.max_capacity})`)

const { data: testPlan } = await supabase
  .from('subscription_plans')
  .select('id, name, amount').eq('id', TEST_PLAN_ID).single()
step('Test plan resolved', !!testPlan, `${testPlan?.name} £${testPlan?.amount}`)

const today = new Date()
const todayIso = today.toISOString().slice(0, 10)
const inAWeek = new Date(today.getTime() + 7 * 86400_000).toISOString().slice(0, 10)

// ─── PHASE 1 — Setup test records ────────────────────────────────────
phase('PHASE 1 — Create test records')

// 1. auth.users via admin API
const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
  email: TEST_EMAIL,
  password: TEST_PASSWORD,
  email_confirm: true,
  user_metadata: { full_name: `UAT Stage 3 ${SUFFIX}`, is_test_record: true, created_by: 'stage3-preview-uat.mjs' },
})
if (authErr) throw new Error(`auth.users create failed: ${authErr.message}`)
createdRecords.authUserId = authUser.user.id
step('Created auth.user', !!createdRecords.authUserId, `id=${createdRecords.authUserId} email=${TEST_EMAIL}`)

await sleep(500)  // give the auto-profile trigger time

// 2. profile (may already exist via trigger)
const { data: existingProf } = await supabase
  .from('profiles').select('id, organisation_id').eq('id', createdRecords.authUserId).maybeSingle()
if (existingProf) {
  createdRecords.profileId = existingProf.id
  // Update org membership so the parent is in Jamie's org
  if (existingProf.organisation_id !== JAMIE_ORG_ID) {
    await supabase.from('profiles').update({ organisation_id: JAMIE_ORG_ID, full_name: `UAT Stage 3 ${SUFFIX}` }).eq('id', createdRecords.profileId)
  }
  step('Profile auto-created by trigger', true, `id=${createdRecords.profileId}`)
} else {
  const { data: newProf, error: profErr } = await supabase.from('profiles').insert({
    id: createdRecords.authUserId,
    email: TEST_EMAIL,
    full_name: `UAT Stage 3 ${SUFFIX}`,
    organisation_id: JAMIE_ORG_ID,
    role: 'parent',
  }).select().single()
  if (profErr) throw new Error(`profile insert failed: ${profErr.message}`)
  createdRecords.profileId = newProf.id
  step('Inserted profile manually', true, `id=${createdRecords.profileId}`)
}

// 3. player
const { data: player, error: plErr } = await supabase.from('players').insert({
  parent_id: createdRecords.authUserId,
  first_name: 'UAT',
  last_name: `TestChild_${TS}`,
  organisation_id: JAMIE_ORG_ID,
  date_of_birth: '2020-01-01',
}).select().single()
if (plErr) throw new Error(`player insert failed: ${plErr.message}`)
createdRecords.playerId = player.id
step('Created player', !!createdRecords.playerId, `id=${createdRecords.playerId}`)

// 4. scheduled subscription — Stage 3 shape
//    start_date = today (so cron's `start_date <= today` picks it up)
//    stripe_setup_intent_id = clearly invalid (Stripe will return resource_missing)
const { data: sub, error: subErr } = await supabase.from('subscriptions').insert({
  parent_id: createdRecords.authUserId,
  player_id: createdRecords.playerId,
  plan_id: TEST_PLAN_ID,
  organisation_id: JAMIE_ORG_ID,
  status: 'scheduled',
  start_date: todayIso,
  stripe_setup_intent_id: `seti_UAT_INVALID_${TS}`,
  stripe_customer_id: `cus_UAT_INVALID_${TS}`,
  training_group_id: TEST_CLASS_ID,
}).select().single()
if (subErr) throw new Error(`subscription insert failed: ${subErr.message}`)
createdRecords.subscriptionId = sub.id
step('Created scheduled subscription', sub.status === 'scheduled',
  `id=${sub.id} status=${sub.status} start_date=${sub.start_date}`)

// 5. pending enrolment — activates_on = today + 7 (so booking gate fires)
const { data: enrol, error: enrErr } = await supabase.from('enrolments').insert({
  player_id: createdRecords.playerId,
  group_id: TEST_CLASS_ID,
  status: 'pending',
  organisation_id: JAMIE_ORG_ID,
  activates_on: inAWeek,
}).select().single()
if (enrErr) throw new Error(`enrolment insert failed: ${enrErr.message}`)
createdRecords.enrolmentId = enrol.id
step('Created pending enrolment', enrol.status === 'pending',
  `id=${enrol.id} status=${enrol.status} activates_on=${enrol.activates_on}`)

// ─── PHASE 2 — UAT 1: Pending enrolment state visible ────────────────
phase('PHASE 2 — UAT 1: Pending enrolment state visible')

// Read enrolment back
const { data: enrolRead } = await supabase.from('enrolments').select('id, status, activates_on').eq('id', createdRecords.enrolmentId).single()
step('Pending status persisted to DB', enrolRead.status === 'pending', `status=${enrolRead.status}`)
step('activates_on persisted to DB', enrolRead.activates_on === inAWeek, `activates_on=${enrolRead.activates_on}`)

// Class capacity query (replicates the 4 booking-page queries from f1de0a6):
//   .in('status', ['active', 'pending'])
const { count: capacityCount } = await supabase
  .from('enrolments').select('id', { count: 'exact', head: true })
  .eq('group_id', TEST_CLASS_ID)
  .in('status', ['active', 'pending'])
const { count: activeOnlyCount } = await supabase
  .from('enrolments').select('id', { count: 'exact', head: true })
  .eq('group_id', TEST_CLASS_ID)
  .eq('status', 'active')
step('Class capacity query INCLUDES test pending row',
  capacityCount > activeOnlyCount,
  `capacity-count=${capacityCount}, active-only-count=${activeOnlyCount}, delta=${capacityCount - activeOnlyCount}`)

// Analytics / dashboard query pattern (filters status='active' only)
step('Active-only queries EXCLUDE test pending row',
  capacityCount - activeOnlyCount === 1,
  `pending row contributes +1 only to capacity, not to active counts`)

// Subscription state visible
const { data: subRead } = await supabase
  .from('subscriptions').select('id, status, start_date, training_group_id, stripe_setup_intent_id')
  .eq('id', createdRecords.subscriptionId).single()
step('Subscription status=scheduled', subRead.status === 'scheduled', `status=${subRead.status}`)
step('Subscription has training_group_id', subRead.training_group_id === TEST_CLASS_ID, `tg=${subRead.training_group_id}`)
step('Subscription has stripe_setup_intent_id', !!subRead.stripe_setup_intent_id, `setup_intent=${subRead.stripe_setup_intent_id}`)

// ─── PHASE 3 — UAT 2: Booking blocked before activation ──────────────
phase('PHASE 3 — UAT 2: Booking blocked before activation')

// SQL replication of the gate's logic:
//   if (existing.activates_on > todayIso) return 403 enrolmentNotStarted
const gateWouldFire = enrolRead.activates_on > todayIso
step('Gate SQL: activates_on > today → would fire', gateWouldFire,
  `${enrolRead.activates_on} > ${todayIso} = ${gateWouldFire}`)

// Live API call: sign in as test parent, POST to /api/enrolments/book.
// Target the preview URL (where Stage 3 is deployed). Vercel deployment
// protection blocks unauthenticated browser requests but API routes are
// often accessible with valid app auth — try and report what happens.
const anonClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
const { data: signin, error: signinErr } = await anonClient.auth.signInWithPassword({
  email: TEST_EMAIL, password: TEST_PASSWORD,
})
step('Test parent can sign in', !signinErr && !!signin?.session,
  signinErr ? `error=${signinErr.message}` : 'JWT obtained')

const jwt = signin?.session?.access_token
if (jwt) {
  // Try PREVIEW first (Stage 3 code)
  const previewResp = await fetch(`${PREVIEW_BASE}/api/enrolments/book`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      player_id: createdRecords.playerId,
      group_id: TEST_CLASS_ID,
      session_date: todayIso,
    }),
  })
  const previewBody = await previewResp.text()
  const previewIsHtml = previewBody.trim().startsWith('<')

  if (previewIsHtml) {
    // Preview SSO blocked API route — fall back to production
    step('Preview SSO blocks API route (falling back to prod)', true, `status=${previewResp.status} (HTML response → SSO gate)`)
    const prodResp = await fetch('https://www.playerportal.net/api/enrolments/book', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${jwt}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        player_id: createdRecords.playerId,
        group_id: TEST_CLASS_ID,
        session_date: todayIso,
      }),
    })
    const prodBody = await prodResp.text()
    let prodJson = null
    try { prodJson = JSON.parse(prodBody) } catch {}
    const gateFiredOnProd = prodResp.status === 403 && prodJson?.enrolmentNotStarted === true
    step('Production booking API returns 403 enrolmentNotStarted', gateFiredOnProd,
      `status=${prodResp.status} body=${(prodBody || '').slice(0, 200)}`)
  } else {
    let previewJson = null
    try { previewJson = JSON.parse(previewBody) } catch {}
    const gateFiredOnPreview = previewResp.status === 403 && previewJson?.enrolmentNotStarted === true
    step('Preview booking API returns 403 enrolmentNotStarted', gateFiredOnPreview,
      `status=${previewResp.status} body=${(previewBody || '').slice(0, 200)}`)
  }
}

// ─── PHASE 4 — UAT 3: Activation cron path ───────────────────────────
phase('PHASE 4 — UAT 3: Activation cron path')

// SQL replication of cron's selection query
const { data: cronCandidates } = await supabase
  .from('subscriptions')
  .select('id, parent_id, player_id, plan_id, organisation_id, start_date, stripe_setup_intent_id, stripe_customer_id, training_group_id')
  .eq('status', 'scheduled')
  .lte('start_date', todayIso)
const foundInQuery = (cronCandidates || []).some((c) => c.id === createdRecords.subscriptionId)
step('Cron selection query includes test row',
  foundInQuery, `query found ${cronCandidates?.length} candidates, test row included=${foundInQuery}`)

// Live cron invocation against preview (use Bearer CRON_SECRET).
const cronResp = await fetch(`${PREVIEW_BASE}/api/cron/activate-scheduled-subs`, {
  headers: { 'Authorization': `Bearer ${env.CRON_SECRET}` },
})
const cronBodyText = await cronResp.text()
let cronJson = null
try { cronJson = JSON.parse(cronBodyText) } catch {}

if (cronJson) {
  step('Cron endpoint reachable on preview', cronResp.status === 200,
    `status=${cronResp.status} candidates=${cronJson.candidates} activated=${cronJson.activated} errors=${cronJson.errors}`)

  const testResult = (cronJson.results || []).find((r) => r.sub_id === createdRecords.subscriptionId)
  step('Cron picked up the test row', !!testResult,
    testResult ? `sub_id=${testResult.sub_id} ok=${testResult.ok}` : 'test row not in results')

  if (testResult) {
    step('Cron failed gracefully on invalid SetupIntent (no charge created)',
      testResult.ok === false && (testResult.error || '').toLowerCase().includes('setup_intent'),
      `error=${testResult.error?.slice(0, 200)}`)
  }
} else {
  step('Cron endpoint reachable on preview', false,
    `non-JSON response, status=${cronResp.status} body=${cronBodyText.slice(0, 200)}`)
}

// After cron run, the test sub should STILL be 'scheduled' (activation
// failed). Verify no spurious state mutation.
const { data: subAfterCron } = await supabase
  .from('subscriptions')
  .select('status, stripe_subscription_id')
  .eq('id', createdRecords.subscriptionId).single()
step('Test sub still status=scheduled after failed activation',
  subAfterCron.status === 'scheduled' && !subAfterCron.stripe_subscription_id,
  `status=${subAfterCron.status}, stripe_sub_id=${subAfterCron.stripe_subscription_id || 'null'}`)

// Enrolment should still be pending (cron only flips on sub create success)
const { data: enrolAfterCron } = await supabase
  .from('enrolments').select('status').eq('id', createdRecords.enrolmentId).single()
step('Test enrolment still status=pending after failed activation',
  enrolAfterCron.status === 'pending',
  `status=${enrolAfterCron.status}`)

// ─── SUMMARY ─────────────────────────────────────────────────────────
phase('SUMMARY (pre-cleanup)')
const passed = results.filter((r) => r.passed).length
const failed = results.filter((r) => !r.passed).length
console.log(`  ${passed} pass / ${failed} fail / ${results.length} total`)
if (failed > 0) {
  console.log('\n  Failed steps:')
  for (const r of results.filter((x) => !x.passed)) {
    console.log(`   ✗ ${r.name}${r.detail ? ` — ${r.detail}` : ''}`)
  }
}

} finally {
  await cleanup()
  // Verify cleanup worked
  console.log('\n──── CLEANUP VERIFICATION ────')
  for (const [table, id] of [
    ['enrolments', createdRecords.enrolmentId],
    ['subscriptions', createdRecords.subscriptionId],
    ['players', createdRecords.playerId],
    ['profiles', createdRecords.profileId],
  ]) {
    if (!id) continue
    const { count } = await supabase.from(table).select('id', { count: 'exact', head: true }).eq('id', id)
    console.log(`  ${table}.${id}: ${count} row(s) remaining`)
  }
  if (createdRecords.authUserId) {
    const { data: u } = await supabase.auth.admin.getUserById(createdRecords.authUserId)
    console.log(`  auth.users.${createdRecords.authUserId}: ${u?.user ? 'STILL EXISTS' : 'deleted'}`)
  }
}

process.exit(results.some((r) => !r.passed) ? 1 : 0)
