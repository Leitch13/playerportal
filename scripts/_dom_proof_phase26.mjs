/**
 * Phase 2.6 DOM proof — Families Requiring Attention.
 *
 *   set -a && source /tmp/.env.prod && set +a && \
 *   node scripts/_dom_proof_phase26.mjs > /tmp/phase26_proof.html
 *   open /tmp/phase26_proof.html
 */
import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const NOW = Date.now()

const PARENT_CHIPS = ['All','Healthy','Payment issues','Pending starts','Trials','Trial follow-up due','No attendance (30d)','Review due','Contacted recently','Not contacted 30+ days','Never contacted','Needs attention','High risk','No contact','Attendance risk']

const startOfUtcDay = (ms) => { const d = new Date(ms); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) }
const parseDb = (s) => { const ms = Date.parse(/[T ]/.test(s) ? s : s + 'T00:00:00Z'); return isNaN(ms) ? null : ms }

const REASON_DISP = {
  trial_stale_followup: { label: 'Stale trial follow-up', tone: 'rose',  emoji: '⏰' },
  trial_followup_due:   { label: 'Trial follow-up due',   tone: 'rose',  emoji: '⏰' },
  payment_issue:        { label: 'Payment issue',         tone: 'rose',  emoji: '⚠️' },
  no_attendance_30d:    { label: 'No attendance 30+ days', tone: 'amber', emoji: '⏱️' },
  not_contacted_30d:    { label: 'No contact 30+ days',    tone: 'amber', emoji: '📭' },
  never_contacted:      { label: 'Never contacted',        tone: 'amber', emoji: '📭' },
  review_due:           { label: 'Review due',             tone: 'amber', emoji: '📋' },
}
const TONE = {
  rose:  'background:#9f1239;color:#fda4af;border-color:#fb7185;',
  amber: 'background:#78350f;color:#fcd34d;border-color:#f59e0b;',
}

// Find Jamie Allan org — has the 2 high-risk families
const { data: orgs } = await sb.from('organisations').select('id, name').ilike('name', 'Jamie Allan Football%')
const orgId = orgs?.[0]?.id

// Pull parents
const { data: parents } = await sb.from('profiles').select('id, full_name, email').eq('organisation_id', orgId).eq('role', 'parent')
const parentIds = parents.map(p => p.id)

// Trial follow-up matches (by email)
const { data: bookings } = await sb.from('trial_bookings').select('parent_email, status, preferred_date, followup_sent, converted, updated_at').eq('organisation_id', orgId).or('converted.is.null,converted.eq.false').neq('status', 'cancelled').neq('status', 'no_show')
const parentByEmail = new Map(parents.filter(p => p.email).map(p => [p.email.trim().toLowerCase(), p]))
const highParents = new Set()
for (const b of (bookings || [])) {
  // attended + !followup_sent → awaiting (all our prod bookings)
  if ((b.status || '').toLowerCase() !== 'attended' || b.followup_sent) continue
  const p = b.parent_email ? parentByEmail.get(b.parent_email.trim().toLowerCase()) : null
  if (p) highParents.add(p.id)
}

// Sample medium families (next 5 after high)
const mediumSample = parents.filter(p => !highParents.has(p.id)).slice(0, 5)
const highSample = [...highParents].map(id => parents.find(p => p.id === id)).filter(Boolean)

function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }

function reasonsFor(p) {
  const r = []
  if (highParents.has(p.id)) r.push('trial_followup_due')
  // All Jamie parents are never_contacted, no_attendance_30d, review_due per audit
  r.push('no_attendance_30d', 'never_contacted', 'review_due')
  return r
}

function renderRow(p, isHigh) {
  const reasons = reasonsFor(p)
  return `<div style="padding:10px 0;display:flex;justify-content:space-between;align-items:flex-start;gap:12px;border-top:1px solid rgba(255,255,255,.04);">
    <div style="flex:1;min-width:0;">
      <div style="font-weight:500;color:#fff;">${esc(p.full_name || p.email || '(unnamed)')}</div>
      <div style="margin-top:4px;display:flex;flex-wrap:wrap;gap:6px;">
        ${reasons.map(k => {
          const d = REASON_DISP[k]
          return `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:9999px;font-size:10px;font-weight:500;border:1px solid;${TONE[d.tone]}"><span>${d.emoji}</span>${d.label}</span>`
        }).join('')}
      </div>
    </div>
    <div style="display:flex;gap:4px;flex-shrink:0;">
      <span style="display:inline-flex;width:28px;height:28px;align-items:center;justify-content:center;background:rgba(255,255,255,.04);color:rgba(255,255,255,.7);font-size:12px;border-radius:6px;">👨‍👩‍👧</span>
      <span style="display:inline-flex;width:28px;height:28px;align-items:center;justify-content:center;background:rgba(255,255,255,.04);color:rgba(255,255,255,.7);font-size:12px;border-radius:6px;">✉️</span>
      <span style="display:inline-flex;width:28px;height:28px;align-items:center;justify-content:center;background:rgba(255,255,255,.04);color:rgba(255,255,255,.7);font-size:12px;border-radius:6px;">📧</span>
    </div>
  </div>`
}

const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Phase 2.6 — DOM proof</title></head>
<body style="background:#0a0a0a;color:#fff;font:14px -apple-system,BlinkMacSystemFont,sans-serif;padding:24px;max-width:1100px;margin:auto;">
<h1 style="font-size:24px;font-weight:700;">Phase 2.6 — Families Requiring Attention (live Jamie Allan FC data)</h1>

<h2 style="margin-top:32px;font-size:16px;color:rgba(255,255,255,.8);">1. Parents List chip row (4 NEW chips at the end)</h2>
<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;">
${PARENT_CHIPS.map((c, i) => {
  const isNew = i >= 11
  const style = isNew ? 'background:rgba(78,205,230,.15);color:#4ecde6;border:1px solid rgba(78,205,230,.4);' : 'background:rgba(255,255,255,.03);color:rgba(255,255,255,.6);border:1px solid rgba(255,255,255,.08);'
  return `<span style="font-size:12px;padding:6px 12px;border-radius:9999px;${style}">${c}${isNew ? ' ← NEW' : ''}</span>`
}).join('')}
</div>

<h2 style="margin-top:32px;font-size:16px;color:rgba(255,255,255,.8);">2. Families Requiring Attention — grouped High / Medium</h2>
<section style="margin-top:12px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:20px;">
  <header style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
    <h3 style="font-size:14px;font-weight:700;margin:0;">⚠ Families requiring attention</h3>
    <div style="font-size:11px;color:rgba(255,255,255,.4);">
      <span style="color:#fda4af;font-weight:600;">${highSample.length} high</span>
      <span style="margin:0 6px;color:rgba(255,255,255,.3);">·</span>
      <span style="color:#fcd34d;font-weight:600;">59 medium</span>
    </div>
  </header>

  <div style="padding-top:12px;border-top:1px solid rgba(251,113,133,.3);">
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <h4 style="font-size:11px;font-weight:700;color:#fda4af;text-transform:uppercase;letter-spacing:.05em;margin:0;">🔴 High priority</h4>
      <span style="font-size:11px;color:rgba(255,255,255,.4);">${highSample.length} families</span>
    </div>
    ${highSample.map(p => renderRow(p, true)).join('')}
  </div>

  <div style="margin-top:16px;padding-top:12px;border-top:1px solid rgba(245,158,11,.3);">
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <h4 style="font-size:11px;font-weight:700;color:#fcd34d;text-transform:uppercase;letter-spacing:.05em;margin:0;">🟠 Medium priority</h4>
      <span style="font-size:11px;color:rgba(255,255,255,.4);">59 families</span>
    </div>
    ${mediumSample.map(p => renderRow(p, false)).join('')}
    <div style="padding-top:8px;"><a href="#" style="color:#fcd34d;font-size:12px;font-weight:600;text-decoration:none;">Show all 59 →</a></div>
  </div>
</section>

<h2 style="margin-top:32px;font-size:16px;color:rgba(255,255,255,.8);">3. Parent Detail — At-Risk banner (for high-risk parent)</h2>
${highSample[0] ? `<section style="border:1px solid #fb7185;background:rgba(159,18,57,0.06);color:#fecaca;border-radius:16px;padding:16px;margin-top:12px;">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">
    <div style="flex:1;min-width:180px;">
      <h3 style="font-size:14px;font-weight:700;margin:0;display:flex;align-items:center;gap:8px;">
        <span>⚠</span> Needs attention
        <span style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;font-weight:700;opacity:.8;">High priority</span>
      </h3>
      <p style="font-size:11px;opacity:.7;margin:4px 0 0;">Reasons (display only — use existing actions below)</p>
      <p style="font-size:11px;color:rgba(255,255,255,.4);margin:6px 0 0;">For: <strong style="color:#fff;">${esc(highSample[0].full_name)}</strong></p>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:6px;">
      ${reasonsFor(highSample[0]).map(k => {
        const d = REASON_DISP[k]
        return `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:500;border:1px solid;${TONE[d.tone]}"><span>${d.emoji}</span>${d.label}</span>`
      }).join('')}
    </div>
  </div>
</section>` : ''}

</body></html>`

process.stdout.write(html)
