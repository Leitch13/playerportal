/**
 * Phase 2.8 live smoke — runs the EXACT derive logic against prod data.
 *
 *   set -a && source /tmp/.env.prod && set +a && \
 *   node scripts/_smoke_attendance_risk_prod.mjs
 */
import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const NOW = Date.now()
const startOfUtcDay = (ms) => { const d = new Date(ms); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) }
const parseDateUtcStart = (s) => {
  const hasTime = /[T ]/.test(s)
  const ms = Date.parse(hasTime ? s : s + 'T00:00:00Z')
  if (isNaN(ms)) return null
  const d = new Date(ms); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

function deriveAttendanceRisk(inputs) {
  const today = startOfUtcDay(NOW)
  let lastAttendanceAt = null
  for (const r of (inputs.attendanceHistory || [])) {
    if (!r.present) continue
    if (!lastAttendanceAt || r.session_date > lastAttendanceAt) lastAttendanceAt = r.session_date
  }
  const attendedEver = lastAttendanceAt !== null
  let daysSinceAttendance = null
  if (lastAttendanceAt) { const ms = parseDateUtcStart(lastAttendanceAt); if (ms !== null) daysSinceAttendance = Math.max(0, Math.floor((today - ms) / 86_400_000)) }
  let tenureDays = null
  if (inputs.enrolledAt) { const ms = parseDateUtcStart(inputs.enrolledAt); if (ms !== null) tenureDays = Math.max(0, Math.floor((today - ms) / 86_400_000)) }
  const base = { lastAttendanceAt, attendedEver, daysSinceAttendance, tenureDays }
  if ((inputs.enrolmentStatus || '').toLowerCase() !== 'active') return { riskLevel: 'not_applicable', riskReason: { kind: 'not_applicable', label: '' }, ...base }
  if (attendedEver && daysSinceAttendance !== null) {
    if (daysSinceAttendance < 14) return { riskLevel: 'healthy', riskReason: { kind: 'recently_attended', daysSinceAttendance, label: '' }, ...base }
    const isHigh = daysSinceAttendance >= 30
    return { riskLevel: isHigh ? 'high' : 'medium', riskReason: { kind: 'drifted', daysSinceAttendance, label: `Drifted away (${daysSinceAttendance} days since attendance)` }, ...base }
  }
  if (tenureDays === null) return { riskLevel: 'not_applicable', riskReason: { kind: 'not_applicable', label: '' }, ...base }
  if (tenureDays < 14) return { riskLevel: 'new_player', riskReason: { kind: 'new_player', tenureDays, label: '' }, ...base }
  const isHigh = tenureDays >= 30
  return { riskLevel: isHigh ? 'high' : 'medium', riskReason: { kind: 'never_attended', tenureDays, label: `Never attended (${tenureDays} days enrolled)` }, ...base }
}

const { data: orgs } = await sb.from('organisations').select('id, name').order('name')

const platform = {
  orgs_with_players: 0, total_players: 0, active_enrolled: 0,
  high_never: 0, high_drifted: 0, medium_never: 0, medium_drifted: 0,
  healthy: 0, new_player: 0,
  not_applicable: 0,
  sample_high_never: null, sample_high_drifted: null,
}

const rowsOut = []

for (const o of orgs) {
  const { data: players } = await sb.from('players').select('id, first_name, last_name, enrolments(status, enrolled_at)').eq('organisation_id', o.id)
  if (!players || players.length === 0) continue
  platform.orgs_with_players++
  const activePlayers = players.filter(p => (p.enrolments || []).some(e => (e.status || '') === 'active'))
  if (activePlayers.length === 0) { platform.total_players += players.length; continue }

  const playerIds = activePlayers.map(p => p.id)
  const yearAgo = new Date(NOW - 365 * 86_400_000).toISOString().slice(0, 10)
  const { data: att } = await sb.from('attendance').select('player_id, session_date, present').in('player_id', playerIds).gte('session_date', yearAgo)
  const histByPlayer = new Map()
  for (const r of (att || [])) {
    const arr = histByPlayer.get(r.player_id) || []
    arr.push({ session_date: r.session_date, present: r.present })
    histByPlayer.set(r.player_id, arr)
  }

  let orgHighNever = 0, orgHighDrift = 0, orgMedNever = 0, orgMedDrift = 0, orgHealthy = 0, orgNew = 0, orgNA = 0
  for (const p of activePlayers) {
    const activeEnrolments = (p.enrolments || []).filter(e => (e.status || '') === 'active')
    const earliestEnrolledAt = activeEnrolments.map(e => e.enrolled_at).filter(Boolean).sort()[0] || null
    const a = deriveAttendanceRisk({ attendanceHistory: histByPlayer.get(p.id) || [], enrolmentStatus: 'active', enrolledAt: earliestEnrolledAt })

    const k = a.riskLevel + '/' + a.riskReason.kind
    if (k === 'high/never_attended')   { orgHighNever++;   platform.high_never++;   if (!platform.sample_high_never) platform.sample_high_never = `${p.first_name} ${p.last_name} (${o.name}): ${a.riskReason.label}` }
    else if (k === 'high/drifted')     { orgHighDrift++;   platform.high_drifted++; if (!platform.sample_high_drifted) platform.sample_high_drifted = `${p.first_name} ${p.last_name} (${o.name}): ${a.riskReason.label}` }
    else if (k === 'medium/never_attended') { orgMedNever++; platform.medium_never++ }
    else if (k === 'medium/drifted')   { orgMedDrift++;    platform.medium_drifted++ }
    else if (a.riskLevel === 'healthy') { orgHealthy++; platform.healthy++ }
    else if (a.riskLevel === 'new_player') { orgNew++; platform.new_player++ }
    else if (a.riskLevel === 'not_applicable') { orgNA++; platform.not_applicable++ }
  }
  platform.total_players += players.length
  platform.active_enrolled += activePlayers.length
  rowsOut.push({ org: o.name, active: activePlayers.length, h_never: orgHighNever, h_drift: orgHighDrift, m_never: orgMedNever, m_drift: orgMedDrift, healthy: orgHealthy, new_: orgNew })
}

console.log('\nPhase 2.8 — live cohort against production\n')
console.log('org                          | active | HIGH never | HIGH drift | MED never | MED drift | healthy | new_player')
console.log('─────────────────────────────┼────────┼────────────┼────────────┼───────────┼───────────┼─────────┼───────────')
for (const r of rowsOut) {
  console.log(`${(r.org || '').padEnd(28).slice(0,28)} | ${String(r.active).padStart(6)} | ${String(r.h_never).padStart(10)} | ${String(r.h_drift).padStart(10)} | ${String(r.m_never).padStart(9)} | ${String(r.m_drift).padStart(9)} | ${String(r.healthy).padStart(7)} | ${String(r.new_).padStart(10)}`)
}
console.log('\nPlatform:')
console.log(`  orgs with players      : ${platform.orgs_with_players}`)
console.log(`  total players on books : ${platform.total_players}`)
console.log(`  active enrolled        : ${platform.active_enrolled}`)
console.log(`  HIGH/never_attended    : ${platform.high_never}`)
console.log(`  HIGH/drifted           : ${platform.high_drifted}`)
console.log(`  MEDIUM/never_attended  : ${platform.medium_never}`)
console.log(`  MEDIUM/drifted         : ${platform.medium_drifted}`)
console.log(`  healthy                : ${platform.healthy}`)
console.log(`  new_player (grace)     : ${platform.new_player}`)
console.log(`  not_applicable         : ${platform.not_applicable}`)
console.log(`\nSample high/never  : ${platform.sample_high_never || '—'}`)
console.log(`Sample high/drifted : ${platform.sample_high_drifted || '—'}`)
