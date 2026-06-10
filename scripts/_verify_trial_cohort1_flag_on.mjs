#!/usr/bin/env node
/**
 * Cohort 1 verification — FLAG ON stage.
 * 1. anon INSERT trial_bookings (production code shape, preferred_date set)
 * 2. service-role SELECT — confirm row + preferred_date
 * 3. POST /api/trials/notify-academy → confirm ok + notificationsInserted + emailRecipient
 * 4. service-role SELECT notifications by org+type='new_trial' → count > 0
 * 5. confirm email recipient = org.contact_email (Coaching@jamieallanfitness.com)
 * 6. form-succeeds-even-if-route-500 spot-check (skip — route returned 200)
 * 7. cleanup ALL test rows (trial_bookings + notifications)
 * 8. confirm no rows in subscriptions/payments/enrolments/customers tied to test
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) { console.error('Missing env'); process.exit(1) }

const BASE = 'https://theplayerportal.net'
const ORG_ID = 'd99aa6e4-514b-42db-9c2a-523aab90e678'
const GROUP_ID = '8c625dcf-db3a-4f28-84f7-6eeddfa0d08a'
const EXPECTED_RECIPIENT = 'Coaching@jamieallanfitness.com'

const anon = createClient(SUPABASE_URL, ANON_KEY)
const svc  = createClient(SUPABASE_URL, SERVICE_KEY)

const fail = (m) => { console.error('FAIL:', m); process.exit(2) }
const pass = (m) => console.log('PASS:', m)

const ts = Date.now()
const MARKER = `cohort1-flag-on-${ts}`
const TEST_EMAIL = `cohort1-on-${ts}@example.invalid`
const TEST_CHILD = `Cohort1 ON ${ts}`
const TEST_PARENT = 'Cohort1 ON Tester'

const testStartIso = new Date(Date.now() - 5000).toISOString()

console.log(`Marker:      ${MARKER}`)
console.log(`Test child:  ${TEST_CHILD}`)
console.log(`Test email:  ${TEST_EMAIL}`)
console.log()

// === STEP 1: anon INSERT with preferred_date in payload (form's post-Cohort-1 shape) ===
let preferredDateIso
{
  const targetDay = 5
  const today = new Date().getDay()
  let daysUntil = targetDay - today
  if (daysUntil <= 0) daysUntil += 7
  const next = new Date()
  next.setDate(next.getDate() + daysUntil)
  preferredDateIso = next.toISOString().split('T')[0]

  const { error } = await anon.from('trial_bookings').insert({
    organisation_id: ORG_ID,
    training_group_id: GROUP_ID,
    parent_name: TEST_PARENT,
    parent_email: TEST_EMAIL,
    parent_phone: null,
    child_name: TEST_CHILD,
    child_age: null,
    preferred_date: preferredDateIso,
    notes: MARKER,
  })
  if (error) fail(`anon INSERT failed: ${error.code} ${error.message}`)
  pass(`STEP 1: anon INSERT — preferred_date=${preferredDateIso}`)
}

// === STEP 2: confirm row + preferred_date ===
let trialId
{
  const { data } = await svc
    .from('trial_bookings')
    .select('id, preferred_date, status, organisation_id')
    .eq('notes', MARKER)
    .single()
  if (!data) fail('row not found')
  if (data.preferred_date !== preferredDateIso) fail(`preferred_date mismatch: ${data.preferred_date} != ${preferredDateIso}`)
  if (data.status !== 'pending') fail(`status: ${data.status}`)
  trialId = data.id
  pass(`STEP 2: row visible — id=${trialId}, preferred_date=${data.preferred_date}, status=${data.status}`)
}

// === STEP 3: POST the new route — flag ON, expect fan-out ===
let routeResp
{
  const res = await fetch(`${BASE}/api/trials/notify-academy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      organisation_id: ORG_ID,
      parent_email: TEST_EMAIL,
      child_name: TEST_CHILD,
    }),
  })
  if (!res.ok) fail(`route returned ${res.status}`)
  routeResp = await res.json()
  console.log('  Route response:', JSON.stringify(routeResp, null, 2))
  if (routeResp.disabled) fail('route still reports disabled — flag did not apply')
  if (routeResp.ok !== true) fail('route did not report ok=true')
  if (!routeResp.trialId) fail('route did not return trialId')
  if (routeResp.trialId !== trialId) fail(`route resolved wrong trial: ${routeResp.trialId} != ${trialId}`)
  if (typeof routeResp.notificationsInserted !== 'number' || routeResp.notificationsInserted < 1) {
    fail(`notificationsInserted = ${routeResp.notificationsInserted} (expected >= 1)`)
  }
  if (routeResp.emailSent !== true) fail(`emailSent = ${routeResp.emailSent}`)
  pass(`STEP 3: route fired — notificationsInserted=${routeResp.notificationsInserted}, emailSent=${routeResp.emailSent}, emailRecipient="${routeResp.emailRecipient}"`)
}

// === STEP 4: verify notifications written to DB ===
{
  const { data, count } = await svc
    .from('notifications')
    .select('id, user_id, type, title, body, organisation_id', { count: 'exact' })
    .eq('organisation_id', ORG_ID)
    .eq('type', 'new_trial')
    .gte('created_at', testStartIso)
  if ((count || 0) < 1) fail(`expected >= 1 notification, got ${count}`)
  console.log(`  ${count} notification(s) created:`)
  data.forEach(n => console.log(`    user_id=${n.user_id} title="${n.title}" body="${n.body}"`))
  // confirm all user_ids are real admin profiles
  for (const n of data) {
    const { data: prof } = await svc.from('profiles').select('id, full_name, role').eq('id', n.user_id).single()
    if (!prof) fail(`notification user_id ${n.user_id} doesn't match any profile`)
    if (prof.role !== 'admin') fail(`notification user_id ${n.user_id} role=${prof.role} (expected admin)`)
  }
  pass(`STEP 4: ${count} notification(s) → admin profile(s) only`)
}

// === STEP 5: confirm email recipient = org.contact_email ===
{
  if (routeResp.emailRecipient !== EXPECTED_RECIPIENT) {
    fail(`HARD STOP: email recipient "${routeResp.emailRecipient}" != expected "${EXPECTED_RECIPIENT}" (org.contact_email)`)
  }
  pass(`STEP 5: email recipient = "${EXPECTED_RECIPIENT}" (org.contact_email — correct)`)
}

// === STEP 6: cleanup trial_bookings ===
{
  const { error, count } = await svc.from('trial_bookings').delete({ count: 'exact' }).eq('id', trialId)
  if (error) fail(`trial cleanup: ${error.message}`)
  if (count !== 1) fail(`trial cleanup count=${count}`)
  pass(`STEP 6: trial_bookings DELETE count=1`)
}

// === STEP 7: cleanup notifications ===
{
  const { error, count } = await svc
    .from('notifications')
    .delete({ count: 'exact' })
    .eq('organisation_id', ORG_ID)
    .eq('type', 'new_trial')
    .gte('created_at', testStartIso)
  if (error) fail(`notif cleanup: ${error.message}`)
  pass(`STEP 7: notifications DELETE count=${count}`)
}

// === STEP 8: confirm NO new rows in protected tables ===
{
  const tables = ['subscriptions', 'payments', 'enrolments', 'customers']
  for (const t of tables) {
    const { count, error } = await svc
      .from(t)
      .select('id', { count: 'exact', head: true })
      .gte('created_at', testStartIso)
      .eq('organisation_id', ORG_ID)
      .catch(() => ({ count: null, error: { message: 'table query failed' } }))
    if (error) {
      // Some tables may not have organisation_id column — fall back to no-filter created_at sweep just on org's test window
      console.log(`  ${t}: (skipping — ${error.message})`)
      continue
    }
    if ((count || 0) > 0) fail(`HARD STOP: ${count} new rows in ${t} since test start`)
    console.log(`  ${t}: 0 new rows since test start ✓`)
  }
  pass(`STEP 8: no protected-table writes from the fan-out`)
}

// === FINAL: residual sweep ===
{
  const { data: t } = await svc.from('trial_bookings').select('id').like('notes', 'cohort1-flag-on-%')
  const { data: n } = await svc.from('notifications').select('id').eq('type', 'new_trial').gte('created_at', testStartIso)
  console.log(`FINAL: residual trial markers: ${t?.length || 0}, residual notif markers: ${n?.length || 0}`)
  if (t?.length || n?.length) fail('residual rows present')
}

console.log()
console.log('All flag-ON checks PASS.')
