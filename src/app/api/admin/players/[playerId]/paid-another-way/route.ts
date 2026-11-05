import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { markPaidAnotherWay, previewPaidAnotherWay } from '@/lib/never-confirmed'

export const dynamic = 'force-dynamic'

// /api/admin/players/[playerId]/paid-another-way — a child on an invite never confirmed whose parent
// paid the academy by bank transfer or cash (src/lib/never-confirmed.ts markPaidAnotherWay).
// GET: what would be recorded. POST { how: 'bank' | 'cash' }: record it. Admins only, own academy only.
// Charges and emails nothing.
async function guard(playerId: string) {
  const supa = await createServerClient()
  const { data: { user } } = await supa.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'You must be signed in.' }, { status: 401 }) }
  const { data: role } = await supa.rpc('get_my_role')
  if (role !== 'admin') return { error: NextResponse.json({ error: 'Only academy admins can mark payments.' }, { status: 403 }) }
  const { data: orgId } = await supa.rpc('get_my_org')
  if (!orgId) return { error: NextResponse.json({ error: 'Your account is not linked to an academy.' }, { status: 400 }) }
  const db = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: player } = await db.from('players').select('organisation_id').eq('id', playerId).maybeSingle()
  if (!player || player.organisation_id !== orgId) return { error: NextResponse.json({ error: 'Player not found.' }, { status: 404 }) }
  return { db, orgId: orgId as string, userId: user.id }
}

export async function GET(_request: NextRequest, ctx: { params: Promise<{ playerId: string }> }) {
  const { playerId } = await ctx.params
  const g = await guard(playerId)
  if ('error' in g) return g.error
  const p = await previewPaidAnotherWay(g.db, g.orgId, playerId)
  if (!p.ok) return NextResponse.json({ error: p.error }, { status: p.status })
  return NextResponse.json({ amount: p.amount, label: p.label })
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ playerId: string }> }) {
  const { playerId } = await ctx.params
  const g = await guard(playerId)
  if ('error' in g) return g.error
  const body = await request.json().catch(() => ({}))
  const how = body?.how === 'cash' ? 'cash' : body?.how === 'bank' ? 'bank' : null
  if (!how) return NextResponse.json({ error: 'Say whether they paid by bank transfer or cash.' }, { status: 400 })
  const r = await markPaidAnotherWay(g.db, g.orgId, playerId, how)
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
  await g.db.from('audit_log').insert({ organisation_id: g.orgId, user_id: g.userId, action: 'membership.paid_another_way', entity_type: 'player', entity_id: playerId, details: { amount: r.amount, months: r.label, how, card_from: r.billingFrom } }).then(() => {}, () => {})
  return NextResponse.json({ ok: true, amount: r.amount, label: r.label })
}
