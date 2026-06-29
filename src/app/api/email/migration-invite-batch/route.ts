import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSbClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

export const dynamic = 'force-dynamic'
// Migration Safety Phase 1 — was 60s; bumped to 300 so larger batches survive
// Resend latency. Wizard still chunks (~10 per call) so 300 is the safety net.
export const maxDuration = 300

/**
 * Sends migration invitation emails in batch. Called by the migration wizard
 * AFTER admin reviews import conflicts.
 *
 * Migration Safety Phase 1 changes:
 *   • Per-email `invite_sent_at` update — was a single UPDATE...IN at the end
 *     of the loop. If the function timed out mid-loop, NO subscriptions were
 *     marked sent and re-running re-sent every email. Now each successful
 *     send immediately stamps that subscription's invite_sent_at so a partial
 *     batch leaves a clean record of who actually got an email.
 *   • Returns per-recipient { email, sent, error? } results so the wizard can
 *     show admin exactly which sends failed.
 *   • Auth model switched from internal-secret to authenticated admin —
 *     previously this was called server-to-server from /api/migration/import
 *     fire-and-forget. The wizard now calls it directly from the browser
 *     after admin reviews the import summary.
 */
interface Invitation {
  email: string
  parentName: string
  childName: string
  token: string
  planAmount: number
  planName: string
}

interface SendResult {
  email: string
  token: string
  sent: boolean
  error?: string
}

export async function POST(request: NextRequest) {
  // Auth — admin in the org. (Was internal-secret; now wizard calls this
  // directly after reviewing conflicts.) The internal-secret header is still
  // accepted as a fallback for any legacy server-side callers.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const headerSecret = request.headers.get('x-internal-secret')
  const allowedViaSecret =
    !!headerSecret && headerSecret === (process.env.INTERNAL_API_SECRET || '')

  let callerOrgId: string | null = null
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('organisation_id, role')
      .eq('id', user.id)
      .single()
    if (profile?.role === 'admin' && profile.organisation_id) {
      callerOrgId = profile.organisation_id
    }
  }
  if (!callerOrgId && !allowedViaSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { orgId, invitations } = (await request.json()) as {
    orgId: string
    invitations: Invitation[]
  }

  if (!orgId || !Array.isArray(invitations) || invitations.length === 0) {
    return NextResponse.json({ error: 'Missing orgId or invitations' }, { status: 400 })
  }
  // Admin caller must match the orgId in the payload — prevents one academy's
  // admin from sending invitations branded as another academy.
  if (callerOrgId && callerOrgId !== orgId) {
    return NextResponse.json({ error: 'orgId mismatch' }, { status: 403 })
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

  const results: SendResult[] = []
  let sent = 0
  let failed = 0

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

      // Per-email tracking (Migration Safety Phase 1) — was: a single
      // UPDATE...IN AFTER the whole loop. If the function timed out mid-loop
      // every sub stayed un-stamped and re-running re-sent every email.
      // Now: immediately stamp this sub's invite_sent_at so a partial batch
      // never re-sends to people who already got an email.
      await admin
        .from('subscriptions')
        .update({ invite_sent_at: new Date().toISOString() })
        .eq('invite_token', inv.token)

      sent++
      results.push({ email: inv.email, token: inv.token, sent: true })
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      console.error('Invitation email failed for', inv.email, errorMsg)
      failed++
      results.push({ email: inv.email, token: inv.token, sent: false, error: errorMsg })
    }
  }

  return NextResponse.json({ ok: true, sent, failed, results })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
