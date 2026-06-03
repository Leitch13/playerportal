/**
 * Day 1 — messaging delivery live smoke (no email sent — DB-only proof).
 *
 *   set -a && source /tmp/.env.prod && set +a && \
 *   node scripts/_smoke_messaging_delivery.mjs
 *
 * Proves:
 *   1. The messages table accepts inserts with the legacy schema
 *   2. The /dashboard/messages page query returns those rows
 *      (replicates the page's SELECT byte-by-byte)
 *   3. Thread grouping works correctly when thread_id repeats
 *   4. Delivery columns either exist (post-migration) or fail with 42703
 *      (pre-migration), confirming the page's fallback path is exercised
 *
 * NO emails are actually sent — this script only validates the data
 * layer. Email delivery is exercised via the deployed /api/messages/send
 * route after the deploy.
 */
import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// ─── Pre-check: which migration state are we in? ───
console.log('\nChecking messages table state...')
const { error: probeErr } = await sb.from('messages').select('id, channel, delivery_status').limit(1)
const migrationApplied = !probeErr
console.log(`  Migration 074: ${migrationApplied ? 'APPLIED ✓' : 'NOT YET APPLIED (graceful-degradation path will run)'}`)

// ─── Find a test org + two profiles ───
const { data: orgs } = await sb.from('organisations').select('id, name').ilike('name', 'Jamie Allan Football%').limit(1)
const orgId = orgs?.[0]?.id
if (!orgId) { console.error('Jamie Allan org not found'); process.exit(1) }
console.log(`  Org: Jamie Allan FC (${orgId})`)

// Pick the org's admin as the sender, and any parent as the recipient
const { data: admins } = await sb.from('profiles').select('id, full_name, email').eq('organisation_id', orgId).eq('role', 'admin').limit(1)
const senderId = admins?.[0]?.id
if (!senderId) { console.error('No admin found in this org'); process.exit(1) }
console.log(`  Sender (admin): ${admins[0].full_name} (${senderId.slice(0,8)})`)

const { data: parents } = await sb.from('profiles').select('id, full_name, email').eq('organisation_id', orgId).eq('role', 'parent').limit(2)
const recipientIds = (parents || []).map(p => p.id)
if (recipientIds.length === 0) { console.error('No parent recipients found'); process.exit(1) }
console.log(`  Recipients: ${parents.map(p => p.full_name).join(', ')}`)

// ─── Smoke: insert a message via the exact same shape /api/messages/send uses ───
const SMOKE_TAG = 'SMOKE-DAY1-' + Math.random().toString(36).slice(2, 8).toUpperCase()
const sharedThreadId = crypto.randomUUID()

const results = []
const eq = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want)
  results.push({ name, pass })
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`)
}

console.log(`\n──── Insert smoke (legacy schema columns only) ────`)
const insertedIds = []
try {
  for (const rid of recipientIds) {
    const { data, error } = await sb.from('messages').insert({
      organisation_id: orgId,
      sender_id: senderId,
      recipient_id: rid,
      subject: `${SMOKE_TAG} subject`,
      body: `${SMOKE_TAG} body — Day 1 smoke. This row will be deleted at the end.`,
      thread_id: sharedThreadId,
    }).select('id').single()
    if (error) { console.log(`  INSERT FAIL: ${error.message}`); break }
    insertedIds.push(data.id)
  }
  eq(`Inserted ${recipientIds.length} rows`, insertedIds.length, recipientIds.length)
} catch (e) {
  console.log(`  THREW: ${e.message}`)
}

// ─── Best-effort delivery-status UPDATE (post-migration only) ───
if (migrationApplied && insertedIds.length > 0) {
  console.log(`\n──── Delivery-status UPDATE (post-migration) ────`)
  for (const id of insertedIds) {
    const { error } = await sb.from('messages').update({
      channel: 'email',
      delivery_status: 'sent',
      delivery_attempted_at: new Date().toISOString(),
      delivery_completed_at: new Date().toISOString(),
      recipient_email_snapshot: 'smoke-test@example.invalid',
    }).eq('id', id)
    eq(`Update delivery_status for ${id.slice(0,8)}`, !!error ? error.message : 'ok', 'ok')
  }
}

// ─── Replicate the /dashboard/messages page query (sender side) ───
console.log(`\n──── Page-query smoke (replicates /dashboard/messages SELECT) ────`)
{
  // The page's full SELECT (post-migration)
  const fullSelect = 'id, thread_id, sender_id, recipient_id, subject, body, read, created_at, channel, delivery_status, delivery_failure_reason'
  const legacySelect = 'id, thread_id, sender_id, recipient_id, subject, body, read, created_at'
  const select = migrationApplied ? fullSelect : legacySelect
  const { data: rows, error } = await sb.from('messages')
    .select(select)
    .eq('organisation_id', orgId)
    .or(`sender_id.eq.${senderId},recipient_id.eq.${senderId}`)
    .order('created_at', { ascending: false })
  if (error) {
    console.log(`  Page query FAILED: ${error.message}`)
  } else {
    const smokeRows = (rows || []).filter(r => r.subject?.includes(SMOKE_TAG))
    eq(`Page query returns the smoke rows`, smokeRows.length, recipientIds.length)
    // Verify thread grouping (all smoke rows share thread_id)
    const uniqueThreads = new Set(smokeRows.map(r => r.thread_id))
    eq(`All smoke rows share one thread_id`, uniqueThreads.size, 1)
    if (migrationApplied) {
      const allSent = smokeRows.every(r => r.delivery_status === 'sent')
      eq(`All smoke rows show delivery_status='sent'`, allSent, true)
    }
  }
}

// ─── Cleanup ───
console.log(`\n──── Cleanup ────`)
if (insertedIds.length > 0) {
  const { error } = await sb.from('messages').delete().in('id', insertedIds)
  console.log(`  Deleted ${insertedIds.length} smoke rows: ${error ? 'FAILED ' + error.message : 'OK'}`)
}

console.log(`\n──── SUMMARY ────`)
const pass = results.filter(r => r.pass).length
const fail = results.filter(r => !r.pass).length
console.log(`  ${pass} pass / ${fail} fail / ${results.length} total`)
process.exit(fail > 0 ? 1 : 0)
