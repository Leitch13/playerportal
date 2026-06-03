/**
 * Phase 2.8 audit — Attendance Risk data discovery.
 *
 * READ-ONLY. No code change.
 *
 * For every academy, reports:
 *   • Active players (anywhere on the books — has any enrolment)
 *   • Active enrolled players (≥1 active enrolment)
 *   • Players with ANY attendance row, ever
 *   • Players with NO attendance row, ever
 *   • Cohorts: no attendance 14+ days / 30+ days / 60+ days (among
 *     players with at least one enrolment)
 *   • Attendance coverage % (active enrolled players with ≥1 present
 *     row in 30 days / active enrolled players)
 *   • Data quality flags:
 *     - players with active enrolment but no ever-attendance
 *     - attendance rows with present=false (excused?)
 *     - players with stale enrolment + no recent attendance (possibly
 *       drifted away long ago)
 *
 *   set -a && source /tmp/.env.prod && set +a && \
 *   node scripts/_audit_attendance_risk.mjs
 */
import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const NOW = Date.now()
const TODAY = new Date(NOW).toISOString().slice(0, 10)

const { data: orgs } = await sb.from('organisations').select('id, name').order('name')

const platform = {
  orgs_with_players: 0,
  total_players: 0,
  active_enrolled: 0,
  any_attendance_ever: 0,
  never_attended: 0,
  no_attendance_7d: 0,
  no_attendance_14d: 0,
  no_attendance_30d: 0,
  no_attendance_60d: 0,
  no_attendance_90d: 0,
  attended_in_last_14d: 0,
  attended_in_last_30d: 0,
  absent_marked_rows: 0,    // present=false rows in last 30d
  attendance_rows_total: 0,
}

const rowsOut = []

for (const o of orgs) {
  const { data: players } = await sb.from('players').select('id, first_name, last_name, enrolments(status)').eq('organisation_id', o.id)
  if (!players || players.length === 0) continue
  platform.orgs_with_players++

  // Active enrolled = has ≥1 enrolment with status='active'
  const activePlayers = players.filter(p => (p.enrolments || []).some(e => (e.status || '') === 'active'))
  if (activePlayers.length === 0) {
    // Org has players but none enrolled actively — still count, but no risk cohort
    platform.total_players += players.length
    rowsOut.push({ org: o.name, total: players.length, active_enrolled: 0, ever_attended: 0, never_attended: 0, no_attend_14d: 0, no_attend_30d: 0, no_attend_60d: 0, attended_14d: 0, coverage_pct: '—' })
    continue
  }

  const playerIds = activePlayers.map(p => p.id)

  // All attendance rows for these players (limit to last 365 days so the
  // count doesn't balloon for orgs with long histories)
  const yearAgo = new Date(NOW - 365 * 86_400_000).toISOString().slice(0, 10)
  const { data: att } = await sb.from('attendance').select('player_id, session_date, present').in('player_id', playerIds).gte('session_date', yearAgo).order('session_date', { ascending: false })

  // Aggregate: last present-date per player
  const lastPresentByPlayer = new Map()
  const absentByPlayer = new Map()
  for (const r of (att || [])) {
    if (r.present && !lastPresentByPlayer.has(r.player_id)) {
      lastPresentByPlayer.set(r.player_id, r.session_date)
    }
    if (!r.present) absentByPlayer.set(r.player_id, (absentByPlayer.get(r.player_id) || 0) + 1)
  }

  let ever = 0, never_ = 0
  let n_7d = 0, n_14d = 0, n_30d = 0, n_60d = 0, n_90d = 0
  let recent_14d = 0, recent_30d = 0
  for (const p of activePlayers) {
    const lastIso = lastPresentByPlayer.get(p.id)
    if (lastIso) {
      ever++
      const ms = Date.parse(lastIso + 'T00:00:00Z')
      const days = Math.floor((Date.parse(TODAY + 'T00:00:00Z') - ms) / 86_400_000)
      if (days > 7) n_7d++
      if (days > 14) n_14d++
      if (days > 30) n_30d++
      if (days > 60) n_60d++
      if (days > 90) n_90d++
      if (days <= 14) recent_14d++
      if (days <= 30) recent_30d++
    } else {
      never_++
    }
  }

  platform.total_players += players.length
  platform.active_enrolled += activePlayers.length
  platform.any_attendance_ever += ever
  platform.never_attended += never_
  platform.no_attendance_7d += n_7d
  platform.no_attendance_14d += n_14d
  platform.no_attendance_30d += n_30d
  platform.no_attendance_60d += n_60d
  platform.no_attendance_90d += n_90d
  platform.attended_in_last_14d += recent_14d
  platform.attended_in_last_30d += recent_30d
  platform.absent_marked_rows += [...absentByPlayer.values()].reduce((a, b) => a + b, 0)
  platform.attendance_rows_total += (att || []).length

  const coverage = activePlayers.length > 0 ? Math.round(recent_30d / activePlayers.length * 100) : 0
  rowsOut.push({
    org: o.name,
    total: players.length,
    active_enrolled: activePlayers.length,
    ever_attended: ever,
    never_attended: never_,
    no_attend_14d: n_14d,
    no_attend_30d: n_30d,
    no_attend_60d: n_60d,
    attended_14d: recent_14d,
    coverage_pct: coverage + '%',
  })
}

console.log('\nPhase 2.8 — Attendance Risk audit (production)\n')
console.log('Per-org breakdown (orgs with ≥1 player):\n')
console.log('org                          | players | active | ever | never | no_14d | no_30d | no_60d | atnd_14d | coverage')
console.log('─────────────────────────────┼─────────┼────────┼──────┼───────┼────────┼────────┼────────┼──────────┼─────────')
for (const r of rowsOut) {
  console.log(`${(r.org || '').padEnd(28).slice(0,28)} | ${String(r.total).padStart(7)} | ${String(r.active_enrolled).padStart(6)} | ${String(r.ever_attended).padStart(4)} | ${String(r.never_attended).padStart(5)} | ${String(r.no_attend_14d).padStart(6)} | ${String(r.no_attend_30d).padStart(6)} | ${String(r.no_attend_60d).padStart(6)} | ${String(r.attended_14d).padStart(8)} | ${String(r.coverage_pct).padStart(8)}`)
}

console.log('\n─── PLATFORM TOTALS ───')
console.log(`  Orgs with ≥1 player                          : ${platform.orgs_with_players}`)
console.log(`  Total players on books                        : ${platform.total_players}`)
console.log(`  Active enrolled players                       : ${platform.active_enrolled}`)
console.log(`  Of active enrolled:`)
console.log(`    Ever attended                               : ${platform.any_attendance_ever}`)
console.log(`    Never attended                              : ${platform.never_attended}`)
console.log(`    No attendance in 7+ days                    : ${platform.no_attendance_7d}`)
console.log(`    No attendance in 14+ days                   : ${platform.no_attendance_14d}`)
console.log(`    No attendance in 30+ days                   : ${platform.no_attendance_30d}`)
console.log(`    No attendance in 60+ days                   : ${platform.no_attendance_60d}`)
console.log(`    No attendance in 90+ days                   : ${platform.no_attendance_90d}`)
console.log(`    Attended in last 14 days                    : ${platform.attended_in_last_14d}`)
console.log(`    Attended in last 30 days                    : ${platform.attended_in_last_30d}`)
const cov = platform.active_enrolled > 0 ? Math.round(platform.attended_in_last_30d / platform.active_enrolled * 100) : 0
console.log(`  Attendance coverage % (active w/ ≥1 in 30d)   : ${cov}%`)
console.log()
console.log(`  Total attendance rows in last 365d            : ${platform.attendance_rows_total}`)
console.log(`  Rows with present=false (absences logged)     : ${platform.absent_marked_rows}`)
