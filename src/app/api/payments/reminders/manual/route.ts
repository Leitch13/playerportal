/**
 * Sprint — Manual Payment Reminder
 *
 * POST /api/payments/reminders/manual
 *
 * Replaces the client-side insert flow in ManualReminder.tsx. Previously the
 * component wrote rows to `payment_reminders` and `notifications` directly
 * from the browser with `email_sent: false`, which left the admin thinking an
 * email was sent when none was. This route:
 *
 *   1. Auth-gates to admin role within the same org as the payment
 *   2. Sends a branded reminder email via the proven `sendEmail` wrapper
 *      (same pipeline the daily payment-reminders cron uses — no new email
 *      infrastructure)
 *   3. Inserts the `payment_reminders` row with `email_sent` honestly
 *      reflecting whether Resend accepted the message
 *   4. Inserts the in-app `notifications` row (preserved from the old
 *      client-side behaviour)
 *
 * Body:
 *   {
 *     paymentId:     string,    // overdue/pending row to chase
 *     customMessage?: string    // optional admin-typed note shown above
 *                               // the amount breakdown
 *   }
 *
 * Response:
 *   { ok: true,  emailSent: boolean, reminderId: string }
 *   { ok: false, error: string }
 *
 * Does NOT:
 *   • Touch Stripe (Protected System #1, #2, #3) — pure DB + email
 *   • Touch /api/messages/send (different payload contract, also fine)
 *   • Create a new email template (extends the existing one additively)
 *   • Touch the daily reminder cron (unchanged)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'
import { paymentReminderEmail } from '@/lib/email-templates'

export async function POST(request: NextRequest) {
  try {
    let body: { paymentId?: string; customMessage?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ ok: false, error: 'invalid JSON body' }, { status: 400 })
    }

    const paymentId = (body.paymentId || '').trim()
    if (!paymentId) {
      return NextResponse.json({ ok: false, error: 'paymentId required' }, { status: 400 })
    }
    const customMessage = (body.customMessage || '').trim() || null

    // ─── 1. Auth gate: admin only ──────────────────────────────────────
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: me } = await supabase
      .from('profiles')
      .select('role, organisation_id, full_name')
      .eq('id', user.id)
      .single()
    if (!me || (me as { role?: string }).role !== 'admin') {
      return NextResponse.json({ ok: false, error: 'Only admins can send manual reminders' }, { status: 403 })
    }
    const adminOrgId = (me as { organisation_id?: string }).organisation_id || null

    // ─── 2. Resolve payment + parent + plan + org (service role so we get
    //         a single round-trip with all joined fields) ───────────────
    const service = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const { data: payment, error: payErr } = await service
      .from('payments')
      .select(`
        id, amount, status, organisation_id, parent_id, created_at,
        parent:profiles!payments_parent_id_fkey(id, full_name, email),
        plan:subscription_plans(name),
        organisation:organisations(name, contact_email)
      `)
      .eq('id', paymentId)
      .maybeSingle()

    if (payErr || !payment) {
      return NextResponse.json({ ok: false, error: 'Payment not found' }, { status: 404 })
    }

    // ─── 3. Cross-tenant guard: payment must be in admin's org ─────────
    if ((payment as { organisation_id?: string }).organisation_id !== adminOrgId) {
      return NextResponse.json({ ok: false, error: 'Forbidden — payment is in a different organisation' }, { status: 403 })
    }

    // Supabase joins via FK arrive as arrays even for single relations in
    // the typing layer — cast through unknown to extract the single row.
    const paymentRow = payment as unknown as {
      parent?: { id: string; full_name: string | null; email: string | null } | null
      plan?: { name: string | null } | null
      organisation?: { name: string | null; contact_email: string | null } | null
    }
    const parent = paymentRow.parent || null
    const plan = paymentRow.plan || null
    const org = paymentRow.organisation || null

    if (!parent?.email) {
      return NextResponse.json({ ok: false, error: 'Parent has no email on file' }, { status: 400 })
    }

    // ─── 4. Derive child name (best-effort) ────────────────────────────
    // The payments table has no direct player_id link. We look up the
    // parent's players in this org. Single child → use the name. Multiple
    // → "Jake and Emma" style. Zero → silently skip (template handles
    // null gracefully).
    let childName: string | null = null
    const { data: children } = await service
      .from('players')
      .select('first_name')
      .eq('parent_id', parent.id)
      .eq('organisation_id', payment.organisation_id)
      .is('archived_at', null)
      .limit(5)
    const names = (children || [])
      .map((c) => (c as { first_name?: string }).first_name)
      .filter((n): n is string => !!n && n.trim().length > 0)
    if (names.length === 1) childName = names[0]
    else if (names.length === 2) childName = `${names[0]} and ${names[1]}`
    else if (names.length > 2) childName = `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`

    // ─── 5. Compute amount string + days-overdue (used by the template's
    //         backwards-compatible cron path; manualOverride=true skips the
    //         "N days" framing but the value still feeds the urgency tone
    //         on the cron-style colour palette) ──────────────────────────
    const amountNum = Number((payment as { amount?: number | string }).amount || 0)
    const amountStr = `£${amountNum.toFixed(2)}`
    const daysOverdue = Math.max(0, Math.floor(
      (Date.now() - new Date((payment as { created_at: string }).created_at).getTime()) / 86_400_000
    ))

    // ─── 6. Render + send email via existing pipeline ──────────────────
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.theplayerportal.net'
    const template = paymentReminderEmail({
      parentName: (parent.full_name || '').split(' ')[0] || 'there',
      amount: amountStr,
      daysOverdue,
      planName: plan?.name || 'Subscription',
      dashboardUrl: `${appUrl}/dashboard/payments`,
      childName: childName || undefined,
      customMessage: customMessage || undefined,
      academyName: org?.name || undefined,
      manualOverride: true,
    })

    const sendResult = await sendEmail({
      to: parent.email,
      ...template,
      // Brand as the academy + reply-to coach, same pattern as the cron
      fromName: org?.name || undefined,
      replyTo: org?.contact_email || undefined,
    })

    const emailSent = sendResult.success === true

    // ─── 7. Insert payment_reminders row with HONEST email_sent flag ──
    const { data: reminder, error: remErr } = await service
      .from('payment_reminders')
      .insert({
        payment_id: paymentId,
        profile_id: parent.id,
        organisation_id: adminOrgId,
        reminder_type: 'custom',
        email_sent: emailSent,
      })
      .select('id')
      .single()

    if (remErr) {
      // Email may have gone out but we couldn't record it. Surface it.
      return NextResponse.json({
        ok: false,
        emailSent,
        error: `Email ${emailSent ? 'sent' : 'failed'} but reminder log failed: ${remErr.message}`,
      }, { status: 500 })
    }

    // ─── 8. In-app notification (preserved from prior client-side flow) ─
    await service.from('notifications').insert({
      user_id: parent.id,
      organisation_id: adminOrgId,
      type: 'payment_reminder',
      title: 'Payment reminder',
      body: customMessage || `${amountStr} payment is outstanding. Please update your payment.`,
      link: '/dashboard/payments',
    })

    return NextResponse.json({
      ok: true,
      emailSent,
      reminderId: (reminder as { id: string }).id,
      parentEmail: parent.email,
      ...(emailSent ? {} : { warning: 'Email send failed; reminder logged with email_sent=false' }),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
