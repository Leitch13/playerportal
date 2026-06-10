#!/usr/bin/env node
/**
 * Cohort 1 verification — FLAG OFF stage.
 * 1. anon INSERT trial_bookings (production code shape, no chained .select())
 * 2. service-role SELECT the row by marker → confirm preferred_date populated
 * 3. POST /api/trials/notify-academy from this script (production calls it
 *    fire-and-forget from the form; we call it directly to inspect the
 *    response shape) → confirm route returns { ok: true, disabled: true }
 * 4. service-role SELECT notifications by (organisation_id, type='new_trial',
 *    created_at >= test start) → confirm count = 0
 * 5. service-role DELETE the test row + sanity sweep for residual markers
 *
 * Test data targets Jamie Allan Football Academy (approved).
 * Synthetic parent_email + child_name carry a marker so cleanup is precise.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  console.error('Missing env')
  process.exit(1)
}

const BASE = 'https://theplayerportal.net'
const ORG_ID = 'd99aa6e4-514b-42db-9c2a-523aab90e678'   // Jamie Allan Football Academy
const GROUP_ID = '8c625dcf-db3a-4f28-84f7-6eeddfa0d08a' // 1-2-1 Friday 15:45

const anon = createClient(SUPABASE_URL, ANON_KEY)
const svc  = createClient(SUPABASE_URL, SERVICE_KEY)

const fail = (m) => { console.error('FAIL:', m); process.exit(2) }
const pass = (m) => console.log('PASS:', m)

const ts = Date.now()
const MARKER = `cohort1-flag-off-${ts}`
const TEST_EMAIL = `cohort1-off-${ts}@example.invalid`
const TEST_CHILD = `Cohort1 OFF ${ts}`
const TEST_PARENT = 'Cohort1 OFF Tester'

const testStartIso = new Date(Date.now() - 5000).toISOString()

console.log(`Marker:      ${MARKER}`)
console.log(`Test child:  ${TEST_CHILD}`)
console.log(`Test email:  ${TEST_EMAIL}`)
console.log()

// === STEP 1: anon INSERT — mirroring TrialForm.tsx's exact post-Cohort-1
// payload, including the new `preferred_date` field populated via the
// same getNextClassDate() algorithm the form uses.  Production code shape:
// no chained .select() (the table has anon INSERT but not anon SELECT). ===
{
  // Mirror getNextClassDate() from TrialForm.tsx exactly:
  //   targetDay = dayMap[selectedGroup.day]   // Friday → 5
  //   today     = new Date().getDay()
  //   daysUntil = targetDay - today
  //   if (daysUntil <= 0) daysUntil += 7
  //   next      = today + daysUntil days
  const targetDay = 5  // Friday (test class is 1-2-1 Friday)
  const today = new Date().getDay()
  let daysUntil = targetDay - today
  if (daysUntil <= 0) daysUntil += 7
  const next = new Date()
  next.setDate(next.getDate() + daysUntil)
  const isoDate = next.toISOString().split('T')[0]

  const { error } = await anon.from('trial_bookings').insert({
    organisation_id: ORG_ID,
    training_group_id: GROUP_ID,
    parent_name: TEST_PARENT,
    parent_email: TEST_EMAIL,
    parent_phone: null,
    child_name: TEST_CHILD,
    child_age: null,
    preferred_date: isoDate,   // ← Cohort 1 P1.2: NEW field in payload
    notes: MARKER,
  })
  if (error) fail(`anon INSERT failed: ${error.code} ${error.message}`)
  pass(`STEP 1: anon INSERT trial_booking succeeded (production shape) — preferred_date=${isoDate}`)
}

// === STEP 2: service-role SELECT — confirm preferred_date populated ===
let trialId
{
  const { data, error } = await svc
    .from('trial_bookings')
    .select('id, preferred_date, organisation_id, status, created_at')
    .eq('notes', MARKER)
    .single()
  if (error || !data) fail(`svc SELECT after insert failed: ${error?.message || 'no row'}`)
  trialId = data.id
  if (!data.preferred_date) fail(`preferred_date is NULL on inserted row`)
  if (data.organisation_id !== ORG_ID) fail(`wrong organisation_id`)
  if (data.status !== 'pending') fail(`wrong status: ${data.status}`)
  pass(`STEP 2: trial id=${trialId}, preferred_date=${data.preferred_date}, status=${data.status}`)
}

// === STEP 3: invoke /api/trials/notify-academy — flag OFF → disabled ===
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
  const json = await res.json()
  if (json.ok !== true || json.disabled !== true) {
    fail(`route did not report disabled — body: ${JSON.stringify(json)}`)
  }
  pass(`STEP 3: route returned { ok: true, disabled: true } (flag OFF respected)`)
}

// === STEP 4: confirm NO notification row created ===
{
  const { data, count } = await svc
    .from('notifications')
    .select('id, type, title, body, created_at', { count: 'exact' })
    .eq('organisation_id', ORG_ID)
    .eq('type', 'new_trial')
    .gte('created_at', testStartIso)
  if ((count || 0) > 0) {
    fail(`HARD STOP: ${count} new_trial notification(s) created while flag OFF: ${JSON.stringify(data)}`)
  }
  pass(`STEP 4: 0 new_trial notifications created while flag OFF (count=${count || 0})`)
}

// === STEP 5: cleanup ===
{
  const { error: delErr, count } = await svc
    .from('trial_bookings')
    .delete({ count: 'exact' })
    .eq('id', trialId)
  if (delErr) fail(`cleanup DELETE failed: ${delErr.message}`)
  if (count !== 1) fail(`cleanup DELETE count=${count}, expected 1`)
  // Verify gone
  const { data: gone } = await svc.from('trial_bookings').select('id').eq('id', trialId).maybeSingle()
  if (gone) fail(`row still present after DELETE`)
  pass(`STEP 5: cleanup — DELETE count=1, row absent after`)
}

// === FINAL: residual sweep ===
{
  const { data: residual } = await svc
    .from('trial_bookings')
    .select('id, notes')
    .like('notes', 'cohort1-flag-off-%')
  console.log(`FINAL: residual marker rows: ${residual?.length || 0}`)
  if (residual?.length) fail('residual rows present')
}

console.log()
console.log('All flag-OFF checks PASS.')
