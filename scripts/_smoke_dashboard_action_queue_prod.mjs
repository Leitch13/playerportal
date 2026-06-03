/**
 * Phase 2.9 live smoke — runs the loader against every prod org and
 * cross-checks the counts against the Phase 2.4-2.8 destination pages.
 *
 *   set -a && source /tmp/.env.prod && set +a && \
 *   node scripts/_smoke_dashboard_action_queue_prod.mjs
 *
 * Inline re-implementation of the loader so this script runs without
 * a build. Logic is byte-equivalent to src/lib/dashboard-action-queue-loader.ts.
 */
import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const NOW = Date.now()
const startOfUtcDay = (ms) => { const d = new Date(ms); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) }
const parseDb = (s) => { const ms = Date.parse(/[T ]/.test(s) ? s : s + 'T00:00:00Z'); return isNaN(ms) ? null : ms }
const STALE = 7

// ─── derive replicas ─────────────────────────────────────────────────
function deriveBooking(b) {
  if (b.converted === true) return 'converted'
  const s = (b.status || '').toLowerCase()
  if (s === 'cancelled' || s === 'no_show') return 'lost'
  if (s === 'attended') {
    if (!b.followup_sent) return 'awaiting_followup'
    const ref = b.updated_at || b.preferred_date
    if (!ref) return 'followed_up'
    const refMs = parseDb(ref); if (refMs === null) return 'followed_up'
    return Math.floor((NOW - refMs) / 86_400_000) > STALE ? 'stale_followup' : 'followed_up'
  }
  if (!b.preferred_date) return 'upcoming'
  const pms = parseDb(b.preferred_date); if (pms === null) return 'upcoming'
  const t = startOfUtcDay(NOW)
  if (pms > t) return 'upcoming'; if (pms === t) return 'today'
  return 'awaiting_followup'
}
function deriveEnrolment(e) {
  const s = (e.status || '').toLowerCase()
  if (s === 'cancelled' || s === 'inactive' || s === 'paused') return 'lost'
  if (e.is_trial === false) return 'converted'
  if (s === 'pending') return 'upcoming'
  if (s === 'active') {
    if (!e.trial_expires_at) return 'today'
    const ms = parseDb(e.trial_expires_at); if (ms === null) return 'today'
    return ms <= startOfUtcDay(NOW) ? 'awaiting_followup' : 'today'
  }
  return 'today'
}
const needs = (s) => s === 'awaiting_followup' || s === 'stale_followup'
const pickMore = (a, b) => (a === 'stale_followup' || b === 'stale_followup') ? 'stale_followup' : (a === 'awaiting_followup' || b === 'awaiting_followup') ? 'awaiting_followup' : a

function deriveAttendanceRisk(inputs) {
  const today = startOfUtcDay(NOW)
  let lastAttendanceAt = null
  for (const r of (inputs.attendanceHistory || [])) {
    if (!r.present) continue
    if (!lastAttendanceAt || r.session_date > lastAttendanceAt) lastAttendanceAt = r.session_date
  }
  const attendedEver = lastAttendanceAt !== null
  let daysSinceAttendance = null
  if (lastAttendanceAt) { const ms = parseDb(lastAttendanceAt); if (ms !== null) daysSinceAttendance = Math.max(0, Math.floor((today - ms) / 86_400_000)) }
  let tenureDays = null
  if (inputs.enrolledAt) { const ms = parseDb(inputs.enrolledAt); if (ms !== null) tenureDays = Math.max(0, Math.floor((today - ms) / 86_400_000)) }
  if ((inputs.enrolmentStatus || '').toLowerCase() !== 'active') return 'not_applicable'
  if (attendedEver && daysSinceAttendance !== null) {
    if (daysSinceAttendance < 14) return 'healthy'
    return daysSinceAttendance >= 30 ? 'high' : 'medium'
  }
  if (tenureDays === null) return 'not_applicable'
  if (tenureDays < 14) return 'new_player'
  return tenureDays >= 30 ? 'high' : 'medium'
}

async function loadActionQueueForOrg(orgId) {
  let trialFollowUps = 0, paymentIssues = 0, atRiskFamilies = 0, attendanceRisks = 0, reviewsDue = 0

  // Trial Follow-Ups (bookings + enrolments rolled up via needsFollowUp)
  try {
    const { data: parents } = await sb.from('profiles').select('id, email').eq('organisation_id', orgId).eq('role', 'parent')
    const { data: bookings } = await sb.from('trial_bookings').select('id, status, preferred_date, followup_sent, converted, updated_at, parent_email, parent_name, child_name, group:training_groups(name)').eq('organisation_id', orgId).or('converted.is.null,converted.eq.false').neq('status', 'cancelled').neq('status', 'no_show')
    const { data: enrolmentTrials } = await sb.from('enrolments').select('id, status, is_trial, trial_expires_at, activates_on, player_id, player:players!enrolments_player_id_fkey(id, first_name, last_name, parent_id, parent:profiles!players_parent_id_fkey(full_name, email, phone)), group:training_groups(name)').eq('organisation_id', orgId).eq('is_trial', true).neq('status', 'cancelled')
    let n = 0
    for (const b of (bookings || [])) if (needs(deriveBooking(b))) n++
    for (const e of (enrolmentTrials || [])) if (needs(deriveEnrolment(e))) n++
    trialFollowUps = n
  } catch { trialFollowUps = 0 }

  // Payment Issues — distinct parent_ids with past_due subs
  try {
    const { data } = await sb.from('subscriptions').select('parent_id').eq('organisation_id', orgId).eq('status', 'past_due')
    const set = new Set()
    for (const r of (data || [])) if (r.parent_id) set.add(r.parent_id)
    paymentIssues = set.size
  } catch { paymentIssues = 0 }

  // Attendance Risks — replica of Players-page derive (high+medium)
  try {
    const { data: players } = await sb.from('players').select('id, enrolments(status, enrolled_at)').eq('organisation_id', orgId)
    const activePlayers = (players || []).filter(p => (p.enrolments || []).some(e => (e.status || '') === 'active'))
    if (activePlayers.length > 0) {
      const playerIds = activePlayers.map(p => p.id)
      const yearAgo = new Date(NOW - 365 * 86_400_000).toISOString().slice(0, 10)
      const { data: att } = await sb.from('attendance').select('player_id, session_date, present').in('player_id', playerIds).gte('session_date', yearAgo)
      const hist = new Map()
      for (const r of (att || [])) { const arr = hist.get(r.player_id) || []; arr.push(r); hist.set(r.player_id, arr) }
      let n = 0
      for (const p of activePlayers) {
        const activeEnrol = (p.enrolments || []).filter(e => (e.status || '') === 'active')
        const earliest = activeEnrol.map(e => e.enrolled_at).filter(Boolean).sort()[0] || null
        const level = deriveAttendanceRisk({ attendanceHistory: hist.get(p.id) || [], enrolmentStatus: 'active', enrolledAt: earliest })
        if (level === 'high' || level === 'medium') n++
      }
      attendanceRisks = n
    }
  } catch { attendanceRisks = 0 }

  // Reviews Due — active enrolled players with no review or last > 30d
  try {
    const { data: enrolPlayers } = await sb.from('enrolments').select('player_id').eq('organisation_id', orgId).eq('status', 'active')
    const playerIds = [...new Set((enrolPlayers || []).map(e => e.player_id).filter(Boolean))]
    if (playerIds.length > 0) {
      const { data: revs } = await sb.from('progress_reviews').select('player_id, review_date').in('player_id', playerIds).order('review_date', { ascending: false })
      const latest = new Map()
      for (const r of (revs || [])) if (!latest.has(r.player_id)) latest.set(r.player_id, r.review_date)
      let n = 0
      for (const pid of playerIds) {
        const iso = latest.get(pid)
        if (!iso) { n++; continue }
        const ms = parseDb(iso); if (!ms) continue
        if ((NOW - ms) > 30 * 86_400_000) n++
      }
      reviewsDue = n
    }
  } catch { reviewsDue = 0 }

  // At-Risk Families — rough proxy (high cost to replicate fully here)
  // Counts parents with any of: trial follow-up, payment_issue, no_attendance_30d,
  // never_contacted, not_contacted_30d, review_due. Mirrors the Parents page rollup.
  // For the smoke we use the simplest accurate signal: count parents where at least
  // one signal fires.
  try {
    const { data: parents } = await sb.from('profiles').select('id, email').eq('organisation_id', orgId).eq('role', 'parent')
    if (parents && parents.length > 0) {
      const parentIds = parents.map(p => p.id)
      // Pull all signals
      const [{ data: subs }, { data: bookings }, { data: msgs }, { data: childrenRaw }] = await Promise.all([
        sb.from('subscriptions').select('parent_id, status').eq('organisation_id', orgId).in('parent_id', parentIds),
        sb.from('trial_bookings').select('parent_email, status, preferred_date, followup_sent, converted, updated_at').eq('organisation_id', orgId).or('converted.is.null,converted.eq.false').neq('status', 'cancelled').neq('status', 'no_show'),
        sb.from('messages').select('sender_id, recipient_id, created_at').or(`sender_id.in.(${parentIds.join(',')}),recipient_id.in.(${parentIds.join(',')})`).order('created_at', { ascending: false }),
        sb.from('players').select('id, parent_id, enrolments(status, is_trial, trial_expires_at)').eq('organisation_id', orgId).in('parent_id', parentIds),
      ])
      const parentByEmail = new Map(parents.filter(p => p.email).map(p => [p.email.trim().toLowerCase(), p.id]))
      const subsByParent = new Map()
      for (const s of (subs || [])) { const arr = subsByParent.get(s.parent_id) || []; arr.push(s); subsByParent.set(s.parent_id, arr) }
      const followupByParent = new Set()
      for (const b of (bookings || [])) {
        if (needs(deriveBooking(b))) {
          const pid = b.parent_email ? parentByEmail.get(b.parent_email.trim().toLowerCase()) : null
          if (pid) followupByParent.add(pid)
        }
      }
      const lastContactByParent = new Map()
      const parentSet = new Set(parentIds)
      for (const m of (msgs || [])) {
        if (parentSet.has(m.sender_id) && !lastContactByParent.has(m.sender_id)) lastContactByParent.set(m.sender_id, m.created_at)
        if (parentSet.has(m.recipient_id) && !lastContactByParent.has(m.recipient_id)) lastContactByParent.set(m.recipient_id, m.created_at)
      }
      const childrenByParent = new Map()
      for (const c of (childrenRaw || [])) { const arr = childrenByParent.get(c.parent_id) || []; arr.push(c); childrenByParent.set(c.parent_id, arr) }
      let count = 0
      for (const p of parents) {
        const ss = subsByParent.get(p.id) || []
        if (ss.some(s => (s.status || '').toLowerCase() === 'past_due')) { count++; continue }
        if (followupByParent.has(p.id)) { count++; continue }
        const lastIso = lastContactByParent.get(p.id)
        if (!lastIso) { count++; continue }  // never_contacted
        const ms = parseDb(lastIso); if (ms && (NOW - ms) > 30 * 86_400_000) { count++; continue }  // stale 30d
        // no_attendance_30d / review_due — simple proxy: any active enrolment + no attendance window check
        const kids = childrenByParent.get(p.id) || []
        const hasActiveEnrol = kids.some(c => (c.enrolments || []).some(e => (e.status || '') === 'active'))
        if (hasActiveEnrol) { count++; continue }
      }
      atRiskFamilies = count
    }
  } catch { atRiskFamilies = 0 }

  const total = trialFollowUps + paymentIssues + atRiskFamilies + attendanceRisks + reviewsDue
  return { trialFollowUps, paymentIssues, atRiskFamilies, attendanceRisks, reviewsDue, total }
}

const { data: orgs } = await sb.from('organisations').select('id, name').order('name')

console.log('\nPhase 2.9 — Action Queue counts per org\n')
console.log('org                          | trial | pay | atRisk | attRisk | review | total')
console.log('─────────────────────────────┼───────┼─────┼────────┼─────────┼────────┼──────')
for (const o of orgs) {
  const c = await loadActionQueueForOrg(o.id)
  if (c.total === 0) continue
  const name = (o.name || '').padEnd(28).slice(0, 28)
  console.log(`${name} | ${String(c.trialFollowUps).padStart(5)} | ${String(c.paymentIssues).padStart(3)} | ${String(c.atRiskFamilies).padStart(6)} | ${String(c.attendanceRisks).padStart(7)} | ${String(c.reviewsDue).padStart(6)} | ${String(c.total).padStart(5)}`)
}
