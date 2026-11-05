import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authLinkUrl } from '@/lib/auth-email-links'

export const dynamic = 'force-dynamic'

// POST /api/invite/open-account { token } — straight into the account after confirming an invite.
//
// John, 5 Nov 2026 (No.1, Cammy): parents sent their invite by WhatsApp set up the payment and then
// couldn't get into their account. The success page only emailed a login link, and WhatsApp is how
// the academy reaches families whose email doesn't work: 21 of 71 No.1 families who confirmed had
// never signed in. Now the success page opens a one-time "choose your password" link right there.
//
// Only for the parent on that invite, only within a day of confirming, only if they have never
// signed in, and only once. Otherwise they sign in or use "Forgot password?" as normal.
const WINDOW_MS = 24 * 3600 * 1000
const USED = 'invite.open_account'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const token = String(body?.token || '')
  if (!/^[A-Za-z0-9_-]{16,}$/.test(token)) return NextResponse.json({ error: 'That link is not valid.' }, { status: 400 })
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: sub } = await db.from('subscriptions').select('id, parent_id, organisation_id, invite_confirmed_at').eq('invite_token', token).maybeSingle()
  if (!sub?.parent_id) return NextResponse.json({ error: 'That link is not valid.' }, { status: 404 })
  // The payment webhook may not have landed yet: the page asks again in a few seconds.
  if (!sub.invite_confirmed_at) return NextResponse.json({ state: 'not_yet' }, { status: 202 })
  if (Date.now() - Date.parse(sub.invite_confirmed_at as string) > WINDOW_MS) return NextResponse.json({ state: 'sign_in' })
  const { data: u } = await db.auth.admin.getUserById(sub.parent_id as string)
  const email = u?.user?.email
  if (!email || u?.user?.last_sign_in_at) return NextResponse.json({ state: 'sign_in' })
  const { count } = await db.from('audit_log').select('id', { count: 'exact', head: true }).eq('action', USED).eq('entity_id', sub.id)
  if ((count ?? 0) > 0) return NextResponse.json({ state: 'sign_in' })
  const { data, error } = await db.auth.admin.generateLink({ type: 'recovery', email })
  const hashed = data?.properties?.hashed_token
  if (error || !hashed) return NextResponse.json({ error: 'Could not open your account. Use the link we emailed you, or Forgot password.' }, { status: 500 })
  await db.from('audit_log').insert({ organisation_id: sub.organisation_id, user_id: sub.parent_id, action: USED, entity_type: 'subscription', entity_id: sub.id, details: {} }).then(() => {}, () => {})
  return NextResponse.json({ state: 'open', url: authLinkUrl(process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin, hashed, 'reset') })
}
