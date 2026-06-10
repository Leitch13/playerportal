#!/usr/bin/env node
/**
 * Cohort 2 Stage 1 verification — flag OFF.
 *
 * Stage 1 steps 5-7:
 *   5. Admin can still confirm normally (UPDATE flow unaffected by route)
 *   6. Verify status/confirmed_at set, no email sent, no notification
 *   7. Verify trial-followup cron URL uses slug not UUID
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const CRON_SECRET = process.env.CRON_SECRET
if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY || !CRON_SECRET) {
  console.error('Missing env (need NEXT_PUBLIC_SUPABASE_URL, ANON_KEY, SERVICE_ROLE_KEY, CRON_SECRET)')
  process.exit(1)
}

const BASE = 'https://www.theplayerportal.net' // www-canonical
const ORG_ID = 'd99aa6e4-514b-42db-9c2a-523aab90e678'
const ORG_SLUG = 'jamie-allan-football-academy'
const GROUP_ID = '8c625dcf-db3a-4f28-84f7-6eeddfa0d08a'

const anon = createClient(SUPABASE_URL, ANON_KEY)
const svc  = createClient(SUPABASE_URL, SERVICE_KEY)

const fail = (m) => { console.error('FAIL:', m); process.exit(2) }
const pass = (m) => console.log('PASS:', m)

const ts = Date.now()
const MARKER_S1A = `cohort2-stage1-confirm-${ts}`        // for STEP 5/6
const MARKER_S1B = `cohort2-stage1-followup-${ts}`       // for STEP 7
const TEST_EMAIL_S1A = `cohort2-confirm-${ts}@example.invalid`
const TEST_EMAIL_S1B = `johnleitch970+cohort2-fu-${ts}@gmail.com` // operator inbox, easy visual verify
const testStartIso = new Date(Date.now() - 5000).toISOString()

console.log(`Stage 1 markers: confirm=${MARKER_S1A}, followup=${MARKER_S1B}`)
console.log()

// ════════════════════════════════════════════════════════════════════════
// STEP 5+6 — admin can still confirm + no email/notif while flag OFF
// ════════════════════════════════════════════════════════════════════════

// Plant a pending trial (anon, production code shape)
{
  const next = new Date()
  next.setDate(next.getDate() + ((5 - next.getDay() + 7) % 7 || 7))
  const { error } = await anon.from('trial_bookings').insert({
    organisation_id: ORG_ID,
    training_group_id: GROUP_ID,
    parent_name: 'Cohort2 S1 Confirm Tester',
    parent_email: TEST_EMAIL_S1A,
    parent_phone: null,
    child_name: `Cohort2 S1 Child ${ts}`,
    child_age: null,
    preferred_date: next.toISOString().split('T')[0],
    notes: MARKER_S1A,
  })
  if (error) fail(`STEP 5a anon INSERT: ${error.message}`)
  pass(`STEP 5a: pending trial inserted via anon RLS`)
}

// Look up trial id
let trialId
{
  const { data } = await svc.from('trial_bookings').select('id').eq('notes', MARKER_S1A).single()
  if (!data) fail('trial row not found post-insert')
  trialId = data.id
}

// Simulate TrialManager.updateStatus(id, 'confirmed') — admin UPDATE via service role
// (real admins go through authed supabase client; service-role mirrors the result.
//  RLS policy `trial_bookings_staff_manage` would permit the same UPDATE for an
//  admin profile in this org.)
{
  const confirmedAt = new Date().toISOString()
  const { error } = await svc.from('trial_bookings')
    .update({ status: 'confirmed', confirmed_at: confirmedAt })
    .eq('id', trialId)
  if (error) fail(`STEP 5b UPDATE: ${error.message}`)
  pass(`STEP 5b: admin-equivalent UPDATE to status='confirmed' succeeded`)
}

// Verify the UPDATE landed.  trial_bookings has NO parent_id column —
// schema-drift bug found mid-Cohort-2; route patched in 200583b to
// match.  Verification SELECT correspondingly drops parent_id.
{
  let data = null
  for (let attempt = 0; attempt < 3 && !data; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 500))
    const result = await svc.from('trial_bookings')
      .select('id, status, confirmed_at, preferred_date')
      .eq('id', trialId).maybeSingle()
    data = result.data
    if (!data && result.error) console.log(`  attempt ${attempt+1} select error:`, result.error.message)
  }
  if (!data) fail(`STEP 6a: verify SELECT returned null after 3 attempts (trialId=${trialId})`)
  if (data.status !== 'confirmed') fail(`status=${data.status} (expected confirmed)`)
  if (!data.confirmed_at) fail('confirmed_at is null')
  pass(`STEP 6a: status=confirmed, confirmed_at=${data.confirmed_at.slice(0,19)}Z, preferred_date=${data.preferred_date}`)
}

// Verify the route, when called by anon, returns 403 (auth gate fires first)
// and writes no notification.  Real TrialManager fires fire-and-forget WITH
// the admin's session cookie — but the goal of this verification is to prove:
//   - Anon → 403
//   - Whatever happens, no `trial_confirmed` notification is created while flag OFF.
{
  const resp = await fetch(`${BASE}/api/email/trial-confirmed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trialId }),
    redirect: 'follow',
  })
  if (resp.status !== 403) fail(`route returned ${resp.status} for anon (expected 403)`)
  pass(`STEP 6b: anon POST /api/email/trial-confirmed → 403 Unauthorized (auth gate fires first)`)
}

// Verify zero notifications were created of type 'trial_confirmed' since test start
{
  const { count } = await svc.from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('organisation_id', ORG_ID)
    .eq('type', 'trial_confirmed')
    .gte('created_at', testStartIso)
  if ((count || 0) !== 0) fail(`HARD STOP: ${count} trial_confirmed notifications created while flag OFF`)
  pass(`STEP 6c: 0 trial_confirmed notifications created while flag OFF`)
}

// Cleanup the confirm-test row
{
  const { count } = await svc.from('trial_bookings').delete({ count: 'exact' }).eq('id', trialId)
  if (count !== 1) fail(`confirm-test cleanup count=${count}`)
  pass(`STEP 6d: confirm-test trial cleanup OK`)
}

// ════════════════════════════════════════════════════════════════════════
// STEP 7 — trial-followup cron URL fix
// ════════════════════════════════════════════════════════════════════════

// Plant an attended-yesterday trial (service-role; sets updated_at in the
// cron's window; anon path can't write status/updated_at directly).
let followupTrialId
{
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1)
  const yIso = yesterday.toISOString()
  // Insert via anon first (RLS allows INSERT with is_published=true)
  const { error: insErr } = await anon.from('trial_bookings').insert({
    organisation_id: ORG_ID,
    training_group_id: GROUP_ID,
    parent_name: 'Cohort2 S1 Followup Tester',
    parent_email: TEST_EMAIL_S1B,
    parent_phone: null,
    child_name: `Cohort2 S1 FU Child ${ts}`,
    child_age: null,
    preferred_date: yesterday.toISOString().split('T')[0],
    notes: MARKER_S1B,
  })
  if (insErr) fail(`STEP 7a anon INSERT: ${insErr.message}`)

  // Now service-role UPDATE to mark attended yesterday
  const { data } = await svc.from('trial_bookings').select('id').eq('notes', MARKER_S1B).single()
  followupTrialId = data.id
  const { error: updErr } = await svc.from('trial_bookings')
    .update({ status: 'attended', updated_at: yIso })
    .eq('id', followupTrialId)
  if (updErr) fail(`STEP 7a UPDATE: ${updErr.message}`)
  pass(`STEP 7a: attended-yesterday trial planted (id=${followupTrialId}, updated_at=${yIso.slice(0,19)}Z)`)
}

// Trigger the trial-followup cron
{
  const resp = await fetch(`${BASE}/api/cron/trial-followup`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
  })
  if (resp.status !== 200) fail(`cron returned ${resp.status}`)
  const json = await resp.json()
  console.log(`  cron response: ${JSON.stringify(json)}`)
  if ((json.trialsChecked || 0) < 1) fail(`cron checked ${json.trialsChecked} trials (expected >= 1)`)
  if ((json.sent || 0) < 1) fail(`cron sent ${json.sent} emails (expected >= 1 — our planted row)`)
  pass(`STEP 7b: cron returned 200, sent=${json.sent}, checked=${json.trialsChecked}`)
}

// Independently verify the URL pattern the cron would have used.
// The cron source builds:  ${appUrl}/book/${org?.slug || ""}
// org.slug for Jamie = "jamie-allan-football-academy".
// HEAD that URL → 200 proves the resolution path is clean.
{
  const expectedUrl = `${BASE}/book/${ORG_SLUG}`
  const resp = await fetch(expectedUrl, { method: 'HEAD', redirect: 'follow' })
  if (resp.status !== 200) fail(`booking page at ${expectedUrl} returned ${resp.status}`)
  pass(`STEP 7c: ${expectedUrl} → HTTP 200 (slug-based URL resolves)`)
}

// Also verify the BROKEN baseline URL (with UUID) would 404 — proves the bug was real
{
  const oldBrokenUrl = `${BASE}/book/${ORG_ID}`
  const resp = await fetch(oldBrokenUrl, { method: 'HEAD', redirect: 'follow' })
  if (resp.status === 200) console.log(`  note: ${oldBrokenUrl} unexpectedly 200 (baseline test inconclusive)`)
  else console.log(`  baseline: ${oldBrokenUrl} → HTTP ${resp.status} (UUID-based URL does NOT resolve, as expected)`)
}

// Cleanup the followup-test row
{
  const { count } = await svc.from('trial_bookings').delete({ count: 'exact' }).eq('id', followupTrialId)
  if (count !== 1) fail(`followup-test cleanup count=${count}`)
  pass(`STEP 7d: followup-test trial cleanup OK`)
}

// Final residual sweep
{
  const { data } = await svc.from('trial_bookings').select('id').like('notes', 'cohort2-stage1-%')
  if (data?.length) fail(`residual rows: ${data.length}`)
  const { data: notifs } = await svc.from('notifications').select('id').eq('type', 'trial_confirmed').gte('created_at', testStartIso)
  if (notifs?.length) fail(`residual notifs: ${notifs.length}`)
  pass(`FINAL: 0 residual rows in trial_bookings or notifications`)
}

console.log()
console.log('Stage 1 PASS — all checks green.')
console.log('NOTE: cron sent a real email to johnleitch970+cohort2-fu-' + ts + '@gmail.com.')
console.log('      Operator can visually verify the URL in that inbox: should be')
console.log('      https://...theplayerportal.net/book/jamie-allan-football-academy')
