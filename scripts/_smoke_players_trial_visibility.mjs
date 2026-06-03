/**
 * Verifies the empty state on /dashboard/players?filter=trial is correct.
 *
 *   set -a && source /tmp/.env.prod && set +a && \
 *   node scripts/_smoke_players_trial_visibility.mjs
 *
 * Counts:
 *   • trial_bookings  per org + cohort breakdown (active vs converted vs lost vs follow-up due)
 *   • enrolments.is_trial=true  per org + status breakdown
 *   • Players that SHOULD appear under existing 'Trial' filter
 *     (= any enrolment with is_trial=true AND status IN ('active','pending'))
 *   • Players that SHOULD appear under new 'Trial follow-up due' filter
 *     (= enrolment follow-up cohort, by playerId only — booking rows excluded)
 *
 * READ-ONLY.
 */
import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const NOW = Date.now()

const startOfUtcDay = (ms) => { const d = new Date(ms); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) }
const parseDb = (s) => Date.parse(/[T ]/.test(s) ? s : s + 'T00:00:00Z')
const STALE = 7
function deriveBooking(b, nowMs = NOW) {
  if (b.converted === true) return 'converted'
  const s = (b.status || '').toLowerCase()
  if (s === 'cancelled' || s === 'no_show') return 'lost'
  if (s === 'attended') {
    if (!b.followup_sent) return 'awaiting_followup'
    const ref = b.updated_at || b.preferred_date
    if (!ref) return 'followed_up'
    const refMs = parseDb(ref); if (isNaN(refMs)) return 'followed_up'
    return Math.floor((nowMs - refMs) / 86_400_000) > STALE ? 'stale_followup' : 'followed_up'
  }
  if (!b.preferred_date) return 'upcoming'
  const pms = parseDb(b.preferred_date); if (isNaN(pms)) return 'upcoming'
  const t = startOfUtcDay(nowMs)
  if (pms > t) return 'upcoming'; if (pms === t) return 'today'
  return 'awaiting_followup'
}
function deriveEnrolment(e, nowMs = NOW) {
  const s = (e.status || '').toLowerCase()
  if (s === 'cancelled' || s === 'inactive' || s === 'paused') return 'lost'
  if (e.is_trial === false) return 'converted'
  if (s === 'pending') return 'upcoming'
  if (s === 'active') {
    if (!e.trial_expires_at) return 'today'
    const ms = parseDb(e.trial_expires_at); if (isNaN(ms)) return 'today'
    return ms <= startOfUtcDay(nowMs) ? 'awaiting_followup' : 'today'
  }
  return 'today'
}
const needs = (s) => s === 'awaiting_followup' || s === 'stale_followup'

const { data: orgs } = await sb.from('organisations').select('id, name').order('name')

const totals = {
  bookings_all: 0,
  bookings_active_cohort: 0,
  bookings_followup_due: 0,
  bookings_converted: 0,
  bookings_lost: 0,
  bookings_orphan_no_player: 0,
  bookings_followup_emailed_to_parent: 0,
  enrolments_is_trial_true: 0,
  enrolments_in_followup: 0,
  players_existing_trial_filter: 0,
  players_new_followup_filter: 0,
}

const orgRows = []

for (const o of orgs) {
  // 1. trial_bookings — full
  const { data: bAll } = await sb.from('trial_bookings').select('id, status, preferred_date, followup_sent, converted, updated_at, parent_email').eq('organisation_id', o.id)
  const { data: bActive } = await sb.from('trial_bookings').select('id, status, preferred_date, followup_sent, converted, updated_at, parent_email').eq('organisation_id', o.id).or('converted.is.null,converted.eq.false').neq('status', 'cancelled').neq('status', 'no_show')

  // 2. enrolments.is_trial = true
  const { data: enrTrue } = await sb.from('enrolments').select('id, status, is_trial, trial_expires_at, activates_on, player_id, player:players!enrolments_player_id_fkey(parent_id)').eq('organisation_id', o.id).eq('is_trial', true)

  // 3. Parents in org (for booking-email match)
  const { data: parentRows } = await sb.from('profiles').select('id, email').eq('organisation_id', o.id).eq('role', 'parent')
  const emailSet = new Set((parentRows || []).filter(p => p.email).map(p => p.email.trim().toLowerCase()))

  // 4. Players list (the page query) — all players for org
  const { data: playersRaw } = await sb.from('players').select('id, enrolments(status, is_trial, trial_expires_at, activates_on)').eq('organisation_id', o.id)

  // Stage breakdowns
  const bookingStages = (bAll || []).map(b => ({ b, stage: deriveBooking(b) }))
  const bookingsFollowUp = bookingStages.filter(x => needs(x.stage))
  const bookingsConverted = bookingStages.filter(x => x.stage === 'converted')
  const bookingsLost = bookingStages.filter(x => x.stage === 'lost')
  const bookingsFollowUpEmailMatch = bookingsFollowUp.filter(x => x.b.parent_email && emailSet.has(x.b.parent_email.trim().toLowerCase()))
  const bookingsFollowUpOrphan = bookingsFollowUp.length - bookingsFollowUpEmailMatch.length

  // Enrolment follow-up cohort (by playerId)
  const enrPlayerFollowUp = new Set()
  for (const e of (enrTrue || [])) {
    if (needs(deriveEnrolment(e)) && e.player_id) enrPlayerFollowUp.add(e.player_id)
  }

  // Players that show on existing 'Trial' filter: rowStatus='trial' requires
  // ANY enrolment with is_trial=true AND status IN (active|pending).
  const playersExistingTrial = (playersRaw || []).filter(p => {
    const es = p.enrolments || []
    if (es.some(e => (e.status || '') === 'active' && !e.is_trial)) return false  // active overrides
    return es.some(e => e.is_trial && ((e.status || '') === 'active' || (e.status || '') === 'pending'))
  }).length

  totals.bookings_all += (bAll || []).length
  totals.bookings_active_cohort += (bActive || []).length
  totals.bookings_followup_due += bookingsFollowUp.length
  totals.bookings_converted += bookingsConverted.length
  totals.bookings_lost += bookingsLost.length
  totals.bookings_orphan_no_player += bookingsFollowUpOrphan
  totals.bookings_followup_emailed_to_parent += bookingsFollowUpEmailMatch.length
  totals.enrolments_is_trial_true += (enrTrue || []).length
  totals.enrolments_in_followup += enrPlayerFollowUp.size
  totals.players_existing_trial_filter += playersExistingTrial
  totals.players_new_followup_filter += enrPlayerFollowUp.size

  orgRows.push({ name: o.name, bookings_all: (bAll||[]).length, bookings_followup: bookingsFollowUp.length, bookings_orphan: bookingsFollowUpOrphan, bookings_emailed: bookingsFollowUpEmailMatch.length, enrolments_trial: (enrTrue||[]).length, enrolment_followup_players: enrPlayerFollowUp.size, players_existing_trial: playersExistingTrial })
}

console.log(`\nPhase 2.4 closeout — Players page trial-filter visibility audit\n`)
console.log('Org                          | trial_bookings | enr.is_trial=true | followup_due | followup→email-match | followup→orphan | Players (existing Trial filter) | Players (NEW follow-up filter)')
console.log('─────────────────────────────┼────────────────┼───────────────────┼──────────────┼──────────────────────┼─────────────────┼─────────────────────────────────┼──────────────────────────────')
for (const r of orgRows) {
  console.log(`${(r.name || '').padEnd(28).slice(0,28)} | ${String(r.bookings_all).padStart(14)} | ${String(r.enrolments_trial).padStart(17)} | ${String(r.bookings_followup).padStart(12)} | ${String(r.bookings_emailed).padStart(20)} | ${String(r.bookings_orphan).padStart(15)} | ${String(r.players_existing_trial).padStart(31)} | ${String(r.enrolment_followup_players).padStart(28)}`)
}
console.log(`\n──── PLATFORM TOTALS ────`)
console.log(`  trial_bookings rows                              : ${totals.bookings_all}`)
console.log(`     ↳ in active cohort (not converted/cancelled) : ${totals.bookings_active_cohort}`)
console.log(`     ↳ in follow-up cohort (awaiting/stale)       : ${totals.bookings_followup_due}`)
console.log(`        — matched to a parent profile by email    : ${totals.bookings_followup_emailed_to_parent}`)
console.log(`        — orphan (no matching parent email)       : ${totals.bookings_orphan_no_player}`)
console.log(`     ↳ already converted                          : ${totals.bookings_converted}`)
console.log(`     ↳ marked lost (cancelled/no_show)            : ${totals.bookings_lost}`)
console.log()
console.log(`  enrolments where is_trial=true                   : ${totals.enrolments_is_trial_true}`)
console.log(`     ↳ in follow-up cohort (awaiting/stale)       : ${totals.enrolments_in_followup}`)
console.log()
console.log(`  Players that SHOULD appear on existing 'Trial'   : ${totals.players_existing_trial_filter}`)
console.log(`  Players that SHOULD appear on NEW 'Trial follow-up due' filter : ${totals.players_new_followup_filter}`)
