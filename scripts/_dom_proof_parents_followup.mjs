/**
 * Phase 2.4 step 3 — DOM proof for Parents List filter.
 *
 * READ-ONLY. Loads Jamie's actual production data, materialises the
 * trial-follow-up badge for each affected parent, and emits the exact
 * HTML the ParentsTable will render. No browser is needed — the table
 * is data-driven; this script is the same render path the component
 * runs.
 *
 *   set -a && source /tmp/.env.prod && set +a && \
 *   node scripts/_dom_proof_parents_followup.mjs > /tmp/parents_followup_proof.html
 *   open /tmp/parents_followup_proof.html
 */
import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const NOW = Date.now()

// ─── derive ───────────────────────────────────────────────────────────
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
const pickMore = (a, b) => (a === 'stale_followup' || b === 'stale_followup') ? 'stale_followup'
  : (a === 'awaiting_followup' || b === 'awaiting_followup') ? 'awaiting_followup' : a
const badgeFor = (stage) => stage === 'stale_followup'
  ? { key: 'trial_stale_followup', label: 'Stale trial follow-up', tone: 'rose', emoji: '⏰' }
  : stage === 'awaiting_followup'
    ? { key: 'trial_followup_due', label: 'Trial follow-up due', tone: 'amber', emoji: '⏰' }
    : null

// ─── Render Jamie's affected parents ──────────────────────────────────
const JAMIE = '6b85c6f4-9e9b-4c8c-8d6e-6c8e9b85c6f4'  // placeholder — we'll find by name
const { data: orgs } = await sb.from('organisations').select('id, name').ilike('name', 'Jamie Allan Football%')
const orgId = orgs?.[0]?.id

if (!orgId) {
  console.error('Jamie Allan org not found')
  process.exit(1)
}

const { data: parents } = await sb
  .from('profiles')
  .select('id, full_name, email, phone, created_at')
  .eq('organisation_id', orgId)
  .eq('role', 'parent')

const { data: bookings } = await sb
  .from('trial_bookings')
  .select('id, status, preferred_date, followup_sent, converted, updated_at, parent_name, parent_email')
  .eq('organisation_id', orgId)
  .or('converted.is.null,converted.eq.false')
  .neq('status', 'cancelled')
  .neq('status', 'no_show')

const { data: enrolments } = await sb
  .from('enrolments')
  .select('id, status, is_trial, trial_expires_at, activates_on, player:players!enrolments_player_id_fkey(parent_id)')
  .eq('organisation_id', orgId)
  .eq('is_trial', true)
  .neq('status', 'cancelled')

const followUps = []
for (const b of bookings || []) {
  const stage = deriveBooking(b)
  if (needs(stage)) followUps.push({ stage, parentId: null, parentEmail: b.parent_email })
}
for (const e of enrolments || []) {
  const stage = deriveEnrolment(e)
  if (needs(stage)) followUps.push({ stage, parentId: e.player?.parent_id || null, parentEmail: null })
}

const fkMap = new Map(), emailMap = new Map()
for (const f of followUps) {
  if (f.parentId) { const p = fkMap.get(f.parentId); fkMap.set(f.parentId, p ? pickMore(p, f.stage) : f.stage) }
  else if (f.parentEmail) {
    const key = f.parentEmail.trim().toLowerCase()
    if (key) { const p = emailMap.get(key); emailMap.set(key, p ? pickMore(p, f.stage) : f.stage) }
  }
}

const badgedParents = []
for (const p of parents || []) {
  const fk = fkMap.get(p.id) ?? null
  const email = p.email ? emailMap.get(p.email.trim().toLowerCase()) ?? null : null
  const stage = (fk && email) ? pickMore(fk, email) : (fk ?? email)
  const badge = stage ? badgeFor(stage) : null
  if (badge) badgedParents.push({ ...p, stage, badge, matchedVia: fk ? 'fk' : 'email' })
}

// ─── Render full HTML preview ─────────────────────────────────────────
const BADGE_TONE = {
  rose:    'background:#9f1239;color:#fda4af;border-color:#fb7185;',
  amber:   'background:#78350f;color:#fcd34d;border-color:#f59e0b;',
  sky:     'background:#0c4a6e;color:#7dd3fc;border-color:#0ea5e9;',
  emerald: 'background:#064e3b;color:#6ee7b7;border-color:#10b981;',
}

const FILTER_CHIPS = [
  { key: 'all', label: 'All' }, { key: 'healthy', label: 'Healthy' },
  { key: 'payment_issues', label: 'Payment issues' }, { key: 'pending_starts', label: 'Pending starts' },
  { key: 'trials', label: 'Trials' },
  { key: 'trial_followup', label: 'Trial follow-up due' }, // <-- NEW
  { key: 'no_attendance_30d', label: 'No attendance (30d)' }, { key: 'review_due', label: 'Review due' },
]

const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Phase 2.4 — Parents List DOM proof</title></head>
<body style="background:#0a0a0a;color:#fff;font:14px -apple-system,BlinkMacSystemFont,'SF Pro',sans-serif;padding:24px;">

<h1 style="font-size:24px;font-weight:700;">Phase 2.4 step 3 — Parents List filter (live data)</h1>
<p style="color:rgba(255,255,255,.6);">Org: <strong>Jamie Allan Football Academy</strong>. Read-only fixture rendered from production via the same derive / matching logic the page runs.</p>

<h2 style="margin-top:32px;font-size:16px;font-weight:700;color:rgba(255,255,255,.8);">Filter chips (note the NEW chip)</h2>
<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;">
${FILTER_CHIPS.map(f => {
  const active = f.key === 'trial_followup'
  const style = active
    ? 'background:rgba(78,205,230,.15);color:#4ecde6;border:1px solid rgba(78,205,230,.4);'
    : 'background:rgba(255,255,255,.03);color:rgba(255,255,255,.6);border:1px solid rgba(255,255,255,.08);'
  return `<span style="font-size:12px;padding:6px 12px;border-radius:9999px;${style}">${f.label}${active ? ' ← NEW' : ''}</span>`
}).join('\n')}
</div>

<h2 style="margin-top:32px;font-size:16px;font-weight:700;color:rgba(255,255,255,.8);">Affected parent rows — ${badgedParents.length} families will display the badge</h2>
<p style="color:rgba(255,255,255,.4);font-size:12px;">Click 'Trial follow-up due' chip → only these rows remain visible.</p>

<table style="width:100%;margin-top:12px;border-collapse:collapse;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.06);border-radius:12px;overflow:hidden;">
  <thead><tr style="background:rgba(255,255,255,.02);">
    <th style="text-align:left;padding:8px 12px;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:rgba(255,255,255,.5);">Family</th>
    <th style="text-align:left;padding:8px 12px;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:rgba(255,255,255,.5);">Email</th>
    <th style="text-align:left;padding:8px 12px;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:rgba(255,255,255,.5);">Matched via</th>
    <th style="text-align:left;padding:8px 12px;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:rgba(255,255,255,.5);">Stage</th>
    <th style="text-align:left;padding:8px 12px;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:rgba(255,255,255,.5);">Badge (Attention column)</th>
  </tr></thead>
  <tbody>
${badgedParents.map(p => `
    <tr style="border-top:1px solid rgba(255,255,255,.04);">
      <td style="padding:10px 12px;color:#4ecde6;font-weight:500;">${escapeHtml(p.full_name || '(unnamed)')}</td>
      <td style="padding:10px 12px;color:rgba(255,255,255,.7);font-size:12px;">${escapeHtml(p.email || '')}</td>
      <td style="padding:10px 12px;color:rgba(255,255,255,.6);font-size:12px;">${p.matchedVia === 'fk' ? 'enrolment FK (player.parent_id)' : 'parent_email exact match'}</td>
      <td style="padding:10px 12px;"><code style="background:rgba(255,255,255,.05);padding:2px 6px;border-radius:4px;font-size:11px;">${p.stage}</code></td>
      <td style="padding:10px 12px;">
        <span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:500;border:1px solid;${BADGE_TONE[p.badge.tone]}">
          <span aria-hidden>${p.badge.emoji}</span>${p.badge.label}
        </span>
      </td>
    </tr>`).join('')}
  </tbody>
</table>

<h2 style="margin-top:32px;font-size:16px;font-weight:700;color:rgba(255,255,255,.8);">Orphan booking-source rows (NOT surfaced on Parents page)</h2>
<p style="color:rgba(255,255,255,.4);font-size:12px;">These trial bookings have no FK + no matching parent email. They continue to surface in /dashboard/enrolments and /dashboard/trials.</p>
<table style="width:100%;margin-top:12px;border-collapse:collapse;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.06);border-radius:12px;overflow:hidden;">
  <thead><tr style="background:rgba(255,255,255,.02);">
    <th style="text-align:left;padding:8px 12px;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:rgba(255,255,255,.5);">Parent name (booking)</th>
    <th style="text-align:left;padding:8px 12px;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:rgba(255,255,255,.5);">Email</th>
    <th style="text-align:left;padding:8px 12px;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:rgba(255,255,255,.5);">Reason</th>
  </tr></thead>
  <tbody>
${(bookings || []).filter(b => {
  const stage = deriveBooking(b)
  if (!needs(stage)) return false
  if (!b.parent_email) return true
  return !(parents || []).find(p => p.email?.trim().toLowerCase() === b.parent_email.trim().toLowerCase())
}).map(b => `
    <tr style="border-top:1px solid rgba(255,255,255,.04);">
      <td style="padding:10px 12px;color:rgba(255,255,255,.8);">${escapeHtml(b.parent_name || '(unnamed)')}</td>
      <td style="padding:10px 12px;color:rgba(255,255,255,.6);font-size:12px;">${escapeHtml(b.parent_email || '(none)')}</td>
      <td style="padding:10px 12px;color:rgba(255,255,255,.6);font-size:12px;">${b.parent_email ? 'No parent profile with this email — booker not signed up yet' : 'No email captured on booking'}</td>
    </tr>`).join('')}
  </tbody>
</table>

</body></html>`

function escapeHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

process.stdout.write(html)
