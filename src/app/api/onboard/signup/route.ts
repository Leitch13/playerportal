import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimit } from '@/lib/rate-limit'
import { checkLeadEmail } from '@/lib/lead-email-checks'
import { orgIsClaimableByFirstAdmin } from '@/lib/onboard-claim'

export async function POST(request: NextRequest) {
  try {
    // Rate limit — this endpoint is unauthenticated by necessity (pre-account).
    // Mirror the sibling /api/onboard limiter so it can't be hammered to probe
    // slugs or brute-create accounts.
    const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown'
    const { success } = rateLimit(`onboard-signup:${ip}`, 5, 3600000)
    if (!success) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
    }

    const { email, password, fullName, orgSlug } = await request.json()

    const emailProblem = await checkLeadEmail(String(email || ''), 'your account')
    if (emailProblem) {
      return NextResponse.json({ error: emailProblem }, { status: 400 })
    }

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

    // ── SECURITY: onboarding may only create the FIRST admin of an academy ──
    // Slugs are public, so without this an anonymous caller could POST an
    // existing academy's slug and be written in as its admin (tenant takeover
    // exposing children's data). A genuinely new academy (created moments ago
    // by /api/onboard) has zero admins and passes; an already-claimed academy
    // is rejected. Additional staff use the authenticated /api/staff/create.
    const { count: adminCount } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('organisation_id', org.id)
      .eq('role', 'admin')
    if (!orgIsClaimableByFirstAdmin(adminCount ?? 0)) {
      return NextResponse.json(
        { error: 'This academy already has an owner. Ask them to add you from Settings → Staff.' },
        { status: 409 }
      )
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
        academySlug: orgSlug,
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
