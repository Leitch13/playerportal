import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, organisation_id')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Security audit 6 Nov 2026: only to a member of staff in the caller's own
  // academy, using the address on file (was: any address from the request).
  const { coachId } = await request.json()
  if (!coachId || !profile.organisation_id) {
    return NextResponse.json({ error: 'Missing coach' }, { status: 400 })
  }
  const { data: coach } = await supabase
    .from('profiles')
    .select('email, full_name, role, organisation_id')
    .eq('id', coachId)
    .maybeSingle()
  if (!coach?.email || coach.organisation_id !== profile.organisation_id || !['admin', 'coach'].includes(coach.role as string)) {
    return NextResponse.json({ error: 'Coach not found' }, { status: 404 })
  }
  const email = coach.email as string
  const name = String(coach.full_name || '').replace(/[<>&"']/g, '')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://playerportal.app'

  const result = await sendEmail({
    to: email,
    subject: 'Certification update needed',
    html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:20px">
<div style="background:#141414;padding:32px;border-radius:16px;border:1px solid #1e1e1e">
<h2 style="margin:0 0 8px;color:#ffffff;font-size:22px">Certification Reminder</h2>
<p style="color:#aaa;margin:0 0 20px">Hi ${name?.split(' ')[0] || 'Coach'},</p>
<p style="color:#aaa;line-height:1.6">Your academy admin has flagged that one or more of your certifications need updating. Please log in to review and update your certifications.</p>
<div style="text-align:center;margin:24px 0">
<a href="${appUrl}/dashboard/cpd" style="display:inline-block;background:#4ecde6;color:#0a0a0a;padding:12px 28px;border-radius:12px;font-weight:600;text-decoration:none;font-size:14px">Update Certifications</a>
</div>
</div>
</div></body></html>`,
  })

  return NextResponse.json({ success: result.success })
}
