/**
 * Phase 2.5 live smoke — verify the contact loader against production.
 *
 * Reads the SAME tables with the SAME filters as the runtime loader.
 * Confirms:
 *   • Loader sees the JSL March-2026 message and attributes it to the right parent
 *   • All 73 other parents end up as 'never'
 *   • Conversation count is 0 across the board (matches audit)
 *   • Bucket distribution per org matches what the Parents page will display
 *
 *   set -a && source /tmp/.env.prod && set +a && \
 *   node scripts/_smoke_contact_loader_prod.mjs
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

// Mirror of loadLastContactedMap.
async function loadForParents(parentIds) {
  if (parentIds.length === 0) return new Map()
  const ids = parentIds.join(',')
  const [{ data: legacy }, { data: parts }] = await Promise.all([
    sb.from('messages')
      .select('sender_id, recipient_id, created_at')
      .or(`sender_id.in.(${ids}),recipient_id.in.(${ids})`)
      .order('created_at', { ascending: false }),
    sb.from('conversation_participants')
      .select('conversation_id, user_id')
      .in('user_id', parentIds),
  ])

  const lastByParent = new Map()
  const parentSet = new Set(parentIds)
  for (const r of (legacy || [])) {
    if (parentSet.has(r.sender_id) && !lastByParent.has(r.sender_id)) lastByParent.set(r.sender_id, r.created_at)
    if (parentSet.has(r.recipient_id) && !lastByParent.has(r.recipient_id)) lastByParent.set(r.recipient_id, r.created_at)
  }

  // Conversation arm
  const countsByParent = new Map()
  const convIds = []
  for (const p of (parts || [])) {
    countsByParent.set(p.user_id, (countsByParent.get(p.user_id) || 0) + 1)
    if (!convIds.includes(p.conversation_id)) convIds.push(p.conversation_id)
  }
  if (convIds.length > 0) {
    const { data: msgs } = await sb.from('conversation_messages')
      .select('conversation_id, created_at')
      .in('conversation_id', convIds)
      .order('created_at', { ascending: false })
    const latestByConv = new Map()
    for (const m of (msgs || [])) {
      if (!latestByConv.has(m.conversation_id)) latestByConv.set(m.conversation_id, m.created_at)
    }
    const partsByConv = new Map()
    for (const p of (parts || [])) {
      const a = partsByConv.get(p.conversation_id) || []
      a.push(p.user_id)
      partsByConv.set(p.conversation_id, a)
    }
    for (const [convId, ts] of latestByConv) {
      for (const userId of (partsByConv.get(convId) || [])) {
        const prev = lastByParent.get(userId)
        if (!prev || prev < ts) lastByParent.set(userId, ts)
      }
    }
  }

  const out = new Map()
  for (const [pid, iso] of lastByParent) {
    out.set(pid, { lastIso: iso, mostRecentMessageIso: iso, conversationCount: countsByParent.get(pid) || 0 })
  }
  for (const pid of countsByParent.keys()) {
    if (!out.has(pid)) out.set(pid, { lastIso: null, mostRecentMessageIso: null, conversationCount: countsByParent.get(pid) })
  }
  return out
}

const { data: orgs } = await sb.from('organisations').select('id, name').order('name')

console.log('\nPhase 2.5 — contact-loader smoke (production)\n')
console.log('org                          | parents | recent_30d | stale_30plus | never | sample identified')
console.log('─────────────────────────────┼─────────┼────────────┼──────────────┼───────┼──────────────────')

let totals = { parents: 0, recent: 0, stale: 0, never: 0 }

for (const o of orgs) {
  const { data: parents } = await sb.from('profiles').select('id, full_name, email').eq('organisation_id', o.id).eq('role', 'parent')
  const parentIds = (parents || []).map(p => p.id)
  if (parentIds.length === 0) continue
  const map = await loadForParents(parentIds)

  let recent = 0, stale = 0, never = 0
  let sample = ''
  for (const p of parents) {
    const sig = map.get(p.id) || null
    const b = bucket(sig?.lastIso ?? null)
    if (b === 'never') { never++ } else if (b === 'stale_30plus') { stale++; if (!sample) sample = `${p.full_name || p.email} → stale (${sig.lastIso?.slice(0,10)})` }
    else { recent++; if (!sample) sample = `${p.full_name || p.email} → recent (${sig.lastIso?.slice(0,10)})` }
  }
  totals.parents += parents.length; totals.recent += recent; totals.stale += stale; totals.never += never
  console.log(`${(o.name || '').padEnd(28).slice(0,28)} | ${String(parents.length).padStart(7)} | ${String(recent).padStart(10)} | ${String(stale).padStart(12)} | ${String(never).padStart(5)} | ${sample}`)
}
console.log(`\nAcross all orgs:  parents=${totals.parents}  recent_30d=${totals.recent}  stale_30plus=${totals.stale}  never=${totals.never}`)
