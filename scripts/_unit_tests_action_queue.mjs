/**
 * Unit test for the ActionQueueCard's pure prop contract.
 *
 * We can't easily render React server components from a CLI script without
 * pulling in the full Next.js runtime, so this test exercises the COUNTS
 * loader from src/lib/dashboard-action-queue.ts with a fake Supabase client.
 *
 * Coverage:
 *  - All five fields are returned (pending, past_due, trials-7d, attention,
 *    waivers)
 *  - Failure on any single query returns 0 for that field (defensive)
 *  - Org-scoping is preserved (only rows matching organisation_id are counted)
 *
 * Run with:  npx tsx scripts/_unit_tests_action_queue.mjs
 */
import { loadActionQueueCounts } from '../src/lib/dashboard-action-queue.ts'

const ORG_ID = 'org-jamie'

// Tiny in-memory fake Supabase. Each .from(table) returns a chainable obj
// whose terminal methods (.then via Promise) return { data, count }.
// The fake records the (table, filters) for assertion if we wanted.
function makeFake(state) {
  return {
    from(table) {
      const filters = { eq: {}, in: {}, gte: null, lte: null, head: false }
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const builder = {
        select(_cols, opts) {
          filters.head = !!opts?.head
          return builder
        },
        eq(k, v) { filters.eq[k] = v; return builder },
        in(k, v) { filters.in[k] = v; return builder },
        gte(k, v) { if (k === 'trial_expires_at') filters.gte = v; return builder },
        lte(k, v) { if (k === 'trial_expires_at') filters.lte = v; return builder },
        order() { return builder },
        then(resolve) {
          const rows = (state[table] || []).filter(r => {
            for (const [k, v] of Object.entries(filters.eq)) {
              if (r[k] !== v) return false
            }
            for (const [k, vs] of Object.entries(filters.in)) {
              if (!vs.includes(r[k])) return false
            }
            if (filters.gte && r.trial_expires_at < filters.gte) return false
            if (filters.lte && r.trial_expires_at > filters.lte) return false
            return true
          })
          resolve({ data: rows, count: filters.head ? rows.length : null, error: null })
        },
      }
      return builder
    },
  }
}

const results = []
const check = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want)
  results.push({ name, pass, got, want })
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`)
}

console.log('\n──── PHASE 1 — counts are returned ────')
{
  const today = new Date().toISOString().slice(0, 10)
  const in3d = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10)
  const in10d = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10)
  const state = {
    subscriptions: [
      { id: 's1', organisation_id: ORG_ID, status: 'scheduled' },
      { id: 's2', organisation_id: ORG_ID, status: 'scheduled' },
      { id: 's3', organisation_id: ORG_ID, status: 'past_due' },
      { id: 's4', organisation_id: 'other', status: 'past_due' },   // other org — should NOT count
    ],
    enrolments: [
      { id: 'e1', organisation_id: ORG_ID, is_trial: true,  trial_expires_at: in3d,  status: 'active', player_id: 'p1' },
      { id: 'e2', organisation_id: ORG_ID, is_trial: true,  trial_expires_at: in10d, status: 'active', player_id: 'p2' },   // outside 7d
      { id: 'e3', organisation_id: ORG_ID, is_trial: false, trial_expires_at: null,  status: 'active', player_id: 'p3' },
      { id: 'e4', organisation_id: 'other', is_trial: true, trial_expires_at: in3d, status: 'active', player_id: 'pX' },    // other org
    ],
    progress_reviews: [
      // p1 was reviewed yesterday → NOT overdue
      { player_id: 'p1', review_date: new Date(Date.now() - 86_400_000).toISOString().slice(0, 10) },
      // p2 was reviewed 5 days ago → NOT overdue
      { player_id: 'p2', review_date: new Date(Date.now() - 5 * 86_400_000).toISOString().slice(0, 10) },
      // p3 was reviewed 60 days ago → IS overdue (the only one)
      { player_id: 'p3', review_date: new Date(Date.now() - 60 * 86_400_000).toISOString().slice(0, 10) },
    ],
    waivers: [],
    waiver_signatures: [],
    players: [],
  }
  // suppress unused-var lint
  void today
  const counts = await loadActionQueueCounts(makeFake(state), ORG_ID)
  check('pendingStarts (scheduled in this org)', counts.pendingStarts, 2)
  check('pastDuePayments (other-org excluded)', counts.pastDuePayments, 1)
  check('trialsExpiring7d (only in-window in this org)', counts.trialsExpiring7d, 1)
  check('needingAttention (p3 overdue review)', counts.needingAttention, 1)
  check('unsignedWaivers (no active waivers)', counts.unsignedWaivers, 0)
}

console.log('\n──── PHASE 2 — defensive: returns 0 for failing queries ────')
{
  const exploding = {
    from() {
      throw new Error('synthetic error')
    },
  }
  const counts = await loadActionQueueCounts(exploding, ORG_ID)
  check('all-fail → all 0s', counts, {
    pendingStarts: 0, pastDuePayments: 0, trialsExpiring7d: 0,
    needingAttention: 0, unsignedWaivers: 0,
  })
}

console.log('\n──── PHASE 3 — empty org → all 0s ────')
{
  const empty = makeFake({ subscriptions: [], enrolments: [], progress_reviews: [], waivers: [], waiver_signatures: [], players: [] })
  const counts = await loadActionQueueCounts(empty, ORG_ID)
  check('empty → 0 everywhere', counts, {
    pendingStarts: 0, pastDuePayments: 0, trialsExpiring7d: 0,
    needingAttention: 0, unsignedWaivers: 0,
  })
}

console.log('\n──── SUMMARY ────')
const passed = results.filter(r => r.pass).length
const failed = results.filter(r => !r.pass).length
console.log(`  ${passed} pass / ${failed} fail / ${results.length} total`)
process.exit(failed > 0 ? 1 : 0)
