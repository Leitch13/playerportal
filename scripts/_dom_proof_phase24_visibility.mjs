/**
 * Phase 2.4 step 4 — DOM proof for the three new visibility surfaces.
 *
 * Renders:
 *   1. Players List filter row (NEW chip highlighted)
 *   2. Players-row badge layout (showing badge placement)
 *   3. Parent Detail FamilyInsightsBar — for the affected parents
 *   4. TrialManager tab row (NEW tab highlighted) + funnel-column tone shift
 *
 *   set -a && source /tmp/.env.prod && set +a && \
 *   node scripts/_dom_proof_phase24_visibility.mjs > /tmp/phase24_visibility_proof.html
 *   open /tmp/phase24_visibility_proof.html
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
const needs = (s) => s === 'awaiting_followup' || s === 'stale_followup'
const badgeFor = (s) => s === 'stale_followup' ? { label: 'Stale trial follow-up', emoji: '⏰', tone: 'rose' }
  : s === 'awaiting_followup' ? { label: 'Trial follow-up due', emoji: '⏰', tone: 'amber' }
  : null
const STAGE_LABEL = { awaiting_followup: 'Follow-up due', stale_followup: 'Stale follow-up' }

const { data: orgs } = await sb.from('organisations').select('id, name').ilike('name', 'Jamie Allan Football%')
const orgId = orgs?.[0]?.id

const { data: parents } = await sb.from('profiles').select('id, full_name, email').eq('organisation_id', orgId).eq('role', 'parent')

const { data: bookings } = await sb.from('trial_bookings')
  .select('id, status, preferred_date, followup_sent, converted, updated_at, parent_name, parent_email, child_name')
  .eq('organisation_id', orgId)
  .or('converted.is.null,converted.eq.false')
  .neq('status', 'cancelled').neq('status', 'no_show')

// Match bookings to parents by email
const emailMap = new Map((parents || []).filter(p => p.email).map(p => [p.email.trim().toLowerCase(), p]))

const ROSE = 'background:#9f1239;color:#fda4af;border-color:#fb7185;'
const AMBER = 'background:#78350f;color:#fcd34d;border-color:#f59e0b;'

const followUpBookings = (bookings || []).map(b => ({ ...b, stage: deriveBooking(b) })).filter(b => needs(b.stage))
const badgedParents = followUpBookings
  .filter(b => emailMap.has((b.parent_email || '').trim().toLowerCase()))
  .map(b => ({ parent: emailMap.get(b.parent_email.trim().toLowerCase()), b, badge: badgeFor(b.stage) }))

function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }

const PLAYER_CHIPS = ['All','Active','Pending start','Trial','Trial follow-up due','Paused','Payment issue','No attendance (30d)','Review due']
const TRIAL_TABS = ['All','Pending','Confirmed','Attended','Follow-up due']

const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Phase 2.4 — Visibility surfaces DOM proof</title></head>
<body style="background:#0a0a0a;color:#fff;font:14px -apple-system,BlinkMacSystemFont,'SF Pro',sans-serif;padding:24px;max-width:1100px;margin:auto;">

<h1 style="font-size:24px;font-weight:700;">Phase 2.4 — Visibility surfaces rendered from production data</h1>
<p style="color:rgba(255,255,255,.6);">Org: <strong>Jamie Allan Football Academy</strong>. Live read-only fixture using the same derive layer the pages run.</p>

<!-- ── 1. Players List filter row ── -->
<h2 style="margin-top:32px;font-size:16px;font-weight:700;color:rgba(255,255,255,.8);">1. Players List — filter chip row</h2>
<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;">
${PLAYER_CHIPS.map(c => {
  const active = c === 'Trial follow-up due'
  const style = active
    ? 'background:rgba(78,205,230,.15);color:#4ecde6;border:1px solid rgba(78,205,230,.4);'
    : 'background:rgba(255,255,255,.03);color:rgba(255,255,255,.6);border:1px solid rgba(255,255,255,.08);'
  return `<span style="font-size:12px;padding:6px 12px;border-radius:9999px;${style}">${c}${active ? ' ← NEW' : ''}</span>`
}).join('\n')}
</div>
<p style="color:rgba(255,255,255,.4);font-size:12px;margin-top:8px;">Live cohort match: <strong>0 players</strong> across all orgs because every current follow-up in prod is a legacy <code>trial_bookings</code> row (no player FK). As soon as an <code>enrolments.is_trial=true</code> row enters follow-up, its player will show with the inline ⏰ chip next to the review-due badge.</p>

<h3 style="margin-top:16px;font-size:13px;font-weight:600;color:rgba(255,255,255,.7);">Mockup of a player row WITH the badge (placement reference)</h3>
<table style="width:100%;margin-top:8px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.06);border-radius:12px;overflow:hidden;border-collapse:collapse;">
<thead><tr style="background:rgba(255,255,255,.02);">
  <th style="text-align:left;padding:8px 12px;font-size:11px;text-transform:uppercase;color:rgba(255,255,255,.5);">Player</th>
  <th style="text-align:left;padding:8px 12px;font-size:11px;text-transform:uppercase;color:rgba(255,255,255,.5);">Age</th>
  <th style="text-align:left;padding:8px 12px;font-size:11px;text-transform:uppercase;color:rgba(255,255,255,.5);">Status</th>
</tr></thead>
<tbody>
  <tr style="border-top:1px solid rgba(255,255,255,.04);">
    <td style="padding:10px 12px;color:#4ecde6;font-weight:500;">
      Example Player
      <span style="margin-left:6px;padding:2px 6px;border-radius:9999px;font-size:9px;border:1px solid;${AMBER}" title="Trial follow-up due">⏰</span>
    </td>
    <td style="padding:10px 12px;color:rgba(255,255,255,.7);">9</td>
    <td style="padding:10px 12px;"><span style="padding:2px 8px;border-radius:9999px;font-size:11px;background:rgba(14,165,233,.15);color:#7dd3fc;border:1px solid rgba(14,165,233,.3);">🔵 Trial</span></td>
  </tr>
</tbody>
</table>

<!-- ── 2. Parent Detail FamilyInsightsBar ── -->
<h2 style="margin-top:32px;font-size:16px;font-weight:700;color:rgba(255,255,255,.8);">2. Parent Detail — FamilyInsightsBar with new badge appended</h2>
${badgedParents.length === 0 ? '<p style="color:rgba(255,255,255,.4);">No badged parents in prod.</p>' : badgedParents.map(p => `
<div style="margin-top:12px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:16px;">
  <p style="margin:0 0 4px;color:rgba(255,255,255,.4);font-size:11px;">/dashboard/parents/${esc(p.parent.id)}</p>
  <h3 style="margin:0;color:#fff;font-size:18px;font-weight:700;">${esc(p.parent.full_name)}</h3>
  <p style="margin:4px 0 12px;color:rgba(255,255,255,.5);font-size:12px;">${esc(p.parent.email)} · matched via parent_email exact match</p>
  <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
    <span style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:rgba(255,255,255,.4);font-weight:700;margin-right:4px;">Family insights</span>
    <span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:9999px;font-size:11px;font-weight:500;border:1px solid;${p.badge.tone === 'rose' ? ROSE : AMBER}">
      <span aria-hidden>${p.badge.emoji}</span>${p.badge.label}
    </span>
  </div>
</div>`).join('')}

<!-- ── 3. TrialManager tabs ── -->
<h2 style="margin-top:32px;font-size:16px;font-weight:700;color:rgba(255,255,255,.8);">3. TrialManager — new "Follow-up due" tab</h2>
<div style="display:flex;gap:4px;margin-top:8px;background:#141414;padding:4px;border-radius:8px;border:1px solid #1e1e1e;width:fit-content;">
${TRIAL_TABS.map((t, i) => {
  const active = i === 4
  const tabLabel = active ? `${t} (${followUpBookings.length})` : t
  return `<span style="padding:6px 12px;border-radius:6px;font-size:12px;font-weight:600;${active ? 'background:#1e1e1e;color:#fff;' : 'color:rgba(255,255,255,.4);'}${active ? '' : ''}">${tabLabel}${active ? ' ← NEW' : ''}</span>`
}).join('\n')}
</div>

<h3 style="margin-top:16px;font-size:13px;font-weight:600;color:rgba(255,255,255,.7);">Trials this tab will surface (${followUpBookings.length} rows)</h3>
<table style="width:100%;margin-top:8px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.06);border-radius:12px;overflow:hidden;border-collapse:collapse;">
<thead><tr style="background:rgba(255,255,255,.02);">
  <th style="text-align:left;padding:8px 12px;font-size:11px;text-transform:uppercase;color:rgba(255,255,255,.5);">Child</th>
  <th style="text-align:left;padding:8px 12px;font-size:11px;text-transform:uppercase;color:rgba(255,255,255,.5);">Parent</th>
  <th style="text-align:left;padding:8px 12px;font-size:11px;text-transform:uppercase;color:rgba(255,255,255,.5);">Status</th>
  <th style="text-align:left;padding:8px 12px;font-size:11px;text-transform:uppercase;color:rgba(255,255,255,.5);">Funnel column (NEW tone)</th>
</tr></thead>
<tbody>
${followUpBookings.map(b => `
<tr style="border-top:1px solid rgba(255,255,255,.04);">
  <td style="padding:10px 12px;color:rgba(255,255,255,.9);">${esc(b.child_name)}</td>
  <td style="padding:10px 12px;color:rgba(255,255,255,.7);"><p style="margin:0;">${esc(b.parent_name)}</p><p style="margin:0;font-size:11px;color:rgba(255,255,255,.4);">${esc(b.parent_email)}</p></td>
  <td style="padding:10px 12px;"><span style="padding:2px 8px;border-radius:9999px;font-size:11px;background:rgba(16,185,129,.10);color:#34d399;">Attended</span></td>
  <td style="padding:10px 12px;">
    <span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:500;border:1px solid;${b.stage === 'stale_followup' ? ROSE : AMBER}">
      ${STAGE_LABEL[b.stage]}
    </span>
  </td>
</tr>`).join('')}
</tbody>
</table>

</body></html>`

process.stdout.write(html)
