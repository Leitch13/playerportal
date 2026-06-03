/**
 * Phase 2.7 audit — Trial Conversion % data discovery.
 *
 * READ-ONLY. No code change.
 *
 * Inspects both backing systems and reports:
 *   • Trials booked
 *   • Trials attended (booking-side only; enrolment system has no
 *     "attended" event — the trial happens by elapsed time)
 *   • Trials converted (booking.converted=true, AND enrolment.is_trial=
 *     false candidates with caveats)
 *   • Trials lost  (booking status cancelled/no_show, enrolment
 *     status cancelled/paused/inactive while is_trial=true)
 *   • Trials extended (NO PERSISTENCE — best-effort heuristic only)
 *   • Conversion % at funnel and at gross level
 *   • Average days to convert (booking only; no signal for enrolment-source)
 *   • Data quality flags surfaced per academy
 *
 *   set -a && source /tmp/.env.prod && set +a && \
 *   node scripts/_audit_trial_conversion.mjs
 */
import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const { data: orgs } = await sb.from('organisations').select('id, name').order('name')

const platform = {
  booked: 0, attended: 0, converted: 0, lost: 0,
  pending_unresolved: 0,         // booking still pending/confirmed/attended-without-followup
  enrolment_trials_total: 0,
  enrolment_trials_active: 0,
  enrolment_trials_lost: 0,
  enrolment_trials_paused: 0,
  enrolment_trials_pending: 0,
  enrolment_trials_long_window: 0,  // > 14 days between enrolled_at and trial_expires_at (extension heuristic)
  conversion_days_samples: [],
  data_quality_flags: { no_preferred_date: 0, attended_no_updated_at: 0, converted_without_updated_at: 0, status_other: 0 },
}

const VALID_BOOKING_STATUSES = new Set(['pending', 'confirmed', 'attended', 'no_show', 'cancelled', 'converted'])

const rowsOut = []

for (const o of orgs) {
  const orgStats = {
    org: o.name,
    bookings_total: 0, bookings_attended: 0, bookings_converted: 0, bookings_lost: 0, bookings_pending: 0,
    enrolment_trials_total: 0, enrolment_trials_active: 0, enrolment_trials_lost: 0, enrolment_trials_pending: 0,
    enrolment_trials_long_window: 0,
    convo_rate_attended: null, convo_rate_booked: null,
    avg_days_to_convert: null,
    data_quality: [],
  }

  // ─── Bookings ──────────────────────────────────────────────────────
  const { data: bookings } = await sb.from('trial_bookings').select('id, status, preferred_date, followup_sent, converted, created_at, updated_at, confirmed_at').eq('organisation_id', o.id)
  for (const b of (bookings || [])) {
    orgStats.bookings_total++
    platform.booked++

    const status = (b.status || '').toLowerCase()
    if (!VALID_BOOKING_STATUSES.has(status)) {
      platform.data_quality_flags.status_other++
      orgStats.data_quality.push(`booking ${b.id} has unrecognised status '${b.status}'`)
    }
    if (!b.preferred_date) platform.data_quality_flags.no_preferred_date++

    if (b.converted === true) {
      orgStats.bookings_converted++
      platform.converted++
      if (b.created_at && b.updated_at) {
        const created = Date.parse(b.created_at)
        const updated = Date.parse(b.updated_at)
        if (!isNaN(created) && !isNaN(updated) && updated > created) {
          platform.conversion_days_samples.push((updated - created) / 86_400_000)
        }
      } else {
        platform.data_quality_flags.converted_without_updated_at++
      }
    }
    if (status === 'attended') {
      orgStats.bookings_attended++
      platform.attended++
      if (!b.updated_at) platform.data_quality_flags.attended_no_updated_at++
    }
    if (status === 'cancelled' || status === 'no_show') {
      orgStats.bookings_lost++
      platform.lost++
    }
    if (status === 'pending' || status === 'confirmed') {
      orgStats.bookings_pending++
      platform.pending_unresolved++
    }
  }

  // ─── Enrolment trials ──────────────────────────────────────────────
  const { data: trials } = await sb.from('enrolments').select('id, status, is_trial, trial_expires_at, activates_on, enrolled_at, created_at').eq('organisation_id', o.id).eq('is_trial', true)
  for (const e of (trials || [])) {
    orgStats.enrolment_trials_total++
    platform.enrolment_trials_total++
    const s = (e.status || '').toLowerCase()
    if (s === 'active') { orgStats.enrolment_trials_active++; platform.enrolment_trials_active++ }
    else if (s === 'cancelled' || s === 'inactive') { orgStats.enrolment_trials_lost++; platform.enrolment_trials_lost++ }
    else if (s === 'paused') platform.enrolment_trials_paused++
    else if (s === 'pending') { orgStats.enrolment_trials_pending++; platform.enrolment_trials_pending++ }

    // Extension heuristic: enrolled_at + 14d < trial_expires_at
    if (e.enrolled_at && e.trial_expires_at) {
      const enr = Date.parse(e.enrolled_at)
      const exp = Date.parse(/[T ]/.test(e.trial_expires_at) ? e.trial_expires_at : e.trial_expires_at + 'T00:00:00Z')
      if (!isNaN(enr) && !isNaN(exp)) {
        const days = (exp - enr) / 86_400_000
        if (days > 14) { orgStats.enrolment_trials_long_window++; platform.enrolment_trials_long_window++ }
      }
    }
  }

  // ─── Per-org rates ────────────────────────────────────────────────
  if (orgStats.bookings_attended > 0) {
    orgStats.convo_rate_attended = (orgStats.bookings_converted / orgStats.bookings_attended * 100).toFixed(1) + '%'
  }
  if (orgStats.bookings_total > 0) {
    orgStats.convo_rate_booked = (orgStats.bookings_converted / orgStats.bookings_total * 100).toFixed(1) + '%'
  }

  if (orgStats.bookings_total > 0 || orgStats.enrolment_trials_total > 0) rowsOut.push(orgStats)
}

// ─── Print per-org ─────────────────────────────────────────────────────
console.log('\nPhase 2.7 — Trial Conversion % audit\n')
console.log('Per-org breakdown (orgs with ≥1 trial row):\n')
console.log('org                          | bk_total | bk_atnd | bk_conv | bk_lost | bk_pend | enr_total | enr_active | enr_lost | enr_long | %conv/atnd | %conv/booked')
console.log('─────────────────────────────┼──────────┼─────────┼─────────┼─────────┼─────────┼───────────┼────────────┼──────────┼──────────┼────────────┼─────────────')
for (const r of rowsOut) {
  console.log(
    `${(r.org || '').padEnd(28).slice(0,28)} | ${String(r.bookings_total).padStart(8)} | ${String(r.bookings_attended).padStart(7)} | ${String(r.bookings_converted).padStart(7)} | ${String(r.bookings_lost).padStart(7)} | ${String(r.bookings_pending).padStart(7)} | ${String(r.enrolment_trials_total).padStart(9)} | ${String(r.enrolment_trials_active).padStart(10)} | ${String(r.enrolment_trials_lost).padStart(8)} | ${String(r.enrolment_trials_long_window).padStart(8)} | ${(r.convo_rate_attended || '—').padStart(10)} | ${(r.convo_rate_booked || '—').padStart(12)}`
  )
}

// ─── Platform totals ───────────────────────────────────────────────────
console.log('\n─── PLATFORM TOTALS ───')
console.log(`  Bookings:`)
console.log(`    Booked (total rows)              : ${platform.booked}`)
console.log(`    Attended                          : ${platform.attended}`)
console.log(`    Converted (converted=true)        : ${platform.converted}`)
console.log(`    Lost (cancelled/no_show)          : ${platform.lost}`)
console.log(`    Pending/Confirmed (unresolved)    : ${platform.pending_unresolved}`)
console.log(`  Enrolment trials (is_trial=true):`)
console.log(`    Total                             : ${platform.enrolment_trials_total}`)
console.log(`    Active                            : ${platform.enrolment_trials_active}`)
console.log(`    Lost (cancelled/inactive)         : ${platform.enrolment_trials_lost}`)
console.log(`    Paused                            : ${platform.enrolment_trials_paused}`)
console.log(`    Pending (future-start)            : ${platform.enrolment_trials_pending}`)
console.log(`    Long window (>14d enrolled→expiry): ${platform.enrolment_trials_long_window}`)
console.log(`  Conversion %:`)
console.log(`    Attended→Converted (funnel rate) : ${platform.attended > 0 ? (platform.converted / platform.attended * 100).toFixed(1) + '%' : 'n/a'}`)
console.log(`    Booked→Converted   (overall)     : ${platform.booked > 0 ? (platform.converted / platform.booked * 100).toFixed(1) + '%' : 'n/a'}`)
console.log(`  Average days to convert (booking side):`)
const samples = platform.conversion_days_samples
if (samples.length === 0) {
  console.log(`    No samples (no converted bookings have both created_at + updated_at)`)
} else {
  const avg = samples.reduce((a, b) => a + b, 0) / samples.length
  const sorted = [...samples].sort((a, b) => a - b)
  console.log(`    Samples : ${samples.length}`)
  console.log(`    Mean    : ${avg.toFixed(1)} days`)
  console.log(`    Median  : ${sorted[Math.floor(sorted.length / 2)].toFixed(1)} days`)
  console.log(`    Range   : ${Math.min(...samples).toFixed(1)} – ${Math.max(...samples).toFixed(1)} days`)
}

console.log(`\n  Data quality flags:`)
console.log(`    Bookings missing preferred_date        : ${platform.data_quality_flags.no_preferred_date}`)
console.log(`    Attended bookings missing updated_at   : ${platform.data_quality_flags.attended_no_updated_at}`)
console.log(`    Converted bookings missing updated_at  : ${platform.data_quality_flags.converted_without_updated_at}`)
console.log(`    Unrecognised booking statuses          : ${platform.data_quality_flags.status_other}`)
