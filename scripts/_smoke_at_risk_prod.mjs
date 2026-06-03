/**
 * Phase 2.6 live smoke — at-risk derive against prod, model = Option B.
 *
 *   set -a && source /tmp/.env.prod && set +a && \
 *   node scripts/_smoke_at_risk_prod.mjs
 *
 * Replays the SAME derive logic the runtime page uses, against live data.
 * Reports per-org and platform counts: high / medium / healthy, plus the
 * reason mix in each tier.
 */
import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const NOW = Date.now()

const startOfUtcDay = (ms) => { const d = new Date(ms); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) }
const parseDb = (s) => { const ms = Date.parse(/[T ]/.test(s) ? s : s + 'T00:00:00Z'); return isNaN(ms) ? null : ms }
const STALE_FOLLOWUP = 7

function deriveBookingStage(b) {
  if (b.converted === true) return 'converted'
  const s = (b.status || '').toLowerCase()
  if (s === 'cancelled' || s === 'no_show') return 'lost'
  if (s === 'attended') {
    if (!b.followup_sent) return 'awaiting_followup'
    const ref = b.updated_at || b.preferred_date
    if (!ref) return 'followed_up'
    const refMs = parseDb(ref); if (refMs === null) return 'followed_up'
    return Math.floor((NOW - refMs) / 86_400_000) > STALE_FOLLOWUP ? 'stale_followup' : 'followed_up'
  }
  if (!b.preferred_date) return 'upcoming'
  const pms = parseDb(b.preferred_date); if (pms === null) return 'upcoming'
  const t = startOfUtcDay(NOW)
  if (pms > t) return 'upcoming'; if (pms === t) return 'today'
  return 'awaiting_followup'
}
function deriveEnrolmentStage(e) {
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
const needsFollowUp = (s) => s === 'awaiting_followup' || s === 'stale_followup'
function contactBucket(iso) {
  if (!iso) return 'never'
  const ms = parseDb(iso); if (ms === null) return 'never'
  const days = Math.floor((startOfUtcDay(NOW) - startOfUtcDay(ms)) / 86_400_000)
  if (days <= 30) return 'recent'
  return 'stale_30plus'
}

// Final risk model (Option B as confirmed)
function deriveRisk(inputs) {
  const reasons = []
  if (inputs.trialStage === 'stale_followup') reasons.push('trial_stale_followup')
  else if (inputs.trialStage && needsFollowUp(inputs.trialStage)) reasons.push('trial_followup_due')
  if (inputs.paymentIssue) reasons.push('payment_issue')
  if (inputs.noAttendance30d) reasons.push('no_attendance_30d')
  const cb = contactBucket(inputs.lastContactIso)
  if (cb === 'never') reasons.push('never_contacted')
  else if (cb === 'stale_30plus') reasons.push('not_contacted_30d')
  if (inputs.reviewDue) reasons.push('review_due')

  const HIGH = new Set(['trial_followup_due', 'trial_stale_followup', 'payment_issue'])
  const hasHigh = reasons.some(r => HIGH.has(r))
  const hasMedium = reasons.length > 0 && !hasHigh
  const level = hasHigh ? 'high' : hasMedium ? 'medium' : 'healthy'
  return { level, reasons }
}

async function run() {
  const { data: orgs } = await sb.from('organisations').select('id, name').order('name')
  const totals = { parents: 0, high: 0, medium: 0, healthy: 0 }
  const reasonCount = {}
  const rowsOut = []

  for (const o of orgs) {
    const { data: parents } = await sb.from('profiles').select('id, full_name, email').eq('organisation_id', o.id).eq('role', 'parent')
    if (!parents || parents.length === 0) continue
    const parentIds = parents.map(p => p.id)

    const { data: childrenRaw } = await sb.from('players').select('id, parent_id, enrolments(status, is_trial, trial_expires_at, enrolled_at)').eq('organisation_id', o.id).in('parent_id', parentIds)
    const children = childrenRaw || []
    const childrenByParent = new Map()
    for (const c of children) {
      const arr = childrenByParent.get(c.parent_id) || []
      arr.push(c)
      childrenByParent.set(c.parent_id, arr)
    }

    const { data: subs } = await sb.from('subscriptions').select('parent_id, status').eq('organisation_id', o.id).in('parent_id', parentIds)
    const subsByParent = new Map()
    for (const s of (subs || [])) {
      const arr = subsByParent.get(s.parent_id) || []
      arr.push(s.status)
      subsByParent.set(s.parent_id, arr)
    }

    const childIds = children.map(c => c.id)
    const attendedRecentByChild = new Set()
    if (childIds.length > 0) {
      const thirtyAgo = new Date(NOW - 30 * 86_400_000).toISOString().slice(0, 10)
      const { data: att } = await sb.from('attendance').select('player_id, present').in('player_id', childIds).gte('session_date', thirtyAgo).eq('present', true)
      for (const a of (att || [])) attendedRecentByChild.add(a.player_id)
    }

    const reviewedRecentByChild = new Set()
    if (childIds.length > 0) {
      const { data: revs } = await sb.from('progress_reviews').select('player_id, review_date').in('player_id', childIds).order('review_date', { ascending: false })
      const map = new Map()
      for (const r of (revs || [])) if (!map.has(r.player_id)) map.set(r.player_id, r.review_date)
      for (const [pid, iso] of map) {
        const ms = parseDb(iso); if (ms && (NOW - ms) <= 30 * 86_400_000) reviewedRecentByChild.add(pid)
      }
    }

    // Trial follow-up per parent
    const followUpByParent = new Map()
    const { data: bookings } = await sb.from('trial_bookings').select('parent_email, status, preferred_date, followup_sent, converted, updated_at').eq('organisation_id', o.id).or('converted.is.null,converted.eq.false').neq('status', 'cancelled').neq('status', 'no_show')
    const parentByEmail = new Map((parents || []).filter(p => p.email).map(p => [p.email.trim().toLowerCase(), p.id]))
    for (const b of (bookings || [])) {
      const stage = deriveBookingStage(b)
      if (!needsFollowUp(stage)) continue
      const pid = b.parent_email ? parentByEmail.get(b.parent_email.trim().toLowerCase()) : null
      if (!pid) continue
      const prev = followUpByParent.get(pid)
      followUpByParent.set(pid, prev === 'stale_followup' || stage === 'stale_followup' ? 'stale_followup' : 'awaiting_followup')
    }
    for (const c of children) {
      for (const e of (c.enrolments || [])) {
        if (!e.is_trial) continue
        const stage = deriveEnrolmentStage(e)
        if (!needsFollowUp(stage)) continue
        const prev = followUpByParent.get(c.parent_id)
        followUpByParent.set(c.parent_id, prev === 'stale_followup' || stage === 'stale_followup' ? 'stale_followup' : 'awaiting_followup')
      }
    }

    // Contact
    const lastContactByParent = new Map()
    {
      const ids = parentIds.join(',')
      const { data: msgs } = await sb.from('messages').select('sender_id, recipient_id, created_at').or(`sender_id.in.(${ids}),recipient_id.in.(${ids})`).order('created_at', { ascending: false })
      const parentSet = new Set(parentIds)
      for (const m of (msgs || [])) {
        if (parentSet.has(m.sender_id) && !lastContactByParent.has(m.sender_id)) lastContactByParent.set(m.sender_id, m.created_at)
        if (parentSet.has(m.recipient_id) && !lastContactByParent.has(m.recipient_id)) lastContactByParent.set(m.recipient_id, m.created_at)
      }
    }

    // Per-parent derive
    let orgHigh = 0, orgMedium = 0, orgHealthy = 0
    for (const p of parents) {
      const kids = childrenByParent.get(p.id) || []
      const paymentIssue = (subsByParent.get(p.id) || []).some(s => (s || '').toLowerCase() === 'past_due')
      const hasActiveEnrol = kids.some(c => (c.enrolments || []).some(e => (e.status || '') === 'active'))
      const anyAttended = kids.some(c => attendedRecentByChild.has(c.id))
      const noAttendance30d = hasActiveEnrol && !anyAttended
      const reviewDue = hasActiveEnrol && kids.some(c => !reviewedRecentByChild.has(c.id))

      const r = deriveRisk({
        trialStage: followUpByParent.get(p.id) || null,
        paymentIssue, noAttendance30d, reviewDue,
        lastContactIso: lastContactByParent.get(p.id) || null,
      })
      if (r.level === 'high') orgHigh++
      else if (r.level === 'medium') orgMedium++
      else orgHealthy++
      for (const reason of r.reasons) reasonCount[reason] = (reasonCount[reason] || 0) + 1
    }
    totals.parents += parents.length; totals.high += orgHigh; totals.medium += orgMedium; totals.healthy += orgHealthy
    rowsOut.push({ org: o.name, parents: parents.length, high: orgHigh, medium: orgMedium, healthy: orgHealthy })
  }
  return { totals, reasonCount, rowsOut }
}

const { totals, reasonCount, rowsOut } = await run()
console.log('\nPhase 2.6 — At-Risk Families final risk model smoke (production)\n')
console.log('org                          | parents | high | medium | healthy')
console.log('─────────────────────────────┼─────────┼──────┼────────┼────────')
for (const r of rowsOut) console.log(`${(r.org || '').padEnd(28).slice(0,28)} | ${String(r.parents).padStart(7)} | ${String(r.high).padStart(4)} | ${String(r.medium).padStart(6)} | ${String(r.healthy).padStart(7)}`)
console.log(`\nPlatform totals: parents=${totals.parents}  high=${totals.high}  medium=${totals.medium}  healthy=${totals.healthy}`)
console.log('\nReason frequency:')
for (const [k, v] of [...Object.entries(reasonCount)].sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(28)} : ${v}`)
