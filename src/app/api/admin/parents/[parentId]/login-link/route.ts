import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { sendAuthLink } from '@/lib/auth-email-links'

export const dynamic = 'force-dynamic'

// POST /api/admin/parents/[parentId]/login-link — "Send login link": the academy emails one of its
// parents a link that signs them straight in, on any device (src/lib/auth-email-links.ts, the same
// link as the parent's own "email me a login link"). Admins only, own academy's parents only.
export async function POST(request: NextRequest, ctx: { params: Promise<{ parentId: string }> }) {
  const { parentId } = await ctx.params
  const supa = await createServerClient()
  const { data: { user } } = await supa.auth.getUser()
  if (!user) return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 })
  const { data: role } = await supa.rpc('get_my_role')
  if (role !== 'admin') return NextResponse.json({ error: 'Only academy admins can send login links.' }, { status: 403 })
  const { data: orgId } = await supa.rpc('get_my_org')
  const db = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: parent } = await db.from('profiles').select('email, organisation_id, role').eq('id', parentId).maybeSingle()
  if (!parent || parent.organisation_id !== orgId || parent.role !== 'parent') return NextResponse.json({ error: 'Parent not found.' }, { status: 404 })
  const email = String(parent.email || '').trim()
  if (!email || email.endsWith('@theplayerportal.net')) return NextResponse.json({ error: 'There is no email on file for this parent.' }, { status: 400 })
  const r = await sendAuthLink(email, 'signin', process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin)
  if (r.reason === 'too_many') return NextResponse.json({ error: 'A few links have gone in the last 15 minutes. Ask them to check junk, or try again shortly.' }, { status: 429 })
  if (r.reason === 'no_account') return NextResponse.json({ error: 'This parent has no login yet. If they have an invite waiting, press Resend invite on their child instead.' }, { status: 409 })
  if (!r.sent) return NextResponse.json({ error: `The email to ${email} didn't send. Check the address is right.` }, { status: 502 })
  await db.from('audit_log').insert({ organisation_id: orgId, user_id: user.id, action: 'parent.login_link_sent', entity_type: 'parent', entity_id: parentId, details: {} }).then(() => {}, () => {})
  return NextResponse.json({ ok: true, to: email })
}
