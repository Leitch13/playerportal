import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { matchFamilies, moneyMonths, monthlyWorth, LIVE, EVER_JOINED } from '@/lib/ascend-feed'

/**
 * POST /api/ascend/academy-feed — called by the ASCEND dashboard (social.johnleitchmentor.com),
 * never by a browser. See src/lib/ascend-feed.ts.
 *
 * Body: { slug, owner_email, contacts: string[] } (contacts are hashes, max 5,000).
 * Answers only when owner_email is the academy's contact email or one of its admins, so a
 * dashboard member can only ever read their own academy.
 */
export const dynamic = 'force-dynamic'

const fail = (error: string, status: number) => NextResponse.json({ error }, { status })

export async function POST(request: NextRequest) {
  const secret = process.env.ASCEND_FEED_SECRET || ''
  const got = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (secret.length < 24 || got.length !== secret.length || !timingSafeEqual(Buffer.from(got), Buffer.from(secret))) return fail('Not allowed', 401)

  let body: { slug?: unknown; owner_email?: unknown; contacts?: unknown }
  try { body = await request.json() } catch { return fail('Send JSON', 400) }
  const slug = String(body.slug || '').toLowerCase()
  const owner = String(body.owner_email || '').trim().toLowerCase()
  const asked = new Set((Array.isArray(body.contacts) ? body.contacts : []).slice(0, 5000).map(String).filter((h) => /^[0-9a-f]{64}$/.test(h)))
  if (!/^[a-z0-9-]{2,60}$/.test(slug) || !owner.includes('@')) return fail('Need the booking page name and the owner email', 400)

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: org } = await db.from('organisations').select('id, name, contact_email').eq('slug', slug).maybeSingle()
  if (!org) return fail('No academy with that booking page', 404)
  const { data: admins } = await db.from('profiles').select('email').eq('organisation_id', org.id).eq('role', 'admin')
  const owners = new Set([org.contact_email, ...(admins ?? []).map((a) => a.email)].filter(Boolean).map((e) => String(e).toLowerCase()))
  if (!owners.has(owner)) return fail(`${owner} isn't an owner of ${org.name} in Player Portal`, 403)

  const [{ data: trials }, { data: subs }, { data: plans }, { data: pays }] = await Promise.all([
    db.from('trial_bookings').select('parent_email, parent_phone, preferred_date, created_at').eq('organisation_id', org.id),
    db.from('subscriptions').select('parent_id, plan_id, status, created_at, canceled_at, cancelled_at').eq('organisation_id', org.id),
    db.from('subscription_plans').select('id, amount, interval').eq('organisation_id', org.id),
    db.from('payments').select('amount, created_at').eq('organisation_id', org.id).eq('status', 'paid').gte('created_at', new Date(Date.now() - 200 * 86400e3).toISOString()),
  ])
  const parentIds = [...new Set((subs ?? []).filter((s) => EVER_JOINED.includes(s.status)).map((s) => s.parent_id).filter(Boolean))] as string[]
  const parents = new Map<string, { email: string | null; phone: string | null }>()
  for (let i = 0; i < parentIds.length; i += 300) {
    const { data } = await db.from('profiles').select('id, email, phone').in('id', parentIds.slice(i, i + 300))
    for (const p of data ?? []) parents.set(p.id, { email: p.email, phone: p.phone })
  }

  const matches = matchFamilies(
    asked,
    (trials ?? []).map((t) => ({ email: t.parent_email, phone: t.parent_phone, at: String(t.preferred_date || t.created_at).slice(0, 10) })),
    (subs ?? []).filter((s) => EVER_JOINED.includes(s.status) && s.parent_id).map((s) => ({ ...parents.get(s.parent_id as string), at: String(s.created_at).slice(0, 10) })),
  )
  const plan = new Map((plans ?? []).map((p) => [p.id, p]))
  const live = (subs ?? []).filter((s) => LIVE.includes(s.status))
  const mrr = Math.round(live.reduce((a, s) => { const p = plan.get(s.plan_id); return a + (p ? monthlyWorth(Number(p.amount), p.interval) : 0) }, 0) * 100) / 100
  const months = moneyMonths(
    new Date().toISOString().slice(0, 7), 6,
    (pays ?? []).map((p) => ({ amount: Number(p.amount), at: String(p.created_at) })),
    (subs ?? []).map((s) => ({ status: s.status, created_at: String(s.created_at), ended_at: (s.canceled_at || s.cancelled_at || null) as string | null })),
  )
  // Cards that didn't go through: what's waiting to be collected (the academy sends a pay link from Player Portal).
  const failingSubs = (subs ?? []).filter((s) => ['past_due', 'unpaid'].includes(s.status))
  const failing = { count: failingSubs.length, amount: Math.round(failingSubs.reduce((a, s) => a + Number(plan.get(s.plan_id)?.amount || 0), 0) * 100) / 100 }
  // Every trial booked in the last 45 days, so the dashboard can list families who booked straight on
  // Player Portal and never filled in a form. Only this academy's own bookings, only to its owner.
  const { data: recent } = await db.from('trial_bookings')
    .select('id, parent_name, parent_email, parent_phone, child_name, child_age, preferred_date, created_at, status, converted, trial_source, training_group_id')
    .eq('organisation_id', org.id).gte('created_at', new Date(Date.now() - 45 * 86400e3).toISOString())
    .order('created_at', { ascending: false }).limit(300)
  const groupIds = [...new Set((recent ?? []).map((t) => t.training_group_id).filter(Boolean))] as string[]
  const { data: groups } = groupIds.length
    ? await db.from('training_groups').select('id, name, day_of_week, time_slot').in('id', groupIds)
    : { data: [] as { id: string; name: string | null; day_of_week: string | null; time_slot: string | null }[] }
  const groupName = new Map((groups ?? []).map((g) => [g.id, [g.name, g.day_of_week, g.time_slot].filter(Boolean).join(' · ')]))
  const groupTime = new Map((groups ?? []).map((g) => [g.id, (String(g.time_slot || '').match(/\b(\d{1,2}):(\d{2})/) || [])[0] || null]))
  const bookings = (recent ?? []).map((t) => ({
    id: t.id, parent_name: t.parent_name, email: t.parent_email, phone: t.parent_phone, child_name: t.child_name, child_age: t.child_age,
    date: t.preferred_date, booked_at: t.created_at, status: t.status, joined: !!t.converted, source: t.trial_source,
    class: t.training_group_id ? groupName.get(t.training_group_id) || null : null,
    time: t.training_group_id ? groupTime.get(t.training_group_id) || null : null,
  }))
  return NextResponse.json({ academy: org.name, mrr, live: live.length, failing, months, matches, bookings })
}
