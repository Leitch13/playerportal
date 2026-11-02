import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { emailMembershipPayLink } from '@/lib/membership-pay-link'

export const dynamic = 'force-dynamic'

// POST /api/admin/players/[playerId]/membership-pay-link — "Send payment link" for a child whose
// membership card didn't go through. Emails the parent /pay/membership/<id> (src/lib/membership-pay-link.ts).
// Admins only; the child must belong to their academy. Charges nothing.
export async function POST(_request: NextRequest, ctx: { params: Promise<{ playerId: string }> }) {
  const { playerId } = await ctx.params
  const supa = await createServerClient()
  const { data: { user } } = await supa.auth.getUser()
  if (!user) return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 })
  const { data: role } = await supa.rpc('get_my_role')
  if (role !== 'admin') return NextResponse.json({ error: 'Only academy admins can send payment links.' }, { status: 403 })
  const { data: orgId } = await supa.rpc('get_my_org')
  if (!orgId) return NextResponse.json({ error: 'Your account is not linked to an academy.' }, { status: 400 })

  const db = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: subs } = await db.from('subscriptions').select('id').eq('player_id', playerId).eq('organisation_id', orgId)
    .in('status', ['past_due', 'unpaid']).not('stripe_subscription_id', 'is', null).order('created_at', { ascending: false })
  if (!subs?.length) return NextResponse.json({ error: 'Nothing has failed on this child’s membership.' }, { status: 404 })

  let last: { error: string; status: number } | null = null
  const sent: string[] = []
  for (const s of subs) {
    const r = await emailMembershipPayLink(db, s.id as string)
    if (!r.ok) { last = r; continue }
    if (!r.emailed) return NextResponse.json({ error: `The email to ${r.to} didn't send. Check the address is right, then try again.`, url: r.url }, { status: 502 })
    sent.push(r.url)
  }
  if (!sent.length) return NextResponse.json({ error: last?.error || 'Could not send the link.' }, { status: last?.status || 400 })
  await db.from('audit_log').insert({ organisation_id: orgId, user_id: user.id, action: 'membership.pay_link_sent', entity_type: 'player', entity_id: playerId, details: { urls: sent } }).then(() => {}, () => {})
  return NextResponse.json({ ok: true, url: sent[0] })
}
