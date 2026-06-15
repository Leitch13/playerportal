/**
 * Camps Phase 2B — POST /api/admin/camps/[campId]/payment-request
 *
 * Admin-only: after a camp is extended, OPTIONALLY email the affected families
 * an academy-branded note asking them to pay for the added day(s) DIRECTLY to
 * the academy (bank transfer / cash) — NOT through Player Portal.
 *
 * This is NOT a billing system. It performs ZERO Stripe calls and ZERO database
 * writes — it only reads camp_bookings (to resolve recipients) and sends email
 * via the same sendEmail helper the camp-confirmation flow uses. payment_status
 * / amount_paid / payments are never touched.
 *
 * Mirrors the Sprint-10 resend-confirmation route (auth + service-client + send).
 * Modes: 'test' (send only to the requesting admin) · 'send' (all affected
 * families). Gated by CAMP_MANUAL_PAYMENT_REQUEST_ENABLED.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import {
  CAMP_MANUAL_PAYMENT_REQUEST_ENABLED,
  amountError,
  instructionsError,
  formatRequestAmount,
  resolveRecipients,
  type CampBookingLite,
} from '@/lib/camp-payment-request'

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function fmtRange(startIso: string | null, endIso: string | null): string {
  const fmt = (iso: string | null) =>
    iso
      ? new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', {
          weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
        })
      : ''
  const s = fmt(startIso)
  const e = fmt(endIso) || s
  return s === e ? s : `${s} → ${e}`
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ campId: string }> },
) {
  // Flag gate — inert when off.
  if (!CAMP_MANUAL_PAYMENT_REQUEST_ENABLED) {
    return NextResponse.json({ error: 'Not enabled' }, { status: 404 })
  }

  const { campId } = await ctx.params
  if (!campId) return NextResponse.json({ error: 'Missing camp id' }, { status: 400 })

  // ── Auth: admin/coach only, scoped to own org ──
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, organisation_id')
    .eq('id', user.id)
    .single()
  if (!profile || !['admin', 'coach'].includes(profile.role as string)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const orgId = profile.organisation_id as string

  // ── Body ──
  let body: { amount?: string | number; instructions?: string; originalStartDate?: string; originalEndDate?: string; newStartDate?: string; newEndDate?: string; mode?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }
  const mode = body.mode === 'test' ? 'test' : 'send'
  const amtErr = amountError(body.amount ?? '')
  if (amtErr) return NextResponse.json({ error: amtErr }, { status: 400 })
  const insErr = instructionsError(body.instructions ?? '')
  if (insErr) return NextResponse.json({ error: insErr }, { status: 400 })
  const amountLabel = formatRequestAmount(body.amount as string | number)
  const instructions = String(body.instructions)

  const svc = getServiceClient()

  // ── Camp (current dates = the extended/new dates) + org contact ──
  const { data: camp } = await svc
    .from('camps')
    .select('name, start_date, end_date, organisation_id')
    .eq('id', campId)
    .maybeSingle()
  if (!camp) return NextResponse.json({ error: 'Camp not found' }, { status: 404 })
  if ((camp as { organisation_id?: string }).organisation_id !== orgId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const campName = (camp as { name?: string }).name || 'Camp'
  // New (extended) dates come from the client (the form knows them even before
  // the save commits, so a test-send is accurate); fall back to the camp's
  // current DB dates. These are display-only — no money/security dependency.
  const newDates = fmtRange(
    body.newStartDate || (camp as { start_date?: string | null }).start_date || null,
    body.newEndDate || (camp as { end_date?: string | null }).end_date || null,
  )
  const oldDates = fmtRange(body.originalStartDate || null, body.originalEndDate || null) || newDates

  const { data: orgRow } = await svc
    .from('organisations')
    .select('name, contact_email, contact_phone')
    .eq('id', orgId)
    .maybeSingle()
  const academyName = (orgRow as { name?: string | null } | null)?.name || 'Your academy'
  const academyEmail = (orgRow as { contact_email?: string | null } | null)?.contact_email || null
  const academyPhone = (orgRow as { contact_phone?: string | null } | null)?.contact_phone || null

  // ── Affected families (READ-ONLY) ──
  const { data: bookings } = await svc
    .from('camp_bookings')
    .select('parent_email, parent_name, child_name, payment_status')
    .eq('camp_id', campId)
    .eq('organisation_id', orgId)
  const recipients = resolveRecipients((bookings || []) as CampBookingLite[])

  try {
    const [{ sendEmail }, { campExtensionPaymentRequestEmail }] = await Promise.all([
      import('@/lib/email'),
      import('@/lib/email-templates'),
    ])

    const buildFor = (parentName: string, childName: string) =>
      campExtensionPaymentRequestEmail({
        parentName,
        childName,
        campName,
        oldDates,
        newDates,
        amount: amountLabel,
        instructions,
        academyName,
        academyContactEmail: academyEmail,
        academyContactPhone: academyPhone,
      })

    // ── TEST: send a single copy to the requesting admin only ──
    if (mode === 'test') {
      if (!user.email) return NextResponse.json({ error: 'No email on your account to test-send to' }, { status: 400 })
      const tpl = buildFor('there', 'your child')
      await sendEmail({ to: user.email, subject: `[TEST] ${tpl.subject}`, html: tpl.html, fromName: academyName, replyTo: academyEmail || undefined })
      return NextResponse.json({ ok: true, test: true, sentTo: user.email, recipientCount: recipients.length })
    }

    // ── SEND: one academy-branded email per affected family ──
    if (recipients.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, recipientCount: 0, note: 'No emailable booked families.' })
    }
    let sent = 0
    let failed = 0
    for (const r of recipients) {
      try {
        const tpl = buildFor(r.parentName, r.childName)
        await sendEmail({ to: r.email, subject: tpl.subject, html: tpl.html, fromName: academyName, replyTo: academyEmail || undefined })
        sent++
      } catch {
        failed++
      }
    }
    return NextResponse.json({ ok: true, sent, failed, recipientCount: recipients.length })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Send failed' }, { status: 500 })
  }
}
