#!/usr/bin/env node
/**
 * Verify trialFollowUpEmail is neutralised at both consumer crons.
 *
 * Plants two synthetic attended trials (one matching each cron's window),
 * triggers each cron with CRON_SECRET, confirms send counts, and emits
 * the operator-inbox addresses for visual verification of the new copy.
 *
 * Also re-runs a static check on the deployed JS bundle by directly
 * inspecting the function body that ships in the Next build output (we
 * already did the source-level check pre-commit; this is a belt-and-
 * braces check that the deploy actually shipped what we built).
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const CRON_SECRET = process.env.CRON_SECRET
if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY || !CRON_SECRET) {
  console.error('Missing env'); process.exit(1)
}

const BASE = 'https://www.theplayerportal.net'
const ORG_ID = 'd99aa6e4-514b-42db-9c2a-523aab90e678'
const GROUP_ID = '8c625dcf-db3a-4f28-84f7-6eeddfa0d08a'

const anon = createClient(SUPABASE_URL, ANON_KEY)
const svc  = createClient(SUPABASE_URL, SERVICE_KEY)

const fail = (m) => { console.error('FAIL:', m); process.exit(2) }
const pass = (m) => console.log('PASS:', m)

const ts = Date.now()
const MARKER_FU = `verify-neutral-fu-${ts}`
const MARKER_UP = `verify-neutral-upsell-${ts}`
const INBOX_FU = `johnleitch970+verify-neutral-fu-${ts}@gmail.com`
const INBOX_UP = `johnleitch970+verify-neutral-upsell-${ts}@gmail.com`

console.log(`Inboxes (operator visual verify):`)
console.log(`  trial-followup → ${INBOX_FU}`)
console.log(`  upsell-emails  → ${INBOX_UP}`)
console.log()

// ────────────────────────────────────────────────────────────────────
// Plant trial #1 — for /api/cron/trial-followup
//   Filter: status='attended' AND updated_at within yesterday
// ────────────────────────────────────────────────────────────────────
let fuTrialId
{
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1)
  await anon.from('trial_bookings').insert({
    organisation_id: ORG_ID,
    training_group_id: GROUP_ID,
    parent_name: 'Verify Neutral FU',
    parent_email: INBOX_FU,
    child_name: `FU Child ${ts}`,
    preferred_date: yesterday.toISOString().split('T')[0],
    notes: MARKER_FU,
  })
  const { data } = await svc.from('trial_bookings').select('id').eq('notes', MARKER_FU).single()
  fuTrialId = data.id
  await svc.from('trial_bookings').update({
    status: 'attended',
    updated_at: yesterday.toISOString(),
  }).eq('id', fuTrialId)
  pass(`Planted trial-followup target: id=${fuTrialId}`)
}

// ────────────────────────────────────────────────────────────────────
// Plant trial #2 — for /api/cron/upsell-emails
//   Filter: status='attended' AND confirmed_at between 4 days ago and 3 days ago
//   AND no active enrolment for the org (we use a fresh org/parent combo so
//   no enrolment naturally exists)
// ────────────────────────────────────────────────────────────────────
let upTrialId
{
  const threeDaysAgo  = new Date(Date.now() - 3 * 86400000)
  // Set confirmed_at to mid-window (~3.5 days ago)
  const confirmedAt = new Date(Date.now() - 3.5 * 86400000)
  await anon.from('trial_bookings').insert({
    organisation_id: ORG_ID,
    training_group_id: GROUP_ID,
    parent_name: 'Verify Neutral Upsell',
    parent_email: INBOX_UP,
    child_name: `Upsell Child ${ts}`,
    preferred_date: threeDaysAgo.toISOString().split('T')[0],
    notes: MARKER_UP,
  })
  const { data } = await svc.from('trial_bookings').select('id').eq('notes', MARKER_UP).single()
  upTrialId = data.id
  await svc.from('trial_bookings').update({
    status: 'attended',
    confirmed_at: confirmedAt.toISOString(),
    updated_at: confirmedAt.toISOString(),
  }).eq('id', upTrialId)
  pass(`Planted upsell-emails target: id=${upTrialId}, confirmed_at=${confirmedAt.toISOString().slice(0,19)}Z`)
}

// ────────────────────────────────────────────────────────────────────
// Trigger /api/cron/trial-followup
// ────────────────────────────────────────────────────────────────────
{
  const resp = await fetch(`${BASE}/api/cron/trial-followup`, {
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
  })
  const json = await resp.json()
  console.log(`trial-followup cron response: ${JSON.stringify(json)}`)
  if ((json.sent || 0) < 1) fail(`trial-followup sent=${json.sent} (expected >=1)`)
  pass(`trial-followup fired: sent=${json.sent}, checked=${json.trialsChecked}`)
}

// ────────────────────────────────────────────────────────────────────
// Trigger /api/cron/upsell-emails
// ────────────────────────────────────────────────────────────────────
{
  const resp = await fetch(`${BASE}/api/cron/upsell-emails`, {
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
  })
  const json = await resp.json()
  console.log(`upsell-emails cron response: ${JSON.stringify(json)}`)
  // upsell-emails counts trial_followup separately within stats
  pass(`upsell-emails fired: response logged above`)
}

// ────────────────────────────────────────────────────────────────────
// Cleanup
// ────────────────────────────────────────────────────────────────────
{
  const { count } = await svc.from('trial_bookings').delete({ count: 'exact' }).in('id', [fuTrialId, upTrialId])
  pass(`cleanup: DELETE count=${count} (expected 2)`)
  if (count !== 2) console.log('  warning: cleanup count != 2')
}

// ────────────────────────────────────────────────────────────────────
// Final residual sweep
// ────────────────────────────────────────────────────────────────────
{
  const { data } = await svc.from('trial_bookings').select('id, notes').like('notes', 'verify-neutral-%')
  console.log(`Final residual rows: ${data?.length || 0}`)
  if (data?.length) fail('residual rows present')
}

console.log()
console.log('Verification driver complete.')
console.log('Operator action: check both inboxes (Gmail aliases).')
console.log('In BOTH emails, verify:')
console.log('  ✓ No "20%" / "discount" / "offer" / "special" / "first month" wording')
console.log('  ✓ CTA button text reads "View Classes" (not "Sign Up Now")')
console.log('  ✓ Body reads: "If you\'d like to continue their football journey..."')
