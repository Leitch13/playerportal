import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'unknown'
    const { success } = rateLimit(`onboard:${ip}`, 20, 3600000)
    if (!success) {
      return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
    }

    // Use service role client — no user auth during onboarding
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const {
      name,
      slug,
      description,
      contactEmail,
      contactPhone,
      location,
      primaryColor,
      logoUrl,
      heroImageUrl,
      plans,
      platformPlan,
      termsAccepted,
      dpaAccepted,
      authorityConfirmed,
    } = await request.json()

    if (!name || !slug || !contactEmail) {
      return NextResponse.json(
        { error: 'Name, slug, and contact email are required' },
        { status: 400 }
      )
    }

    if (termsAccepted !== true || dpaAccepted !== true || authorityConfirmed !== true) {
      return NextResponse.json(
        { error: 'You must accept the Terms of Service, the Data Processing Agreement, and confirm your authority to bind the academy.' },
        { status: 400 }
      )
    }

    // x-forwarded-for can be a comma-separated list; the first entry is the client.
    const acceptedIp =
      (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      'unknown'
    const acceptedUserAgent = request.headers.get('user-agent') || 'unknown'
    const acceptedAt = new Date().toISOString()
    const TERMS_VERSION = 'v1.0.0'

    // Check if slug is already taken
    const { data: existing } = await supabase
      .from('organisations')
      .select('id')
      .eq('slug', slug)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'This slug is already taken. Please choose a different one.' },
        { status: 409 }
      )
    }

    // Look up the platform plan by slug (default to 'pro' if not provided)
    let platformPlanId: string | null = null
    const planSlug = platformPlan || 'pro'
    const { data: planRow } = await supabase
      .from('platform_plans')
      .select('id')
      .eq('slug', planSlug)
      .single()

    if (planRow) {
      platformPlanId = planRow.id
    }

    // Calculate trial end date: 14 days from now
    const trialEndsAt = new Date()
    trialEndsAt.setDate(trialEndsAt.getDate() + 14)

    // Create the organisation
    const { data: org, error: orgError } = await supabase
      .from('organisations')
      .insert({
        name,
        slug,
        description: description || null,
        contact_email: contactEmail,
        contact_phone: contactPhone || null,
        location: location || null,
        primary_color: primaryColor || '#4ecde6',
        logo_url: logoUrl || null,
        hero_image_url: heroImageUrl || null,
        platform_plan_id: platformPlanId,
        platform_subscription_status: 'trial',
        platform_trial_ends_at: trialEndsAt.toISOString(),
        // Academies are live (public-bookable) during their 14-day platform
        // trial. The webhook still flips this to true on platform-plan
        // payment, but new trial academies no longer have to pay to publish.
        // Existing webhook behaviour on cancellation (keep is_published=true
        // — webhooks/route.ts:1982 comment) is unchanged.
        is_published: true,
        terms_accepted_at: acceptedAt,
        dpa_accepted_at: acceptedAt,
        terms_version: TERMS_VERSION,
        accepted_ip: acceptedIp,
        accepted_user_agent: acceptedUserAgent,
      })
      .select('id')
      .single()

    if (orgError) {
      return NextResponse.json(
        { error: orgError.message },
        { status: 500 }
      )
    }

    // Create subscription plans — use custom plans if provided, otherwise defaults
    const customPlans = Array.isArray(plans) && plans.length > 0 ? plans : [
      { name: '1 Session / Week', amount: 30, sessions_per_week: 1 },
      { name: '2 Sessions / Week', amount: 50, sessions_per_week: 2 },
      { name: 'Unlimited', amount: 70, sessions_per_week: 7 },
    ]

    await supabase.from('subscription_plans').insert(
      customPlans.map((plan: { name: string; amount: number; sessions_per_week: number }, i: number) => ({
        name: plan.name,
        amount: plan.amount,
        sessions_per_week: plan.sessions_per_week,
        sort_order: i + 1,
        organisation_id: org.id,
        active: true,
      }))
    )

    // Fire-and-forget admin notification — never block onboarding on it
    notifyNewAcademy({
      academyName: name,
      slug,
      contactEmail,
      contactPhone: contactPhone || null,
      location: location || null,
      platformPlan: platformPlan || 'starter',
    }).catch((err) => console.error('Admin notification failed:', err))

    return NextResponse.json({ orgId: org.id })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function notifyNewAcademy(info: {
  academyName: string
  slug: string
  contactEmail: string
  contactPhone: string | null
  location: string | null
  platformPlan: string
}) {
  const apiKey = process.env.RESEND_API_KEY
  const to = process.env.ADMIN_NOTIFICATION_EMAIL
  const from = process.env.RESEND_FROM_EMAIL || 'onboarding@theplayerportal.net'

  if (!apiKey) {
    console.warn('RESEND_API_KEY not set — skipping admin notification')
    return
  }
  if (!to) {
    // No ADMIN_NOTIFICATION_EMAIL configured. We intentionally don't fall
    // back to a hard-coded address — that's how a personal inbox ends up
    // receiving prod traffic when the env var goes missing during a deploy.
    console.warn('ADMIN_NOTIFICATION_EMAIL not set — skipping new-academy notification')
    return
  }

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:#f4f4f5;margin:0;padding:0;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;">
    <div style="padding:24px 32px;background:#4ecde6;color:#0a0a0a;">
      <h1 style="margin:0;font-size:20px;font-weight:800;">🎉 New academy signed up</h1>
    </div>
    <div style="padding:28px 32px;color:#1a1a1a;line-height:1.6;">
      <h2 style="margin:0 0 12px;font-size:18px;color:#111;">${escapeHtml(info.academyName)}</h2>
      <table style="width:100%;font-size:14px;color:#444;border-collapse:collapse;margin-top:8px;">
        <tr><td style="padding:6px 0;color:#888;width:140px;">Slug</td><td><code>${escapeHtml(info.slug)}</code></td></tr>
        <tr><td style="padding:6px 0;color:#888;">Plan</td><td>${escapeHtml(info.platformPlan)}</td></tr>
        <tr><td style="padding:6px 0;color:#888;">Email</td><td><a href="mailto:${escapeHtml(info.contactEmail)}" style="color:#0066cc;">${escapeHtml(info.contactEmail)}</a></td></tr>
        ${info.contactPhone ? `<tr><td style="padding:6px 0;color:#888;">Phone</td><td>${escapeHtml(info.contactPhone)}</td></tr>` : ''}
        ${info.location ? `<tr><td style="padding:6px 0;color:#888;">Location</td><td>${escapeHtml(info.location)}</td></tr>` : ''}
      </table>
      <p style="margin:24px 0 16px;font-size:14px;">
        <a href="https://www.theplayerportal.net/book/${encodeURIComponent(info.slug)}" style="color:#0066cc;">View their booking page →</a>
      </p>
      <p style="margin:16px 0;font-size:14px;">
        <a href="https://www.theplayerportal.net/platform" style="color:#0066cc;">Manage in Platform Admin →</a>
      </p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
      <p style="font-size:12px;color:#888;line-height:1.5;">
        💡 <strong>Next steps to help them succeed:</strong><br>
        1. Reach out within 1 hour — massive conversion booster<br>
        2. Check they completed Stripe Connect onboarding<br>
        3. Offer a 15-min walkthrough call<br>
        4. If pilot, set <code>pilot = true</code> on their org row
      </p>
    </div>
    <div style="padding:16px 32px;background:#f8f8f8;color:#888;font-size:11px;text-align:center;border-top:1px solid #eee;">
      Player Portal · JSL Sports Technology Ltd
    </div>
  </div>
</body>
</html>`

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `Player Portal <${from}>`,
      to,
      subject: `🎉 New academy: ${info.academyName}`,
      html,
    }),
  })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
