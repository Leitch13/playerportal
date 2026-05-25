import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const { email, password, fullName, orgSlug } = await request.json()

    if (!email || !password || !fullName || !orgSlug) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Use admin client to create user server-side
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Validate that the orgSlug actually exists before creating an admin user
    const { data: org } = await supabase
      .from('organisations')
      .select('id')
      .eq('slug', orgSlug)
      .single()

    if (!org) {
      return NextResponse.json({ error: 'Organisation not found' }, { status: 404 })
    }

    // Create the user via admin API
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: fullName,
        org_slug: orgSlug,
        role: 'admin',
      },
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const userId = data.user.id

    // Verify the handle_new_user trigger created the profile.
    // Admin-created users may not fire the trigger in all Supabase configurations,
    // so we manually insert the profile if it's missing.
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single()

    if (!existingProfile) {
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          email,
          full_name: fullName,
          role: 'admin',
          organisation_id: org.id,
        })

      if (profileError) {
        // Don't fail the whole flow — the user exists, profile can be fixed later
      }
    } else {
      // Profile exists from trigger but may need org_id / role updated
      await supabase
        .from('profiles')
        .update({ role: 'admin', organisation_id: org.id })
        .eq('id', userId)
    }

    // Send welcome email to new admin (fire and forget)
    try {
      const { sendEmail } = await import('@/lib/email')
      const { adminWelcomeEmail } = await import('@/lib/email-templates')
      const { data: orgData } = await supabase.from('organisations').select('name').eq('slug', orgSlug).single()
      const template = adminWelcomeEmail({
        adminName: fullName.split(' ')[0],
        academyName: orgData?.name || orgSlug,
        dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://theplayerportal.net'}/dashboard`,
      })
      await sendEmail({ to: email, ...template })
    } catch { /* email optional */ }

    return NextResponse.json({ userId })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
