/**
 * Stage 3 session-mode UAT — clearly-marked test organisation.
 *
 * Creates a one-off test org + class + plan, drives the production page
 * via Chrome (separate orchestration), then deletes everything.
 *
 * Test data fingerprint: every row is marked with the timestamp so a stray
 * cleanup miss is trivially identifiable.
 *
 * Order of operations:
 *   1. Insert test organisation (bridge_billing_mode='session')
 *   2. Insert test training_group (Monday class)
 *   3. Insert test subscription_plan (£120, 4 sessions/month)
 *   4. Return the IDs/slug for Chrome navigation
 *   5. (Caller runs Chrome UAT, then re-invokes this script with --cleanup)
 *   6. Cleanup: delete plan → group → org. No FK cascade needed.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

function parseEnv(content) {
  const out = {}
  for (const raw of content.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 0) continue
    const key = line.slice(0, eq).trim()
    let val = line.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1)
    out[key] = val
  }
  return out
}
const env = parseEnv(readFileSync('/tmp/.env.prod', 'utf8'))
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const STATE_FILE = '/tmp/stage3-session-uat-state.json'
const TS = Date.now()
const SUFFIX = `UAT_SESSION_${TS}`

const mode = process.argv[2] || 'setup'

if (mode === 'setup') {
  console.log(`═══ Creating test rows (suffix: ${SUFFIX}) ═══`)

  // 1. test organisation
  const slug = `uat-session-bridge-${TS}`
  const { data: org, error: orgErr } = await supabase.from('organisations').insert({
    name: `UAT Session Bridge Test ${TS}`,
    slug,
    primary_color: '#ff6600',
    bridge_billing_mode: 'session',
  }).select().single()
  if (orgErr) { console.error('org insert failed:', orgErr); process.exit(1) }
  console.log(`  organisation: ${org.id} slug=${org.slug}`)

  // 2. test class — Monday 18:00 so picker preview can count Mondays cleanly
  const { data: cls, error: clsErr } = await supabase.from('training_groups').insert({
    organisation_id: org.id,
    name: `UAT Test Class ${TS}`,
    day_of_week: 'Monday',
    time_slot: '18:00–19:00',
    location: 'UAT-only',
    max_capacity: 10,
    class_type: '1-2-1',
  }).select().single()
  if (clsErr) { console.error('class insert failed:', clsErr); process.exit(1) }
  console.log(`  training_group: ${cls.id}`)

  // 3. test plan — £120/month, 4 sessions/month (clean £30/session math)
  const { data: plan, error: planErr } = await supabase.from('subscription_plans').insert({
    organisation_id: org.id,
    training_group_id: cls.id,
    name: `UAT Session Bridge Plan ${TS}`,
    description: 'Test plan for session-bridge UAT — should be cleaned up immediately',
    amount: 120,
    sessions_per_week: 1,
    sessions_per_month: 4,
    class_type: '1-2-1',
    interval: 'month',
    active: true,
  }).select().single()
  if (planErr) { console.error('plan insert failed:', planErr); process.exit(1) }
  console.log(`  subscription_plan: ${plan.id} (£${plan.amount}/mo, ${plan.sessions_per_month} sessions/mo)`)

  // Persist state for cleanup
  const state = {
    suffix: SUFFIX,
    slug: org.slug,
    org_id: org.id,
    class_id: cls.id,
    plan_id: plan.id,
    created_at: new Date().toISOString(),
    booking_url: `https://www.theplayerportal.net/book/${org.slug}/class/${cls.id}/quick-book?plan=${plan.id}&billing=monthly`,
  }
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))

  console.log(`\n═══ Booking URL for UAT ═══`)
  console.log(`  ${state.booking_url}`)
  console.log(`\n═══ State saved to ${STATE_FILE} ═══`)
  console.log(`  Run \`node ${process.argv[1]} cleanup\` after UAT.`)
} else if (mode === 'cleanup') {
  if (!existsSync(STATE_FILE)) { console.error(`No state file at ${STATE_FILE}`); process.exit(1) }
  const state = JSON.parse(readFileSync(STATE_FILE, 'utf8'))
  console.log(`═══ Cleaning up UAT rows (${state.suffix}) ═══`)

  // Reverse order: plan → group → org (no FK cascade needed)
  const r1 = await supabase.from('subscription_plans').delete().eq('id', state.plan_id)
  console.log(`  plan ${state.plan_id}: ${r1.error ? `FAILED ${r1.error.message}` : 'deleted'}`)

  const r2 = await supabase.from('training_groups').delete().eq('id', state.class_id)
  console.log(`  class ${state.class_id}: ${r2.error ? `FAILED ${r2.error.message}` : 'deleted'}`)

  const r3 = await supabase.from('organisations').delete().eq('id', state.org_id)
  console.log(`  org ${state.org_id}: ${r3.error ? `FAILED ${r3.error.message}` : 'deleted'}`)

  // Verify
  console.log(`\n═══ Cleanup verification ═══`)
  for (const [table, id] of [['subscription_plans', state.plan_id], ['training_groups', state.class_id], ['organisations', state.org_id]]) {
    const { count } = await supabase.from(table).select('id', { count: 'exact', head: true }).eq('id', id)
    console.log(`  ${table}.${id}: ${count} rows remaining`)
  }
} else if (mode === 'status') {
  if (!existsSync(STATE_FILE)) { console.error(`No state file at ${STATE_FILE}`); process.exit(1) }
  console.log(readFileSync(STATE_FILE, 'utf8'))
} else {
  console.error(`Unknown mode: ${mode}. Use 'setup' | 'cleanup' | 'status'.`)
  process.exit(1)
}
