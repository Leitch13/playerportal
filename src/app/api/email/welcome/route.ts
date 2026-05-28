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
  return NextResponse.json(result)
}
