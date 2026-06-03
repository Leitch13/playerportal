/**
 * Phase 2.4 step 3 — Parents List filter smoke test (production data).
 *
 * READ-ONLY. For each org:
 *   1. Loads the trial follow-up cohort (same logic as trial-followups-loader)
 *   2. Walks the parent profiles
 *   3. Counts: parents matched by FK, parents matched by email,
 *              booking rows that ended up orphan (no FK, no email match)
 *
 *   set -a && source /tmp/.env.prod && set +a && \
 *   node scripts/_smoke_trial_followup_parents_prod.mjs
 *
 * Goal: tell the user exactly how many parents will see the badge,
 *       and how many booking rows fail to attach to any family row.
 */
import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const NOW = Date.now()

// ─── derive (mirror of trial-derive.ts) ───────────────────────────────
const startOfUtcDay = (ms) => {
  const d = new Date(ms)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}
const STALE = 7
function deriveBooking(b, nowMs = NOW) {
  if (b.converted === true) return 'converted'
  const s = (b.status || '').toLowerCase()
  if (s === 'cancelled' || s === 'no_show') return 'lost'
  if (s === 'attended') {
    if (!b.followup_sent) return 'awaiting_followup'
    const ref = b.updated_at || b.preferred_date
    if (!ref) return 'followed_up'
    const refMs = Date.parse(ref)
    if (isNaN(refMs)) return 'followed_up'
    return Math.floor((nowMs - refMs) / 86_400_000) > STALE ? 'stale_followup' : 'followed_up'
  }
  if (!b.preferred_date) return 'upcoming'
  const pms = Date.parse(b.preferred_date + 'T00:00:00Z')
  if (isNaN(pms)) return 'upcoming'
  const t = startOfUtcDay(nowMs)
  if (pms > t) return 'upcoming'
  if (pms === t) return 'today'
  return 'awaiting_followup'
}
function deriveEnrolment(e, nowMs = NOW) {
  const s = (e.status || '').toLowerCase()
  if (s === 'cancelled' || s === 'inactive' || s === 'paused') return 'lost'
  if (e.is_trial === false) return 'converted'
  if (s === 'pending') return 'upcoming'
  if (s === 'active') {
    if (!e.trial_expires_at) return 'today'
    const ms = Date.parse(e.trial_expires_at + 'T00:00:00Z')
    if (isNaN(ms)) return 'today'
    return ms <= startOfUtcDay(nowMs) ? 'awaiting_followup' : 'today'
  }
  return 'today'
}
const needs = (s) => s === 'awaiting_followup' || s === 'stale_followup'
const pickMore = (a, b) => (a === 'stale_followup' || b === 'stale_followup') ? 'stale_followup'
  : (a === 'awaiting_followup' || b === 'awaiting_followup') ? 'awaiting_followup' : a

// ─── Per-org check ────────────────────────────────────────────────────
async function runForOrg(name, orgId) {
  const result = {
    parents_total: 0,
    follow_ups_total: 0,
    follow_ups_via_fk: 0,
    follow_ups_via_email: 0,
    follow_ups_orphan: 0,
    parents_badged: 0,
    parents_stale: 0,
    parents_awaiting: 0,
    errors: 0,
  }

  // Parents
  const { data: parents, error: pErr } = await sb
    .from('profiles')
    .select('id, email')
    .eq('organisation_id', orgId)
    .eq('role', 'parent')
  if (pErr) { console.error(`  [${name}] parents: ${pErr.message}`); result.errors++; return result }
  result.parents_total = (parents || []).length

  // Trial bookings (excluding terminal cohorts)
  const { data: bookings, error: bErr } = await sb
    .from('trial_bookings')
    .select('id, status, preferred_date, followup_sent, converted, updated_at, parent_email')
    .eq('organisation_id', orgId)
    .or('converted.is.null,converted.eq.false')
    .neq('status', 'cancelled')
    .neq('status', 'no_show')
  if (bErr) { console.error(`  [${name}] bookings: ${bErr.message}`); result.errors++ }

  // Enrolment trials
  const { data: enrolments, error: eErr } = await sb
    .from('enrolments')
    .select('id, status, is_trial, trial_expires_at, activates_on, player_id, player:players!enrolments_player_id_fkey(parent_id)')
    .eq('organisation_id', orgId)
    .eq('is_trial', true)
    .neq('status', 'cancelled')
  if (eErr) { console.error(`  [${name}] enrolments: ${eErr.message}`); result.errors++ }

  // Build follow-up cohort
  const followUps = []
  for (const b of bookings || []) {
    const stage = deriveBooking(b)
    if (needs(stage)) followUps.push({ source: 'booking', stage, parentId: null, parentEmail: b.parent_email || null })
  }
  for (const e of enrolments || []) {
    const stage = deriveEnrolment(e)
    if (needs(stage)) followUps.push({ source: 'enrolment', stage, parentId: e.player?.parent_id || null, parentEmail: null })
  }
  result.follow_ups_total = followUps.length

  // Match
  const emailSet = new Set((parents || []).filter(p => p.email).map(p => p.email.trim().toLowerCase()))
  const fkMap = new Map(), emailMap = new Map()
  for (const f of followUps) {
    if (f.parentId) {
      result.follow_ups_via_fk++
      const prev = fkMap.get(f.parentId)
      fkMap.set(f.parentId, prev ? pickMore(prev, f.stage) : f.stage)
    } else if (f.parentEmail) {
      const key = f.parentEmail.trim().toLowerCase()
      if (key && emailSet.has(key)) {
        result.follow_ups_via_email++
        const prev = emailMap.get(key)
        emailMap.set(key, prev ? pickMore(prev, f.stage) : f.stage)
      } else {
        result.follow_ups_orphan++
      }
    } else {
      result.follow_ups_orphan++
    }
  }

  // Per-parent badge count
  for (const p of (parents || [])) {
    const fk = fkMap.get(p.id) ?? null
    const email = p.email ? emailMap.get(p.email.trim().toLowerCase()) ?? null : null
    const stage = (fk && email) ? pickMore(fk, email) : (fk ?? email)
    if (stage) {
      result.parents_badged++
      if (stage === 'stale_followup') result.parents_stale++
      else if (stage === 'awaiting_followup') result.parents_awaiting++
    }
  }
  return result
}

// ─── Drive ─────────────────────────────────────────────────────────────
const { data: orgs } = await sb.from('organisations').select('id, name').order('name')

console.log(`\nPhase 2.4 step 3 — Parents List filter smoke — ${orgs.length} orgs\n`)
console.log('org                          | par_total | fu_total | fu_fk | fu_email | fu_orphan | parents_badged (stale/await)')
console.log('─────────────────────────────┼───────────┼──────────┼───────┼──────────┼───────────┼──────────────────────────────')

let totalBadged = 0, totalOrphan = 0
for (const o of orgs) {
  const r = await runForOrg(o.name, o.id)
  totalBadged += r.parents_badged
  totalOrphan += r.follow_ups_orphan
  const name = (o.name || '').padEnd(28).slice(0, 28)
  console.log(
    `${name} | ${String(r.parents_total).padStart(9)} | ${String(r.follow_ups_total).padStart(8)} | ${String(r.follow_ups_via_fk).padStart(5)} | ${String(r.follow_ups_via_email).padStart(8)} | ${String(r.follow_ups_orphan).padStart(9)} | ${String(r.parents_badged).padStart(6)} (${r.parents_stale}/${r.parents_awaiting})`,
  )
}

console.log(`\nAcross all orgs:`)
console.log(`  Parents that will get a trial follow-up badge: ${totalBadged}`)
console.log(`  Booking-source rows that COULDN'T attach to a parent (silently dropped from Parents page, still visible on Enrolments/Trials): ${totalOrphan}`)
