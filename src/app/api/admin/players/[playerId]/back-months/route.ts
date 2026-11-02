import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { sendBackMonthsBill } from '@/lib/never-confirmed'

export const dynamic = 'force-dynamic'

// POST /api/admin/players/[playerId]/back-months — a child coming on an invite never confirmed:
// email the parent a bill for the months owed plus their invite link (src/lib/never-confirmed.ts).
// Admins only, own academy only. Charges nothing.
export async function POST(request: NextRequest, ctx: { params: Promise<{ playerId: string }> }) {
  const { playerId } = await ctx.params
  const supa = await createServerClient()
  const { data: { user } } = await supa.auth.getUser()
  if (!user) return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 })
  const { data: role } = await supa.rpc('get_my_role')
  if (role !== 'admin') return NextResponse.json({ error: 'Only academy admins can send bills.' }, { status: 403 })
  const { data: orgId } = await supa.rpc('get_my_org')
  if (!orgId) return NextResponse.json({ error: 'Your account is not linked to an academy.' }, { status: 400 })
  const db = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: player } = await db.from('players').select('organisation_id').eq('id', playerId).maybeSingle()
  if (!player || player.organisation_id !== orgId) return NextResponse.json({ error: 'Player not found.' }, { status: 404 })
  const r = await sendBackMonthsBill(db, orgId as string, playerId, process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin)
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
  await db.from('audit_log').insert({ organisation_id: orgId, user_id: user.id, action: 'membership.back_months_sent', entity_type: 'player', entity_id: playerId, details: { amount: r.amount, months: r.label } }).then(() => {}, () => {})
  return NextResponse.json({ ok: true, amount: r.amount, label: r.label })
}
