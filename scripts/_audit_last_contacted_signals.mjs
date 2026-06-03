/**
 * Phase 2.5 audit — Last Contacted data discovery.
 *
 * READ-ONLY. Inspects:
 *   • legacy public.messages (sender_id, recipient_id, created_at)
 *   • new public.conversations + conversation_participants + conversation_messages
 *   • parents per org
 * Reports per-org:
 *   • total messages (legacy)
 *   • total conversation_messages (new)
 *   • parents with any contact record (in either system)
 *   • newest message timestamp per system
 *   • parents NEVER contacted
 *   • parents contacted in last 30d
 *
 *   set -a && source /tmp/.env.prod && set +a && \
 *   node scripts/_audit_last_contacted_signals.mjs
 */
import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const NOW = Date.now()

const { data: orgs } = await sb.from('organisations').select('id, name').order('name')

const totals = {
  orgs: 0,
  parents: 0,
  legacy_messages: 0,
  conv_messages: 0,
  parents_contacted_any_system: 0,
  parents_contacted_30d: 0,
  parents_never_contacted: 0,
}

const rowsOut = []

for (const o of orgs) {
  const { data: parents } = await sb
    .from('profiles')
    .select('id, full_name')
    .eq('organisation_id', o.id)
    .eq('role', 'parent')
  const parentIds = (parents || []).map(p => p.id)
  if (parentIds.length === 0) {
    rowsOut.push({ org: o.name, parents: 0, legacy: 0, conv: 0, contacted: 0, contacted30d: 0, never: 0, last_legacy: '—', last_conv: '—' })
    continue
  }

  // ─── Legacy messages: sender_id ∈ admins ∧ recipient_id ∈ parents OR sender_id ∈ parents ∧ recipient_id ∈ admins
  // For simplicity, pull where parent is sender OR recipient and group by parent.
  const { data: legacyMsgs } = await sb
    .from('messages')
    .select('sender_id, recipient_id, created_at')
    .or(`sender_id.in.(${parentIds.join(',')}),recipient_id.in.(${parentIds.join(',')})`)
    .order('created_at', { ascending: false })

  const lastLegacyByParent = new Map()
  for (const m of (legacyMsgs || [])) {
    const partner = parentIds.includes(m.sender_id) ? m.sender_id : m.recipient_id
    if (!lastLegacyByParent.has(partner)) lastLegacyByParent.set(partner, m.created_at)
  }

  // ─── New conversation system: find conversations where ANY participant is a parent of this org
  const { data: convParts } = await sb
    .from('conversation_participants')
    .select('conversation_id, user_id')
    .in('user_id', parentIds)

  const convIds = [...new Set((convParts || []).map(c => c.conversation_id))]
  const lastConvByParent = new Map()
  if (convIds.length > 0) {
    const { data: convMsgs } = await sb
      .from('conversation_messages')
      .select('conversation_id, created_at')
      .in('conversation_id', convIds)
      .order('created_at', { ascending: false })
    // For each conv, the latest message timestamp; map every parent participant
    // of that conv to that timestamp (if earlier than already-recorded).
    const lastByConv = new Map()
    for (const m of (convMsgs || [])) {
      if (!lastByConv.has(m.conversation_id)) lastByConv.set(m.conversation_id, m.created_at)
    }
    const partsByConv = new Map()
    for (const p of (convParts || [])) {
      const arr = partsByConv.get(p.conversation_id) || []
      arr.push(p.user_id)
      partsByConv.set(p.conversation_id, arr)
    }
    for (const [convId, ts] of lastByConv) {
      for (const userId of (partsByConv.get(convId) || [])) {
        const prev = lastConvByParent.get(userId)
        if (!prev || prev < ts) lastConvByParent.set(userId, ts)
      }
    }
  }

  // ─── Roll-up per parent: max(legacy, conv)
  let contacted = 0, contacted30d = 0, never = 0
  const thirtyAgo = NOW - 30 * 86_400_000
  for (const p of parents) {
    const a = lastLegacyByParent.get(p.id)
    const b = lastConvByParent.get(p.id)
    const last = [a, b].filter(Boolean).sort().pop() || null
    if (last) {
      contacted++
      if (Date.parse(last) >= thirtyAgo) contacted30d++
    } else never++
  }

  const newest = (m) => {
    const arr = [...m.values()]
    arr.sort()
    return arr.length ? arr[arr.length - 1].slice(0, 10) : '—'
  }

  totals.orgs++
  totals.parents += parents.length
  totals.legacy_messages += (legacyMsgs || []).length
  // Count conv messages: sum lastByConv entries is misleading; pull explicit count
  if (convIds.length > 0) {
    const { count: convCount } = await sb.from('conversation_messages').select('id', { count: 'exact', head: true }).in('conversation_id', convIds)
    totals.conv_messages += convCount || 0
  }
  totals.parents_contacted_any_system += contacted
  totals.parents_contacted_30d += contacted30d
  totals.parents_never_contacted += never

  rowsOut.push({ org: o.name, parents: parents.length, legacy: (legacyMsgs || []).length, conv: convIds.length, contacted, contacted30d, never, last_legacy: newest(lastLegacyByParent), last_conv: newest(lastConvByParent) })
}

console.log(`\nPhase 2.5 — Last Contacted data audit\n`)
console.log('org                          | parents | legacy_msgs | conv_count | contacted | last 30d | never | last_legacy_msg | last_conv_msg')
console.log('─────────────────────────────┼─────────┼─────────────┼────────────┼───────────┼──────────┼───────┼─────────────────┼──────────────')
for (const r of rowsOut) {
  console.log(`${(r.org || '').padEnd(28).slice(0,28)} | ${String(r.parents).padStart(7)} | ${String(r.legacy).padStart(11)} | ${String(r.conv).padStart(10)} | ${String(r.contacted).padStart(9)} | ${String(r.contacted30d).padStart(8)} | ${String(r.never).padStart(5)} | ${r.last_legacy.padEnd(15)} | ${r.last_conv}`)
}
console.log(`\n──── TOTALS ────`)
console.log(`  Orgs                                 : ${totals.orgs}`)
console.log(`  Parents (across all orgs)            : ${totals.parents}`)
console.log(`  Legacy messages rows                 : ${totals.legacy_messages}`)
console.log(`  Conversation messages (new system)   : ${totals.conv_messages}`)
console.log(`  Parents with ANY contact record      : ${totals.parents_contacted_any_system}`)
console.log(`  Parents contacted in last 30 days    : ${totals.parents_contacted_30d}`)
console.log(`  Parents NEVER contacted              : ${totals.parents_never_contacted}`)
