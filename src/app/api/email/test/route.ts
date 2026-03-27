import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email'
import { welcomeEmail } from '@/lib/email-templates'

export async function POST() {
  const supabase = await createClient()
  const { data: role } = await supabase.rpc('get_my_role')
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) {
    return NextResponse.json({ error: 'No email found for current user' }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, organisation_id')
    .eq('id', user.id)
    .single()

  let academyName = 'Player Portal'
  if (profile?.organisation_id) {
    const { data: org } = await supabase
      .from('organisations')
      .select('name')
      .eq('id', profile.organisation_id)
      .single()
    if (org?.name) academyName = org.name
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://theplayerportal.net'
  const template = welcomeEmail({
    parentName: profile?.full_name || 'Admin',
    academyName,
    dashboardUrl: `${appUrl}/dashboard`,
  })

  const result = await sendEmail({
    to: user.email,
    subject: `[TEST] ${template.subject}`,
    html: template.html,
  })

  if (result.success && !('skipped' in result && result.skipped)) {
    return NextResponse.json({
      success: true,
      message: `Test email sent to ${user.email}`,
      id: 'id' in result ? result.id : undefined,
    })
  }

  if (result.success && 'skipped' in result && result.skipped) {
    return NextResponse.json({
      success: false,
      message: 'RESEND_API_KEY is not configured. Email was skipped.',
    })
  }

  return NextResponse.json({
    success: false,
    message: 'Failed to send test email',
    error: 'error' in result ? String(result.error) : 'Unknown error',
  })
}
