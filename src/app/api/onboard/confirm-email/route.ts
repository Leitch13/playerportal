import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { confirmAcademyEmail, emailCheckPending, sendEmailCheck, userFromEmailCheckToken } from '@/lib/academy-email-check'

// A new academy owner confirming their email (src/lib/academy-email-check.ts).
//   { token }        → the button on /onboard/confirm-email: confirms, opens the dashboard.
//   { resend: true } → signed-in owner still waiting: emails the link again.
export async function POST(request: NextRequest) {
  const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown'
  if (!rateLimit(`academy-email:${ip}`, 10, 3600000).success) {
    return NextResponse.json({ error: 'Too many tries. Please wait a few minutes.' }, { status: 429 })
  }
  const body = await request.json().catch(() => ({}))
  const db = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })

  if (body.resend) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })
    if (!emailCheckPending(user)) return NextResponse.json({ ok: true, already: true })
    const { data: profile } = await db.from('profiles').select('full_name, organisation_id').eq('id', user.id).maybeSingle()
    const { data: org } = profile?.organisation_id ? await db.from('organisations').select('name').eq('id', profile.organisation_id).maybeSingle() : { data: null }
    const mail = await sendEmailCheck(user.email || '', String(profile?.full_name || '').split(' ')[0], (org?.name as string) || 'your academy', user.id)
    if (!mail.success) return NextResponse.json({ error: `The email to ${user.email} didn't send. If that address is wrong, email support@theplayerportal.net.` }, { status: 502 })
    return NextResponse.json({ ok: true, to: user.email })
  }

  const userId = userFromEmailCheckToken(String(body.token || ''))
  if (!userId) return NextResponse.json({ error: 'This link is not valid. Sign in and press "Send it again".' }, { status: 400 })
  const done = await confirmAcademyEmail(db, userId)
  if (!done.ok) return NextResponse.json({ error: done.error }, { status: 400 })
  return NextResponse.json({ ok: true, already: done.already })
}
