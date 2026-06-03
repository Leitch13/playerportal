/**
 * Phase 2.4 final visibility smoke — what each surface will show in prod.
 *
 * READ-ONLY. For every org, reports:
 *   • parents badged on Parents List + Parent Detail (FK or email match)
 *   • players badged on Players List (FK only — by playerId)
 *   • trials surfaced under the new TrialManager 'Follow-up due' tab
 *   • orphan booking rows (no FK + no email match)
 *
 *   set -a && source /tmp/.env.prod && set +a && \
 *   node scripts/_smoke_phase24_full_visibility_prod.mjs
 */
import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const NOW = Date.now()

const startOfUtcDay = (ms) => { const d = new Date(ms); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) }
const STALE = 7
function deriveBooking(b, nowMs = NOW) {
  if (b.converted === true) return 'converted'
  const s = (b.status || '').toLowerCase()
  if (s === 'cancelled' || s === 'no_show') return 'lost'
  if (s === 'attended') {
    if (!b.followup_sent) return 'awaiting_followup'
    const ref = b.updated_at || b.preferred_date
    if (!ref) return 'followed_up'
    const refMs = Date.parse(ref); if (isNaN(refMs)) return 'followed_up'
    return Math.floor((nowMs - refMs) / 86_400_000) > STALE ? 'stale_followup' : 'followed_up'
  }
  if (!b.preferred_date) return 'upcoming'
  const pms = Date.parse(b.preferred_date + 'T00:00:00Z'); if (isNaN(pms)) return 'upcoming'
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
    const ms = Date.parse(e.trial_expires_at + 'T00:00:00Z'); if (isNaN(ms)) return 'today'
    return ms <= startOfUtcDay(nowMs) ? 'awaiting_followup' : 'today'
  }
  return 'today'
}
const needs = (s) => s === 'awaiting_followup' || s === 'stale_followup'

async function runForOrg(name, orgId) {
  const out = {
    enrolments_in_section: 0,
    parents_badged: 0,
    players_badged: 0,
    trials_in_followup_tab: 0,
    orphan_bookings: 0,
    errors: 0,
  }

  const { data: parents } = await sb.from('profiles')
    .select('id, email').eq('organisation_id', orgId).eq('role', 'parent')

  const { data: bookings, error: bErr } = await sb.from('trial_bookings')
    .select('id, status, preferred_date, followup_sent, converted, updated_at, parent_email')
    .eq('organisation_id', orgId)
    .or('converted.is.null,converted.eq.false')
    .neq('status', 'cancelled').neq('status', 'no_show')
  if (bErr) out.errors++

  const { data: enrolments, error: eErr } = await sb.from('enrolments')
    .select('id, status, is_trial, trial_expires_at, activates_on, player_id, player:players!enrolments_player_id_fkey(parent_id)')
    .eq('organisation_id', orgId).eq('is_trial', true).neq('status', 'cancelled')
  if (eErr) out.errors++

  // Section cohort on Enrolments page = needsFollowUp from both systems
  // TrialManager follow-up tab cohort = needsFollowUp from booking only
  const emailSet = new Set((parents || []).filter(p => p.email).map(p => p.email.trim().toLowerCase()))
  const bookingMatches = new Set(), playerMatches = new Set(), parentEmailMatches = new Set()

  for (const b of bookings || []) {
    const stage = deriveBooking(b)
    if (!needs(stage)) continue
    out.enrolments_in_section++
    out.trials_in_followup_tab++
    if (b.parent_email && emailSet.has(b.parent_email.trim().toLowerCase())) {
      parentEmailMatches.add(b.parent_email.trim().toLowerCase())
    } else {
      out.orphan_bookings++
    }
  }

  for (const e of enrolments || []) {
    const stage = deriveEnrolment(e)
    if (!needs(stage)) continue
    out.enrolments_in_section++
    if (e.player?.parent_id) parentEmailMatches.add('FK:' + e.player.parent_id)
    if (e.player_id) playerMatches.add(e.player_id)
  }

  out.parents_badged = parentEmailMatches.size
  out.players_badged = playerMatches.size
  return out
}

const { data: orgs } = await sb.from('organisations').select('id, name').order('name')

console.log(`\nPhase 2.4 final visibility smoke — ${orgs.length} orgs\n`)
console.log('org                          | enrols_section | parents_badged | players_badged | trials_followup_tab | orphan_bookings')
console.log('─────────────────────────────┼────────────────┼────────────────┼────────────────┼─────────────────────┼────────────────')

let totals = { enr: 0, par: 0, pla: 0, tt: 0, orph: 0 }
for (const o of orgs) {
  const r = await runForOrg(o.name, o.id)
  totals.enr += r.enrolments_in_section
  totals.par += r.parents_badged
  totals.pla += r.players_badged
  totals.tt  += r.trials_in_followup_tab
  totals.orph += r.orphan_bookings
  const n = (o.name || '').padEnd(28).slice(0, 28)
  console.log(
    `${n} | ${String(r.enrolments_in_section).padStart(14)} | ${String(r.parents_badged).padStart(14)} | ${String(r.players_badged).padStart(14)} | ${String(r.trials_in_followup_tab).padStart(19)} | ${String(r.orphan_bookings).padStart(14)}`,
  )
}
console.log(`\nAcross all orgs:`)
console.log(`  Enrolments-page Trial Follow-up section: ${totals.enr} rows`)
console.log(`  Parents List/Detail badge: ${totals.par} parents`)
console.log(`  Players List badge: ${totals.pla} players`)
console.log(`  TrialManager 'Follow-up due' tab: ${totals.tt} trials`)
console.log(`  Orphan booking rows (not on Parents/Players, still visible on Enrolments + TrialManager): ${totals.orph}`)
