import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Email notification sender (uses Supabase built-in email or can be extended with Resend/SendGrid)
// For now, creates in-app notifications. Email sending can be added when a provider is configured.

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check admin/coach role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, organisation_id')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role === 'parent') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { type, userIds, title, body, link } = await request.json()

    if (!type || !userIds || !title) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Create in-app notifications
    const notifications = (userIds as string[]).map((uid: string) => ({
      organisation_id: profile.organisation_id,
      user_id: uid,
      type,
      title,
      body: body || null,
      link: link || null,
    }))

    const { error } = await supabase.from('notifications').insert(notifications)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ sent: notifications.length })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
