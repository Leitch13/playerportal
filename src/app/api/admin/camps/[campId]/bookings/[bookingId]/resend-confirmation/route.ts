/**
 * Sprint 10 — POST /api/admin/camps/[campId]/bookings/[bookingId]/resend-confirmation
 *
 * Admin-only endpoint: re-fire the Sprint 9 camp confirmation email for
 * a single booking. Triggered when a parent says "I didn't get the email"
 * — most common camp support ticket.
 *
 * This is intentionally NOT idempotent at the email layer — the admin is
 * explicitly asking for another send. The Sprint 9 webhook-side
 * idempotency (stripe_events short-circuit, payments unique index) is
 * unaffected because this route doesn't touch Stripe at all.
 *
 * Re-uses the exact same campBookingConfirmationEmail template + sendEmail
 * helper the webhook uses, so what the parent receives on resend is
 * byte-identical to the original.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(
  _request: NextRequest,
  ctx: { params: Promise<{ campId: string; bookingId: string }> },
) {
  const { campId, bookingId } = await ctx.params
  if (!campId || !bookingId) {
    return NextResponse.json({ error: 'Missing camp or booking id' }, { status: 400 })
  }

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

  const svc = getServiceClient()

  // ── Pull the booking + camp + org context ──
  const { data: booking, error: bErr } = await svc
    .from('camp_bookings')
    .select('id, camp_id, organisation_id, parent_email, parent_name, child_name, amount_paid')
    .eq('id', bookingId)
    .maybeSingle()
  if (bErr || !booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  if (booking.organisation_id !== orgId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (booking.camp_id !== campId) return NextResponse.json({ error: 'Booking does not belong to this camp' }, { status: 400 })

  if (!booking.parent_email || (booking.parent_email as string).endsWith('@theplayerportal.net')) {
    // Admin-added bookings without a real parent email — nothing to resend.
    return NextResponse.json({ error: 'No real parent email on this booking — nothing to resend' }, { status: 400 })
  }

  // ── Pull camp dates ──
  const { data: camp } = await svc
    .from('camps')
    .select('name, start_date, end_date')
    .eq('id', campId)
    .maybeSingle()
  if (!camp) return NextResponse.json({ error: 'Camp not found' }, { status: 404 })

  // ── Pull academy display + contact channels (same shape as webhook) ──
  const { data: orgRow } = await svc
    .from('organisations')
    .select('name, contact_email, contact_phone')
    .eq('id', orgId)
    .maybeSingle()
  const academyName = (orgRow as { name?: string | null } | null)?.name || 'Your academy'
  const academyEmail = (orgRow as { contact_email?: string | null } | null)?.contact_email || null
  const academyPhone = (orgRow as { contact_phone?: string | null } | null)?.contact_phone || null

  // ── Build + send (re-uses Sprint 9 template + sendEmail) ──
  try {
    const [{ sendEmail }, { campBookingConfirmationEmail }, { buildWhatsappUrl, WA_TEMPLATES }] = await Promise.all([
      import('@/lib/email'),
      import('@/lib/email-templates'),
      import('@/lib/whatsapp'),
    ])

    const fmtDate = (iso: string | null) =>
      iso
        ? new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', {
            weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
          })
        : ''
    const startDateLabel = fmtDate((camp as { start_date?: string | null }).start_date || null)
    const endDateLabel = fmtDate((camp as { end_date?: string | null }).end_date || null) || startDateLabel
    const amt = Number(booking.amount_paid || 0)
    const amountLabel = amt > 0 ? `£${amt.toFixed(2)}` : 'Free'

    const whatsappUrl = academyPhone
      ? buildWhatsappUrl(
          academyPhone,
          WA_TEMPLATES.parentToAcademyHi({ academyName, childName: booking.child_name || undefined }),
        )
      : null

    const tpl = campBookingConfirmationEmail({
      parentName: booking.parent_name || 'there',
      childName: booking.child_name || 'your child',
      campName: (camp as { name?: string }).name || 'Camp',
      startDate: startDateLabel,
      endDate: endDateLabel,
      amountPaid: amountLabel,
      academyName,
      academyContactEmail: academyEmail,
      academyContactPhone: academyPhone,
      whatsappUrl,
      bookingReference: booking.id,
    })

    const result = await sendEmail({
      to: booking.parent_email,
      subject: tpl.subject,
      html: tpl.html,
      fromName: academyName,
      replyTo: academyEmail || undefined,
    })

    return NextResponse.json({
      ok: true,
      resendMessageId: (result as { id?: string; data?: { id?: string } }).id ||
        (result as { data?: { id?: string } }).data?.id ||
        null,
    })
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Send failed',
    }, { status: 500 })
  }
}
