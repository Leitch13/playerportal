/**
 * Day 1 — messages-derive unit tests (no I/O, no DB).
 *
 *   node scripts/_unit_tests_messages_derive.mjs
 *
 * Proves the pure derive layer that powers /dashboard/messages:
 *   • thread grouping by thread_id (with null → standalone-by-id)
 *   • newest-first thread sort
 *   • unread count = unread + recipient is current user
 *   • subject inheritance from the opening message
 *   • profile resolution + skeleton fallback for missing profile
 *   • robustness to unsorted input + bad rows
 *   • org isolation (the page passes pre-filtered rows; derive trusts that)
 *
 * Mirrors the Phase 2.4-2.9 derive-test convention.
 */
import { deriveThreads } from '../src/lib/messages-derive.ts'

let pass = 0, fail = 0
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (ok) { pass++; console.log(`  PASS  ${name}`) }
  else { fail++; console.log(`  FAIL  ${name}\n        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`) }
}

const USER_A = 'aaaaaaaa-0000-0000-0000-000000000001'
const USER_B = 'bbbbbbbb-0000-0000-0000-000000000002'
const USER_C = 'cccccccc-0000-0000-0000-000000000003'
const TH1 = '11111111-0000-0000-0000-000000000001'
const TH2 = '22222222-0000-0000-0000-000000000002'

const profA = { id: USER_A, full_name: 'Adam Admin', role: 'admin' }
const profB = { id: USER_B, full_name: 'Bobby Parent', role: 'parent' }
const profC = { id: USER_C, full_name: 'Cara Parent', role: 'parent' }
const profileMap = new Map([[USER_A, profA], [USER_B, profB], [USER_C, profC]])

// ─── BASIC: empty input → empty array ───
console.log('\n── Empty input ──')
eq('empty array returns []', deriveThreads([], profileMap, USER_A), [])
eq('null returns []', deriveThreads(null, profileMap, USER_A), [])
eq('undefined returns []', deriveThreads(undefined, profileMap, USER_A), [])

// ─── BASIC: single message → single thread ───
console.log('\n── Single message ──')
{
  const rows = [{
    id: 'm1', thread_id: TH1, sender_id: USER_A, recipient_id: USER_B,
    subject: 'Welcome', body: 'Hi Bobby', read: false, created_at: '2026-06-01T10:00:00Z',
  }]
  const threads = deriveThreads(rows, profileMap, USER_A)
  eq('1 row → 1 thread', threads.length, 1)
  eq('threadId = thread_id', threads[0].threadId, TH1)
  eq('subject preserved', threads[0].subject, 'Welcome')
  eq('lastMessage is the row', threads[0].lastMessage.id, 'm1')
  eq('unreadCount=0 for sender (recipient is the other user)', threads[0].unreadCount, 0)
  eq('totalMessages=1', threads[0].totalMessages, 1)
  eq('2 participants', threads[0].participants.length, 2)
}

// ─── Multi-message thread with replies ───
console.log('\n── Multi-message thread (subject inheritance + last by created_at) ──')
{
  const rows = [
    { id: 'm2', thread_id: TH1, sender_id: USER_B, recipient_id: USER_A, subject: null, body: 'Reply 1', read: false, created_at: '2026-06-01T11:00:00Z' },
    { id: 'm1', thread_id: TH1, sender_id: USER_A, recipient_id: USER_B, subject: 'Welcome', body: 'Hi Bobby', read: true, created_at: '2026-06-01T10:00:00Z' },
    { id: 'm3', thread_id: TH1, sender_id: USER_A, recipient_id: USER_B, subject: null, body: 'Reply 2', read: false, created_at: '2026-06-01T12:00:00Z' },
  ]
  const threads = deriveThreads(rows, profileMap, USER_A)
  eq('1 thread from 3 messages', threads.length, 1)
  eq('subject inherited from opening (m1)', threads[0].subject, 'Welcome')
  eq('lastMessage is newest (m3)', threads[0].lastMessage.id, 'm3')
  eq('totalMessages=3', threads[0].totalMessages, 3)
  // USER_A's unread = m2 (recipient=A, unread). m1 is read. m3 was sent BY A so doesn't count.
  eq('unread for USER_A = 1 (m2 only)', threads[0].unreadCount, 1)
  // From USER_B's perspective: m1 is read, m3 is unread. m2 was sent BY B so doesn't count.
  const threadsB = deriveThreads(rows, profileMap, USER_B)
  eq('unread for USER_B = 1 (m3 only, m1 was read)', threadsB[0].unreadCount, 1)
}

// ─── Multiple threads → newest-first sort ───
console.log('\n── Multiple threads + sort ──')
{
  const rows = [
    { id: 'm-old', thread_id: TH1, sender_id: USER_A, recipient_id: USER_B, subject: 'Old', body: 'Old', read: true, created_at: '2026-05-01T10:00:00Z' },
    { id: 'm-new', thread_id: TH2, sender_id: USER_A, recipient_id: USER_C, subject: 'New', body: 'New', read: false, created_at: '2026-06-01T10:00:00Z' },
  ]
  const threads = deriveThreads(rows, profileMap, USER_A)
  eq('2 threads', threads.length, 2)
  eq('newest thread first', threads[0].threadId, TH2)
  eq('oldest thread last', threads[1].threadId, TH1)
}

// ─── thread_id null → grouped by own id ───
console.log('\n── thread_id null → standalone-by-id ──')
{
  const rows = [
    { id: 'm-solo-1', thread_id: null, sender_id: USER_A, recipient_id: USER_B, subject: 'Solo 1', body: 'b', read: false, created_at: '2026-06-01T10:00:00Z' },
    { id: 'm-solo-2', thread_id: null, sender_id: USER_A, recipient_id: USER_C, subject: 'Solo 2', body: 'b', read: false, created_at: '2026-06-01T11:00:00Z' },
  ]
  const threads = deriveThreads(rows, profileMap, USER_A)
  eq('null thread_ids → 2 standalone threads', threads.length, 2)
  eq('standalone thread uses message id as key', threads[1].threadId, 'm-solo-1')
}

// ─── Unread count excludes own sends ───
console.log('\n── Unread is recipient-scoped ──')
{
  const rows = [
    { id: 'm1', thread_id: TH1, sender_id: USER_A, recipient_id: USER_B, subject: 's', body: 'b', read: false, created_at: '2026-06-01T10:00:00Z' },
    { id: 'm2', thread_id: TH1, sender_id: USER_A, recipient_id: USER_B, subject: null, body: 'b', read: false, created_at: '2026-06-01T11:00:00Z' },
  ]
  // From sender's view: 0 unread (they sent both)
  const senderThreads = deriveThreads(rows, profileMap, USER_A)
  eq('sender unread=0 even when both unread', senderThreads[0].unreadCount, 0)
  // From recipient's view: 2 unread
  const recipientThreads = deriveThreads(rows, profileMap, USER_B)
  eq('recipient unread=2 when both unread', recipientThreads[0].unreadCount, 2)
}

// ─── Missing profile → skeleton ───
console.log('\n── Missing profile fallback ──')
{
  const rows = [
    { id: 'm1', thread_id: TH1, sender_id: USER_A, recipient_id: 'ghost-user-id', subject: 's', body: 'b', read: false, created_at: '2026-06-01T10:00:00Z' },
  ]
  const threads = deriveThreads(rows, profileMap, USER_A)
  eq('2 participants even when one is missing', threads[0].participants.length, 2)
  const ghost = threads[0].participants.find(p => p.id === 'ghost-user-id')
  eq('missing participant has skeleton (no name)', ghost.full_name, null)
}

// ─── Robust to bad rows ───
console.log('\n── Bad-row robustness ──')
{
  const rows = [
    null,
    undefined,
    {},
    { id: '', sender_id: '', recipient_id: '' },
    { id: 'good', thread_id: TH1, sender_id: USER_A, recipient_id: USER_B, subject: 's', body: 'b', read: false, created_at: '2026-06-01T10:00:00Z' },
  ]
  const threads = deriveThreads(rows, profileMap, USER_A)
  eq('only valid rows produce threads', threads.length, 1)
  eq('valid row preserved', threads[0].lastMessage.id, 'good')
}

// ─── Delivery columns optional ───
console.log('\n── Delivery columns optional ──')
{
  const rowsNoDelivery = [
    { id: 'm1', thread_id: TH1, sender_id: USER_A, recipient_id: USER_B, subject: 's', body: 'b', read: false, created_at: '2026-06-01T10:00:00Z' },
  ]
  const rowsWithDelivery = [
    { id: 'm1', thread_id: TH1, sender_id: USER_A, recipient_id: USER_B, subject: 's', body: 'b', read: false, created_at: '2026-06-01T10:00:00Z',
      channel: 'email', delivery_status: 'sent', delivery_failure_reason: null },
  ]
  const a = deriveThreads(rowsNoDelivery, profileMap, USER_A)
  const b = deriveThreads(rowsWithDelivery, profileMap, USER_A)
  eq('derive works without delivery columns', a.length, 1)
  eq('derive surfaces delivery_status when present', b[0].lastMessage.delivery_status, 'sent')
  eq('derive surfaces channel when present', b[0].lastMessage.channel, 'email')
}

// ─── 3-party thread (broadcast scenario) ───
console.log('\n── Broadcast → multiple 2-party threads (one per recipient) ──')
{
  // Real-world: BulkMessageForm sends one row per recipient with separate thread_ids
  // OR shared thread_id. Test shared thread_id case.
  const rows = [
    { id: 'b1', thread_id: TH1, sender_id: USER_A, recipient_id: USER_B, subject: 'Notice', body: 'Hi all', read: false, created_at: '2026-06-01T10:00:00Z' },
    { id: 'b2', thread_id: TH1, sender_id: USER_A, recipient_id: USER_C, subject: 'Notice', body: 'Hi all', read: false, created_at: '2026-06-01T10:00:00Z' },
  ]
  const threads = deriveThreads(rows, profileMap, USER_A)
  // When sharing thread_id, they collapse into one thread with 3 participants
  eq('shared thread_id → 1 thread', threads.length, 1)
  eq('3 unique participants', threads[0].participants.length, 3)
}

console.log('\n──── SUMMARY ────')
console.log(`  ${pass} pass / ${fail} fail / ${pass + fail} total`)
process.exit(fail > 0 ? 1 : 0)
