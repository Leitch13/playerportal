import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'
import { welcomeEmail } from '@/lib/email-templates'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown'
  const { success } = rateLimit(`welcome-email:${ip}`, 5, 3600000) // 5 per hour
  if (!success) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  const { parentName, parentEmail, academyName, academySlug } = await request.json()

  if (!parentEmail || !parentName) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://theplayerportal.net'

  // Enrich with academy branding/contact if we can find the org (best effort)
  let academyLogoUrl: string | undefined
  let academyContactEmail: string | undefined
  if (academySlug) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (supabaseUrl && serviceKey) {
      try {
        const supabase = createClient(supabaseUrl, serviceKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        })
        const { data: org } = await supabase
          .from('organisations')
          .select('logo_url, contact_email')
          .ilike('slug', academySlug)
          .single()
        academyLogoUrl = (org?.logo_url as string | undefined) || undefined
        academyContactEmail = (org?.contact_email as string | undefined) || undefined
      } catch {
        // best effort — fall back to plain template
      }
    }
  }

  const template = welcomeEmail({
    parentName,
    academyName: academyName || 'Player Portal',
    dashboardUrl: `${appUrl}/dashboard`,
    academyLogoUrl,
    academyContactEmail,
  })

  const result = await sendEmail({
    to: parentEmail,
    ...template,
    fromName: academyName || undefined,
    replyTo: academyContactEmail,
  })

  // ── Also notify the academy so Jamie sees every signup as it happens ──
  // Sent FROM Player Portal (not the academy itself) so it doesn't get tangled
  // up with the academy's own outbound mail; lands in their contact inbox.
  if (academyContactEmail) {
    try {
      const adminAlertHtml = `
        <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;background:#0a0a0a;color:#fff;border-radius:16px;padding:24px;border:1px solid #1f1f1f">
          <div style="display:inline-block;padding:4px 10px;border-radius:999px;background:rgba(78,205,230,0.15);color:#4ecde6;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;margin-bottom:12px">New signup</div>
          <h2 style="margin:0 0 8px;font-size:22px;color:#fff">👋 ${parentName} just joined ${academyName || 'your academy'}</h2>
          <p style="color:#aaa;line-height:1.6;margin:0 0 16px;font-size:14px">
            They've created an account but <strong style="color:#fff">haven't paid yet</strong>. A friendly nudge usually closes the loop.
          </p>
          <div style="background:#141414;border-radius:12px;padding:16px;margin:16px 0">
            <table style="width:100%;font-size:14px;color:#ddd" cellpadding="4">
              <tr><td style="color:#888;width:90px">Name</td><td style="color:#fff;font-weight:600">${parentName}</td></tr>
              <tr><td style="color:#888">Email</td><td><a href="mailto:${parentEmail}" style="color:#4ecde6">${parentEmail}</a></td></tr>
            </table>
          </div>
          <div style="text-align:center;margin:20px 0 8px">
            <a href="${appUrl}/dashboard/parents" style="display:inline-block;background:#4ecde6;color:#0a0a0a;padding:12px 24px;border-radius:10px;font-weight:700;text-decoration:none;font-size:14px">Open Parents dashboard →</a>
          </div>
          <p style="color:#666;font-size:11px;text-align:center;margin:16px 0 0">Player Portal — your real-time signup feed</p>
        </div>`
      await sendEmail({
        to: academyContactEmail,
        subject: `👋 New signup — ${parentName}`,
        html: adminAlertHtml,
      })
    } catch {
      // never block the parent's welcome on the admin alert
    }
  }

  return NextResponse.json(result)
}
