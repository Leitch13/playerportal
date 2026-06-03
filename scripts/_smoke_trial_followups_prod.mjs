/**
 * Phase 2.4 smoke test against live production data.
 *
 * READ-ONLY. Runs the same loader logic as src/lib/trial-followups-loader.ts
 * against every organisation and reports the size of the follow-up cohort.
 *
 *   set -a && source /tmp/.env.prod && set +a && \
 *   node scripts/_smoke_trial_followups_prod.mjs
 *
 * Goal: confirm the loader doesn't throw for any live org, and surface
 * how many trials actually need follow-up per org. No writes.
 */
import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const NOW = Date.now()

// ─── derive (copy of trial-derive.ts) ─────────────────────────────────
function startOfUtcDay(ms) {
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

async function runForOrg(name, orgId) {
  const counts = { bookings_total: 0, bookings_followup: 0, bookings_stale: 0,
                   enrolments_total: 0, enrolments_followup: 0, errors: 0 }

  try {
    const { data: bookings, error: bErr } = await sb
      .from('trial_bookings')
      .select('id, status, preferred_date, followup_sent, converted, updated_at')
      .eq('organisation_id', orgId)
      .or('converted.is.null,converted.eq.false')
      .neq('status', 'cancelled')
      .neq('status', 'no_show')
    if (bErr) { console.error(`  [${name}] bookings: ${bErr.message}`); counts.errors++ }
    else if (bookings) {
      counts.bookings_total = bookings.length
      for (const b of bookings) {
        const stage = deriveBooking(b)
        if (needs(stage)) counts.bookings_followup++
        if (stage === 'stale_followup') counts.bookings_stale++
      }
    }
  } catch (e) { console.error(`  [${name}] bookings threw: ${e.message}`); counts.errors++ }

  try {
    const { data: enrolments, error: eErr } = await sb
      .from('enrolments')
      .select('id, status, is_trial, trial_expires_at, activates_on')
      .eq('organisation_id', orgId)
      .eq('is_trial', true)
      .neq('status', 'cancelled')
    if (eErr) { console.error(`  [${name}] enrolments: ${eErr.message}`); counts.errors++ }
    else if (enrolments) {
      counts.enrolments_total = enrolments.length
      for (const e of enrolments) {
        const stage = deriveEnrolment(e)
        if (needs(stage)) counts.enrolments_followup++
      }
    }
  } catch (e) { console.error(`  [${name}] enrolments threw: ${e.message}`); counts.errors++ }

  return counts
}

const { data: orgs } = await sb.from('organisations').select('id, name').order('name')
console.log(`\nPhase 2.4 smoke — ${orgs.length} orgs\n`)
console.log('org                          | book(tot/fu/stale) | enr(tot/fu) | total_fu')
console.log('─────────────────────────────┼────────────────────┼─────────────┼─────────')
let totalFollowUp = 0
for (const o of orgs) {
  const c = await runForOrg(o.name, o.id)
  const total = c.bookings_followup + c.enrolments_followup
  totalFollowUp += total
  const name = (o.name || '').padEnd(28).slice(0, 28)
  console.log(
    `${name} | ${String(c.bookings_total).padStart(3)}/${String(c.bookings_followup).padStart(3)}/${String(c.bookings_stale).padStart(3).padEnd(8)} | ${String(c.enrolments_total).padStart(3)}/${String(c.enrolments_followup).padStart(3).padEnd(5)} | ${String(total).padStart(7)}`
  )
}
console.log(`\nTotal follow-up cohort across all orgs: ${totalFollowUp}`)
