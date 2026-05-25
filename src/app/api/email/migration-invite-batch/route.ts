import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSbClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Sends migration invitation emails in bulk. Called by /api/migration/import
 * after creating pending subscriptions. Internal-only (shared secret check).
 */
interface Invitation {
  email: string
  parentName: string
  childName: string
  token: string
  planAmount: number
  planName: string
}

export async function POST(request: NextRequest) {
  // Internal auth — the calling API uses this header
  const secret = request.headers.get('x-internal-secret')
  if (!secret || secret !== (process.env.INTERNAL_API_SECRET || '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { orgId, invitations } = (await request.json()) as {
    orgId: string
    invitations: Invitation[]
  }

  if (!orgId || !Array.isArray(invitations) || invitations.length === 0) {
    return NextResponse.json({ error: 'Missing orgId or invitations' }, { status: 400 })
  }

  const admin = createSbClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Load org details for email branding
  const { data: org } = await admin
    .from('organisations')
    .select('name, slug, primary_color, logo_url, contact_email')
    .eq('id', orgId)
    .single()

  if (!org) {
    return NextResponse.json({ error: 'Organisation not found' }, { status: 404 })
  }

  const academyName = org.name as string
  const primary = (org.primary_color as string) || '#4ecde6'
  const origin = 'https://theplayerportal.net'

  const resendKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@theplayerportal.net'
  if (!resendKey) {
    return NextResponse.json({ error: 'Email service not configured' }, { status: 500 })
  }
  const resend = new Resend(resendKey)

  let sent = 0
  let failed = 0
  const sentTokens: string[] = []

  for (const inv of invitations) {
    try {
      const confirmUrl = `${origin}/confirm-subscription/${inv.token}`
      const priceText = inv.planAmount > 0 ? `£${inv.planAmount.toFixed(2)}/month` : 'your subscription'

      const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;">
    <div style="padding:24px 32px;background:${primary};color:#0a0a0a;">
      <h1 style="margin:0;font-size:20px;font-weight:800;">${academyName}</h1>
    </div>
    <div style="padding:32px;color:#1a1a1a;line-height:1.6;">
      <h2 style="font-size:22px;margin:0 0 16px;font-weight:700;color:#111;">Hi ${escapeHtml(inv.parentName)},</h2>
      <p style="font-size:15px;color:#444;margin:0 0 16px;">
        Great news — <strong>${academyName}</strong> has just upgraded to <strong>Player Portal</strong>, a new platform that makes managing ${escapeHtml(inv.childName)}'s training easier for everyone.
      </p>
      <p style="font-size:15px;color:#444;margin:0 0 20px;">
        We've already set up ${escapeHtml(inv.childName)}'s subscription — <strong>${escapeHtml(inv.planName)} at ${priceText}</strong>. To keep their place in the class, please confirm your payment details by clicking below. Takes 30 seconds.
      </p>
      <p style="text-align:center;margin:28px 0;">
        <a href="${confirmUrl}" style="background:${primary};color:#0a0a0a;padding:14px 32px;text-decoration:none;border-radius:999px;font-weight:700;display:inline-block;font-size:15px;">Confirm ${escapeHtml(inv.childName.split(' ')[0])}'s subscription</a>
      </p>
      <p style="font-size:13px;color:#666;margin:24px 0 0;line-height:1.6;">
        What stays the same:
      </p>
      <ul style="font-size:13px;color:#666;padding-left:20px;margin:6px 0 20px;">
        <li>Same classes, same times, same coaches</li>
        <li>Same monthly price — no hidden fees</li>
        <li>Cancel anytime from your new dashboard</li>
      </ul>
      <p style="font-size:13px;color:#666;margin:16px 0 0;">
        What's new: a proper parent portal where you can track ${escapeHtml(inv.childName.split(' ')[0])}'s progress, message coaches directly, view photos from sessions, and manage everything in one place.
      </p>
      <p style="font-size:13px;color:#888;margin:24px 0 0;line-height:1.6;">
        If you have any questions, just reply to this email and the ${academyName} team will get back to you.
      </p>
    </div>
    <div style="padding:16px 32px;background:#f8f8f8;color:#888;font-size:12px;text-align:center;border-top:1px solid #eee;">
      <p style="margin:0;">${academyName} · Powered by Player Portal</p>
      <p style="margin:4px 0 0;font-size:11px;color:#aaa;">If you didn't expect this email, you can safely ignore it.</p>
    </div>
  </div>
</body>
</html>`

      await resend.emails.send({
        from: `${academyName} <${fromEmail}>`,
        to: inv.email,
        subject: `${academyName}: Confirm ${inv.childName.split(' ')[0]}'s subscription (takes 30 seconds)`,
        html,
      })

      sent++
      sentTokens.push(inv.token)
    } catch (err) {
      console.error('Invitation email failed for', inv.email, err)
      failed++
    }
  }

  // Mark subscriptions as invited
  if (sentTokens.length > 0) {
    await admin
      .from('subscriptions')
      .update({ invite_sent_at: new Date().toISOString() })
      .in('invite_token', sentTokens)
  }

  return NextResponse.json({ ok: true, sent, failed })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
