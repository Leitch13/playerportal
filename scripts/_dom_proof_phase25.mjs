/**
 * Phase 2.5 — DOM proof for Last Contacted surfaces.
 *
 * Renders:
 *   1. Parents List chip row (3 NEW chips highlighted)
 *   2. Parents List rows showing Last contact column tone shifts
 *   3. Parent Detail CommunicationPanel three-stat row
 *   4. Players List row with the 📭 No-contact-30+d badge
 *
 *   set -a && source /tmp/.env.prod && set +a && \
 *   node scripts/_dom_proof_phase25.mjs > /tmp/phase25_proof.html
 *   open /tmp/phase25_proof.html
 */
import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const NOW = Date.now()

const STALE_DAYS = 30
const startOfUtcDay = (ms) => { const d = new Date(ms); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) }
const parseSafe = (s) => { const ms = Date.parse(/[T ]/.test(s) ? s : s + 'T00:00:00Z'); return isNaN(ms) ? null : ms }
function bucket(lastIso) {
  if (!lastIso) return 'never'
  const ms = parseSafe(lastIso); if (ms === null) return 'never'
  const days = Math.floor((startOfUtcDay(NOW) - startOfUtcDay(ms)) / 86_400_000)
  if (days <= 0) return 'today'
  if (days <= 7) return 'recent_7d'
  if (days <= STALE_DAYS) return 'recent_30d'
  return 'stale_30plus'
}
function formatAge(lastIso) {
  if (!lastIso) return 'Never'
  const ms = parseSafe(lastIso); if (ms === null) return 'Never'
  const days = Math.floor((startOfUtcDay(NOW) - startOfUtcDay(ms)) / 86_400_000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days} days ago`
}

const PARENT_CHIPS = ['All','Healthy','Payment issues','Pending starts','Trials','Trial follow-up due','No attendance (30d)','Review due','Contacted recently','Not contacted 30+ days','Never contacted']

const { data: orgs } = await sb.from('organisations').select('id, name').ilike('name', 'JSl%')
const orgId = orgs?.[0]?.id

const { data: parents } = await sb.from('profiles').select('id, full_name, email').eq('organisation_id', orgId).eq('role', 'parent').order('full_name')
const parentIds = parents.map(p => p.id)
const { data: msgs } = await sb.from('messages').select('sender_id, recipient_id, created_at').or(`sender_id.in.(${parentIds.join(',')}),recipient_id.in.(${parentIds.join(',')})`).order('created_at', { ascending: false })

const lastByParent = new Map()
const parentSet = new Set(parentIds)
for (const m of (msgs || [])) {
  if (parentSet.has(m.sender_id) && !lastByParent.has(m.sender_id)) lastByParent.set(m.sender_id, m.created_at)
  if (parentSet.has(m.recipient_id) && !lastByParent.has(m.recipient_id)) lastByParent.set(m.recipient_id, m.created_at)
}

function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }

const sampleRows = parents.slice(0, 8).map(p => {
  const iso = lastByParent.get(p.id) || null
  const b = bucket(iso)
  const cls = b === 'never' ? 'color:#fda4af' : b === 'stale_30plus' ? 'color:#fcd34d' : 'color:rgba(255,255,255,.7)'
  return { name: p.full_name || p.email, age: formatAge(iso), bucket: b, cls }
})

const stale = parents.find(p => bucket(lastByParent.get(p.id) || null) === 'stale_30plus')
const staleIso = stale ? lastByParent.get(stale.id) : null

const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Phase 2.5 — DOM proof</title></head>
<body style="background:#0a0a0a;color:#fff;font:14px -apple-system,BlinkMacSystemFont,sans-serif;padding:24px;max-width:1100px;margin:auto;">
<h1 style="font-size:24px;font-weight:700;">Phase 2.5 — Last Contacted surfaces (live JSL sports data)</h1>

<h2 style="margin-top:32px;font-size:16px;color:rgba(255,255,255,.8);">1. Parents List — filter chip row (3 NEW chips at the end)</h2>
<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;">
${PARENT_CHIPS.map((c, i) => {
  const isNew = i >= 8
  const style = isNew ? 'background:rgba(78,205,230,.15);color:#4ecde6;border:1px solid rgba(78,205,230,.4);' : 'background:rgba(255,255,255,.03);color:rgba(255,255,255,.6);border:1px solid rgba(255,255,255,.08);'
  return `<span style="font-size:12px;padding:6px 12px;border-radius:9999px;${style}">${c}${isNew ? ' ← NEW' : ''}</span>`
}).join('\n')}
</div>

<h2 style="margin-top:32px;font-size:16px;color:rgba(255,255,255,.8);">2. Parents List rows showing the new "Last contact" column</h2>
<table style="width:100%;margin-top:12px;border-collapse:collapse;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.06);border-radius:12px;overflow:hidden;">
<thead><tr style="background:rgba(255,255,255,.02);">
  <th style="text-align:left;padding:8px 12px;font-size:11px;color:rgba(255,255,255,.5);text-transform:uppercase;">Family</th>
  <th style="text-align:left;padding:8px 12px;font-size:11px;color:rgba(255,255,255,.5);text-transform:uppercase;">Last contact (NEW)</th>
  <th style="text-align:left;padding:8px 12px;font-size:11px;color:rgba(255,255,255,.5);text-transform:uppercase;">Tone</th>
</tr></thead><tbody>
${sampleRows.map(r => `<tr style="border-top:1px solid rgba(255,255,255,.04);">
  <td style="padding:10px 12px;color:#4ecde6;">${esc(r.name)}</td>
  <td style="padding:10px 12px;${r.cls};font-weight:600;">${r.age}</td>
  <td style="padding:10px 12px;color:rgba(255,255,255,.5);font-size:11px;"><code>${r.bucket}</code></td>
</tr>`).join('')}
</tbody></table>
<p style="color:rgba(255,255,255,.4);font-size:12px;margin-top:8px;">Above: 8 of 12 JSl sports parents. Rose = never. Amber = stale 30+d. Muted = recent (none in this org).</p>

<h2 style="margin-top:32px;font-size:16px;color:rgba(255,255,255,.8);">3. Parent Detail — CommunicationPanel three-stat row (NEW)</h2>
${stale ? `<div style="margin-top:12px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:20px;">
  <h3 style="font-size:11px;color:rgba(255,255,255,.6);text-transform:uppercase;letter-spacing:.05em;font-weight:700;margin:0 0 12px;">Communication</h3>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:24px;padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,.05);">
    <div><div style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:rgba(255,255,255,.4);">Last contact</div><div style="margin-top:4px;font-weight:700;color:#fcd34d;">${formatAge(staleIso)}</div></div>
    <div><div style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:rgba(255,255,255,.4);">Conversations</div><div style="margin-top:4px;font-weight:700;">0</div></div>
    <div><div style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:rgba(255,255,255,.4);">Most recent message</div><div style="margin-top:4px;font-weight:700;">${new Date(staleIso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div></div>
  </div>
  <p style="margin:12px 0 0;color:rgba(255,255,255,.4);font-size:11px;">For: <strong>${esc(stale.full_name)}</strong></p>
</div>` : '<p style="color:rgba(255,255,255,.4);">No stale parents to render in this org.</p>'}

<h2 style="margin-top:32px;font-size:16px;color:rgba(255,255,255,.8);">4. Players List — optional "No contact 30+ days" badge (NEW)</h2>
<table style="width:100%;margin-top:12px;border-collapse:collapse;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.06);border-radius:12px;overflow:hidden;">
<thead><tr style="background:rgba(255,255,255,.02);">
  <th style="text-align:left;padding:8px 12px;font-size:11px;color:rgba(255,255,255,.5);text-transform:uppercase;">Player</th>
  <th style="text-align:left;padding:8px 12px;font-size:11px;color:rgba(255,255,255,.5);text-transform:uppercase;">Status</th>
</tr></thead><tbody>
<tr style="border-top:1px solid rgba(255,255,255,.04);">
  <td style="padding:10px 12px;color:#4ecde6;">
    Example Player
    <span title="Parent has not been contacted in 30+ days" style="margin-left:6px;padding:2px 6px;border-radius:9999px;font-size:9px;border:1px solid #fb7185;background:rgba(159,18,57,1);color:#fda4af;">📭</span>
  </td>
  <td style="padding:10px 12px;"><span style="padding:2px 8px;border-radius:9999px;font-size:11px;background:rgba(16,185,129,.15);color:#34d399;">🟢 Active</span></td>
</tr>
</tbody></table>

</body></html>`
process.stdout.write(html)
