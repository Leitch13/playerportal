/**
 * Phase 2.6 audit — At-Risk Families signal inventory.
 *
 * Replays the SAME derivations the existing UI surfaces use, against live
 * production data. Counts per signal, overlap matrix, distinct families
 * touched. READ-ONLY.
 *
 *   set -a && source /tmp/.env.prod && set +a && \
 *   node scripts/_audit_at_risk_signals.mjs
 */
import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const NOW = Date.now()

const startOfUtcDay = (ms) => { const d = new Date(ms); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) }
const parseDb = (s) => { const ms = Date.parse(/[T ]/.test(s) ? s : s + 'T00:00:00Z'); return isNaN(ms) ? null : ms }
const STALE_FOLLOWUP = 7

// ─── derive helpers (mirrors of trial-derive + contact-derive) ─────────
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

// ─── Per-org sweep ────────────────────────────────────────────────────
async function sweep() {
  const { data: orgs } = await sb.from('organisations').select('id, name').order('name')
  const totals = {
    parents: 0,
    trial_followup_due: 0,   // awaiting OR stale, from EITHER system, mapped to a parent
    trial_stale_followup: 0,
    payment_issue: 0,
    no_attendance_30d: 0,
    never_contacted: 0,
    not_contacted_30d: 0,
    review_due: 0,
    cancelled_or_paused_any_child: 0,
    trial_extended_inferred: 0,
    distinct_high_risk: 0,
    distinct_medium_risk: 0,
    distinct_healthy: 0,
  }
  const overlap = new Map()  // "sig1+sig2" → count

  for (const o of orgs) {
    // Parents in org
    const { data: parents } = await sb.from('profiles').select('id, email, full_name').eq('organisation_id', o.id).eq('role', 'parent')
    const parentIds = (parents || []).map(p => p.id)
    if (parentIds.length === 0) continue

    // Children + enrolments
    const { data: childrenRaw } = await sb.from('players').select('id, parent_id, enrolments(status, is_trial, trial_expires_at, activates_on, enrolled_at)').eq('organisation_id', o.id).in('parent_id', parentIds)
    const children = childrenRaw || []
    const childrenByParent = new Map()
    for (const c of children) {
      const list = childrenByParent.get(c.parent_id) || []
      list.push(c)
      childrenByParent.set(c.parent_id, list)
    }

    // Subscriptions
    const { data: subs } = await sb.from('subscriptions').select('parent_id, status').eq('organisation_id', o.id).in('parent_id', parentIds)
    const subsByParent = new Map()
    for (const s of (subs || [])) {
      const list = subsByParent.get(s.parent_id) || []
      list.push(s.status)
      subsByParent.set(s.parent_id, list)
    }

    // Attendance — last 30d
    const childIds = children.map(c => c.id)
    const lastAttendanceByChild = new Map()
    if (childIds.length > 0) {
      const thirtyAgo = new Date(NOW - 30 * 86_400_000).toISOString().slice(0, 10)
      const { data: att } = await sb.from('attendance').select('player_id, session_date, present').in('player_id', childIds).gte('session_date', thirtyAgo).order('session_date', { ascending: false })
      for (const a of (att || [])) {
        if (a.present && !lastAttendanceByChild.has(a.player_id)) lastAttendanceByChild.set(a.player_id, a.session_date)
      }
    }

    // Reviews (latest per child)
    const latestReviewByChild = new Map()
    if (childIds.length > 0) {
      const { data: revs } = await sb.from('progress_reviews').select('player_id, review_date').in('player_id', childIds).order('review_date', { ascending: false })
      for (const r of (revs || [])) if (!latestReviewByChild.has(r.player_id)) latestReviewByChild.set(r.player_id, r.review_date)
    }

    // Trial follow-ups (booking + enrolment) — map to parentId where possible
    const followUpByParent = new Map()  // parent_id → 'stale' | 'awaiting'
    const followUpStale = new Set()
    {
      // Bookings (no FK to parents — match by email)
      const { data: bookings } = await sb.from('trial_bookings').select('parent_email, status, preferred_date, followup_sent, converted, updated_at').eq('organisation_id', o.id).or('converted.is.null,converted.eq.false').neq('status', 'cancelled').neq('status', 'no_show')
      const parentByEmail = new Map((parents || []).filter(p => p.email).map(p => [p.email.trim().toLowerCase(), p.id]))
      for (const b of (bookings || [])) {
        const stage = deriveBookingStage(b)
        if (!needsFollowUp(stage)) continue
        const pid = b.parent_email ? parentByEmail.get(b.parent_email.trim().toLowerCase()) : null
        if (!pid) continue
        if (stage === 'stale_followup') followUpStale.add(pid)
        followUpByParent.set(pid, followUpByParent.get(pid) === 'stale' ? 'stale' : stage === 'stale_followup' ? 'stale' : 'awaiting')
      }
      // Enrolments
      for (const c of children) {
        for (const e of (c.enrolments || [])) {
          if (!e.is_trial) continue
          const stage = deriveEnrolmentStage(e)
          if (!needsFollowUp(stage)) continue
          if (stage === 'stale_followup') followUpStale.add(c.parent_id)
          followUpByParent.set(c.parent_id, followUpByParent.get(c.parent_id) === 'stale' ? 'stale' : 'awaiting')
        }
      }
    }

    // Contact signals
    const contactByParent = new Map()
    {
      const ids = parentIds.join(',')
      const { data: msgs } = await sb.from('messages').select('sender_id, recipient_id, created_at').or(`sender_id.in.(${ids}),recipient_id.in.(${ids})`).order('created_at', { ascending: false })
      const parentSet = new Set(parentIds)
      for (const m of (msgs || [])) {
        if (parentSet.has(m.sender_id) && !contactByParent.has(m.sender_id)) contactByParent.set(m.sender_id, m.created_at)
        if (parentSet.has(m.recipient_id) && !contactByParent.has(m.recipient_id)) contactByParent.set(m.recipient_id, m.created_at)
      }
    }

    // Per-parent signal extraction
    for (const p of parents) {
      const kids = childrenByParent.get(p.id) || []
      const subStatuses = subsByParent.get(p.id) || []

      const sigs = new Set()

      // Trial follow-up
      const stage = followUpByParent.get(p.id)
      if (stage === 'awaiting' || stage === 'stale') sigs.add('trial_followup_due')
      if (followUpStale.has(p.id)) sigs.add('trial_stale_followup')

      // Payment issue (any child has past_due sub)
      if (subStatuses.some(s => (s || '').toLowerCase() === 'past_due')) sigs.add('payment_issue')

      // No attendance 30d — child has active enrolment AND no attendance in 30d
      const hasActiveEnrol = kids.some(c => (c.enrolments || []).some(e => (e.status || '') === 'active'))
      const anyChildAttendedRecently = kids.some(c => lastAttendanceByChild.has(c.id))
      if (hasActiveEnrol && !anyChildAttendedRecently) sigs.add('no_attendance_30d')

      // Contact
      const lastContactIso = contactByParent.get(p.id) || null
      const cb = contactBucket(lastContactIso)
      if (cb === 'never') sigs.add('never_contacted')
      if (cb === 'stale_30plus') sigs.add('not_contacted_30d')

      // Review due
      const reviewDue = kids.some(c => {
        const r = latestReviewByChild.get(c.id)
        if (!r) return true
        const t = parseDb(r); if (!t) return false
        return (NOW - t) > 30 * 86_400_000
      })
      if (reviewDue && hasActiveEnrol) sigs.add('review_due')

      // Cancelled / paused (any enrolment cancelled or paused)
      if (kids.some(c => (c.enrolments || []).some(e => e.status === 'cancelled' || e.status === 'paused'))) sigs.add('cancelled_or_paused_any_child')

      // Trial extended (HEURISTIC: enrolment.is_trial=true AND trial_expires_at − enrolled_at > 14 days)
      // No persistence layer for "was extended" — this is best-effort.
      for (const c of kids) {
        for (const e of (c.enrolments || [])) {
          if (!e.is_trial || !e.trial_expires_at || !e.enrolled_at) continue
          const exp = parseDb(e.trial_expires_at)
          const enr = parseDb(e.enrolled_at)
          if (exp === null || enr === null) continue
          const days = Math.floor((exp - enr) / 86_400_000)
          if (days > 14) { sigs.add('trial_extended_inferred'); break }
        }
      }

      // Tally
      for (const k of sigs) totals[k] = (totals[k] || 0) + 1
      // Risk roll-up
      const high =
        sigs.has('trial_followup_due') ||
        sigs.has('trial_stale_followup') ||
        sigs.has('payment_issue') ||
        sigs.has('no_attendance_30d')
      const medium = !high && (
        sigs.has('not_contacted_30d') ||
        sigs.has('never_contacted') ||
        sigs.has('review_due') ||
        sigs.has('trial_extended_inferred')
      )
      if (high) totals.distinct_high_risk++
      else if (medium) totals.distinct_medium_risk++
      else totals.distinct_healthy++

      // Overlap matrix — track pairs that co-occur
      const arr = [...sigs].sort()
      for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) {
        const k = `${arr[i]} + ${arr[j]}`
        overlap.set(k, (overlap.get(k) || 0) + 1)
      }

      totals.parents++
    }
  }

  return { totals, overlap }
}

const { totals, overlap } = await sweep()

console.log('\nPhase 2.6 — At-Risk Families audit (live production)\n')
console.log('─── Per-signal counts ───')
const order = [
  'parents',
  'trial_followup_due',
  'trial_stale_followup',
  'payment_issue',
  'no_attendance_30d',
  'never_contacted',
  'not_contacted_30d',
  'review_due',
  'cancelled_or_paused_any_child',
  'trial_extended_inferred',
]
for (const k of order) console.log(`  ${k.padEnd(32)} : ${totals[k] ?? 0}`)

console.log('\n─── Risk roll-up ───')
console.log(`  High risk  (any of trial_followup_due / payment_issue / no_attendance_30d): ${totals.distinct_high_risk}`)
console.log(`  Medium risk (non-high + contact stale/never / review_due / trial_extended): ${totals.distinct_medium_risk}`)
console.log(`  Healthy    (no signal at all)                                              : ${totals.distinct_healthy}`)

console.log('\n─── Signal co-occurrence (≥1) ───')
const overlapList = [...overlap.entries()].sort((a, b) => b[1] - a[1])
for (const [k, v] of overlapList) console.log(`  ${k.padEnd(60)} : ${v}`)
