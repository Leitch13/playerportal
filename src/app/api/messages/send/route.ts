import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'
import { messageNotificationEmail } from '@/lib/email-templates'

/**
 * Day 1 — Unified message-send endpoint.
 *
 * Purpose: Make in-app messaging trustworthy. Until today, every send
 * surface (NewMessage, BulkMessageForm, SendMessageForm, ParentReplyForm)
 * called `supabase.from('messages').insert(...)` directly from the
 * client. The row was created; **no email was ever sent.** Parents only
 * saw messages if they happened to log into the dashboard.
 *
 * This endpoint:
 *   1. Authenticates the sender (admin/coach within their own org)
 *   2. Resolves recipient profile → name + email (defence-in-depth org match)
 *   3. Inserts the message row (the existing legacy schema — same columns
 *      every existing reader expects)
 *   4. Sends a notification email via the existing Resend infrastructure
 *   5. Stores delivery_status / delivery_attempted_at /
 *      delivery_completed_at / delivery_failure_reason on the row
 *
 * GRACEFUL DEGRADATION: if migration 074 has not yet been applied, the
 * delivery columns don't exist. The UPDATE step that records delivery
 * status will fail silently (logged, not raised) — the message still
 * gets inserted and emailed. Once 074 lands, delivery state begins
 * persisting.
 *
 * Body:
 *   {
 *     recipientIds: string[]   — one or many; cohort fan-out supported
 *     subject?: string
 *     body: string
 *     threadId?: string        — for replies; auto-generated otherwise
 *   }
 *
 * Returns:
 *   {
 *     ok: true,
 *     sent: number,            — successful inserts
 *     emailed: number,         — successful email sends
 *     failed: number,          — neither inserted nor emailed
 *     messageIds: string[],
 *   }
 *
 * READ-ONLY surfaces it does NOT touch:
 *   • Stripe, webhooks, cron, billing, subscriptions
 *   • Trial / contact / attendance / at-risk / dashboard derive layers
 *   • Schema beyond the additive migration 074
 */
export async function POST(req: NextRequest) {
  let body: { recipientIds?: string[]; subject?: string | null; body?: string; threadId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid JSON body' }, { status: 400 })
  }

  const recipientIds = (body.recipientIds || []).filter(Boolean)
  const messageBody = (body.body || '').trim()
  const subject = body.subject?.trim() || null
  const threadId = body.threadId || crypto.randomUUID()

  if (recipientIds.length === 0) return NextResponse.json({ ok: false, error: 'recipientIds required' }, { status: 400 })
  if (!messageBody) return NextResponse.json({ ok: false, error: 'body required' }, { status: 400 })
  if (recipientIds.length > 200) return NextResponse.json({ ok: false, error: 'recipient cap (200) exceeded' }, { status: 400 })

  // ─── 1. Auth + sender profile ───────────────────────────────────────
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const { data: senderProfile } = await supabase
    .from('profiles')
    .select('id, full_name, role, organisation_id')
    .eq('id', user.id)
    .single()
  if (!senderProfile) return NextResponse.json({ ok: false, error: 'sender profile not found' }, { status: 404 })
  // Sender must be admin or coach to use this endpoint (parents reply via
  // a different surface that will be wired in a later phase if needed).
  if (!['admin', 'coach'].includes(senderProfile.role)) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
  }
  const orgId = senderProfile.organisation_id as string

  // ─── 2. Resolve recipients (defence-in-depth org match) ─────────────
  const { data: recipientProfiles } = await supabase
    .from('profiles')
    .select('id, full_name, email, organisation_id')
    .in('id', recipientIds)
    .eq('organisation_id', orgId)
  const recipientMap = new Map<string, { id: string; full_name: string | null; email: string | null }>()
  for (const p of (recipientProfiles || [])) {
    recipientMap.set(p.id as string, { id: p.id as string, full_name: (p as { full_name?: string }).full_name ?? null, email: (p as { email?: string }).email ?? null })
  }
  const validRecipientIds = recipientIds.filter(id => recipientMap.has(id))
  if (validRecipientIds.length === 0) {
    return NextResponse.json({ ok: false, error: 'no valid recipients in this org' }, { status: 400 })
  }

  // ─── 3. Org name for the email branding ─────────────────────────────
  let academyName = 'Player Portal'
  let accentColor = '#4ecde6'
  try {
    const { data: org } = await supabase.from('organisations').select('name, primary_color').eq('id', orgId).maybeSingle()
    if (org) {
      academyName = (org as { name?: string }).name || academyName
      accentColor = (org as { primary_color?: string }).primary_color || accentColor
    }
  } catch { /* fall through */ }

  // ─── 4. Insert + email per recipient ────────────────────────────────
  // Service-role client for the writes (RLS-bypassing — we already
  // verified org membership above).
  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://theplayerportal.net'}/dashboard/messages`

  let sentCount = 0
  let emailedCount = 0
  let failedCount = 0
  const messageIds: string[] = []

  // Run sequentially per recipient — keeps error handling simple and per-row
  // delivery tracking precise. At a cohort cap of 200 this is < 30s.
  for (const rid of validRecipientIds) {
    const recipient = recipientMap.get(rid)!
    const startedAtIso = new Date().toISOString()

    // Step A — insert the row using the legacy schema's required columns
    // ONLY (organisation_id, sender_id, recipient_id, subject, body,
    // thread_id). The new delivery columns are populated by the
    // best-effort UPDATE below so the insert path works even if
    // migration 074 has not been applied yet.
    const insertResult = await service
      .from('messages')
      .insert({
        organisation_id: orgId,
        sender_id: user.id,
        recipient_id: rid,
        subject,
        body: messageBody,
        thread_id: threadId,
      })
      .select('id')
      .single()

    if (insertResult.error || !insertResult.data) {
      failedCount++
      continue
    }
    sentCount++
    const messageId = (insertResult.data as { id: string }).id
    messageIds.push(messageId)

    // Step B — attempt to send the notification email.
    let deliveryStatus: 'sent' | 'failed' | 'skipped' = 'skipped'
    let deliveryFailureReason: string | null = null

    if (!recipient.email) {
      deliveryStatus = 'skipped'
      deliveryFailureReason = 'recipient has no email on file'
    } else {
      const tpl = messageNotificationEmail({
        senderName: senderProfile.full_name || 'Your academy',
        recipientName: recipient.full_name || 'there',
        subject,
        body: messageBody,
        academyName,
        dashboardUrl,
        accentColor,
      })
      try {
        const res = await sendEmail({
          to: recipient.email,
          subject: tpl.subject,
          html: tpl.html,
          fromName: academyName,
        })
        // sendEmail returns { data, error } shape per src/lib/email.ts
        if (res && (res as { error?: { message?: string } }).error) {
          deliveryStatus = 'failed'
          deliveryFailureReason = ((res as { error?: { message?: string } }).error?.message || 'send failed').slice(0, 300)
        } else {
          deliveryStatus = 'sent'
          emailedCount++
        }
      } catch (e) {
        deliveryStatus = 'failed'
        deliveryFailureReason = (e instanceof Error ? e.message : String(e)).slice(0, 300)
      }
    }

    // Step C — best-effort delivery-status persist. If migration 074
    // hasn't been applied yet, the columns don't exist and this UPDATE
    // will return a 42703 error which we swallow. The message itself
    // (Step A) is unaffected — Day 1 trust is preserved.
    try {
      await service
        .from('messages')
        .update({
          channel: 'email',
          delivery_status: deliveryStatus,
          delivery_attempted_at: startedAtIso,
          delivery_completed_at: new Date().toISOString(),
          delivery_failure_reason: deliveryFailureReason,
          recipient_email_snapshot: recipient.email,
        })
        .eq('id', messageId)
    } catch {
      // Migration not yet applied — keep going.
    }
  }

  return NextResponse.json({
    ok: true,
    sent: sentCount,
    emailed: emailedCount,
    failed: failedCount,
    skipped: sentCount - emailedCount,
    messageIds,
  })
}
