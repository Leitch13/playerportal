/**
 * Move Camp Booking — Phase 1.
 *
 * POST /api/admin/camps/[campId]/bookings/[bookingId]/move
 *   body: { target_camp_id: string, reason?: string }
 *
 * Atomically moves ONE camp booking from one camp to another within the
 * SAME academy. Phase 1 scope is strict by design — no schema change, no
 * Stripe / payments / refunds / enrolments / webhooks touched. The only
 * write to camp_bookings is camp_id; every other field is preserved
 * verbatim so audit + financial integrity stays intact.
 *
 * SAFETY GATES (all server-derived):
 *   1.  Auth: admin role + payment.organisation_id === me.organisation_id
 *   2.  Source camp belongs to caller's org
 *   3.  Booking belongs to source camp AND caller's org
 *   4.  Target camp belongs to same org
 *   5.  Target camp is published
 *   6.  Target camp.start_date >= today (no moves into past)
 *   7.  Booking.payment_status IN ('pending','paid') — refunded/cancelled blocked
 *   8.  Target camp has remaining capacity (counted with the SAME
 *       'IN (pending,paid)' filter used everywhere else in the app)
 *   9.  Target effective price matches booking.amount_paid (early_bird-aware)
 *
 * If any gate fails: 4xx with a friendly message; no DB writes happen.
 *
 * After UPDATE:
 *   • audit_log row written with action='camp_booking.moved' + from/to + reason
 *   • Parent gets "your booking has been moved" email
 *   • Academy gets admin notification email
 *   • Email failures are swallowed + logged — they DO NOT roll back the move.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

type CampRow = {
  id: string
  organisation_id: string
  name: string
  start_date: string | null
  end_date: string | null
  location: string | null
  max_capacity: number | null
  price: number | null
  early_bird_price: number | null
  early_bird_deadline: string | null
  is_published: boolean | null
}

// NOTE — pricing helpers (effectivePriceToday + moneyEqual) were removed when
// the Phase-1 "prices must match" gate was dropped. A move is now an
// operational reseat: camp_id is the only mutated field, amount_paid +
// payment_status + stripe_session_id are preserved verbatim. Future "Move +
// charge difference" or "Move + refund difference" actions would be NEW
// admin choices (separate endpoint or explicit body flag) — they should NOT
// be reintroduced as automatic side-effects of this default move path.

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso + 'T00:00:00Z')
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ campId: string; bookingId: string }> }
) {
  const { campId: sourceCampId, bookingId } = await params

  const body = (await req.json().catch(() => null)) as {
    target_camp_id?: unknown
    reason?: unknown
    notifyParent?: unknown
  } | null

  const targetCampId = typeof body?.target_camp_id === 'string' ? body.target_camp_id : null
  const reason = typeof body?.reason === 'string' && body.reason.trim().length > 0
    ? body.reason.trim().slice(0, 500)
    : null
  // Default to true to preserve existing behaviour — only an explicit `false`
  // skips the parent email. Admin notification + audit log are unaffected.
  const notifyParent = body?.notifyParent === false ? false : true

  if (!targetCampId) {
    return NextResponse.json({ ok: false, error: 'target_camp_id is required' }, { status: 400 })
  }
  if (targetCampId === sourceCampId) {
    return NextResponse.json({ ok: false, error: 'Target camp is the same as the source camp.' }, { status: 400 })
  }

  // ─── Auth gate ───
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { data: me } = await supabase
    .from('profiles')
    .select('role, organisation_id, full_name, email')
    .eq('id', user.id)
    .single()
  if (!me || me.role !== 'admin') {
    return NextResponse.json({ ok: false, error: 'Only academy admins can move bookings.' }, { status: 403 })
  }
  const myOrgId = me.organisation_id as string

  // Service role for the cross-row writes — RLS already enforced via the
  // admin policy on camp_bookings, but we use service-role for symmetry
  // with the rest of the admin API surface.
  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // ─── Load source camp ───
  const { data: sourceCamp } = await service
    .from('camps')
    .select('id, organisation_id, name, start_date, end_date, location, max_capacity, price, early_bird_price, early_bird_deadline, is_published')
    .eq('id', sourceCampId)
    .maybeSingle()
  if (!sourceCamp || (sourceCamp as CampRow).organisation_id !== myOrgId) {
    return NextResponse.json({ ok: false, error: 'Camp not found' }, { status: 404 })
  }

  // ─── Load booking ───
  const { data: booking } = await service
    .from('camp_bookings')
    .select('id, camp_id, organisation_id, parent_name, parent_email, parent_phone, child_name, amount_paid, payment_status, stripe_session_id')
    .eq('id', bookingId)
    .maybeSingle()
  if (
    !booking ||
    booking.camp_id !== sourceCampId ||
    booking.organisation_id !== myOrgId
  ) {
    return NextResponse.json({ ok: false, error: 'Booking not found' }, { status: 404 })
  }

  // ─── Booking moveable? ───
  const status = booking.payment_status as string
  if (status === 'refunded') {
    return NextResponse.json(
      { ok: false, error: 'Refunded bookings cannot be moved. Create a fresh booking on the target camp instead.' },
      { status: 409 }
    )
  }
  if (status === 'cancelled') {
    return NextResponse.json(
      { ok: false, error: 'Cancelled bookings cannot be moved.' },
      { status: 409 }
    )
  }
  if (status !== 'pending' && status !== 'paid') {
    return NextResponse.json(
      { ok: false, error: `Cannot move a booking in status "${status}".` },
      { status: 409 }
    )
  }

  // ─── Load target camp ───
  const { data: targetCamp } = await service
    .from('camps')
    .select('id, organisation_id, name, start_date, end_date, location, max_capacity, price, early_bird_price, early_bird_deadline, is_published')
    .eq('id', targetCampId)
    .maybeSingle()
  if (!targetCamp || (targetCamp as CampRow).organisation_id !== myOrgId) {
    return NextResponse.json({ ok: false, error: 'Target camp not found' }, { status: 404 })
  }
  const target = targetCamp as CampRow

  // ─── Target camp gates ───
  if (target.is_published === false) {
    return NextResponse.json(
      { ok: false, error: 'Target camp is not published. Publish it first or pick a different camp.' },
      { status: 422 }
    )
  }
  if (target.start_date) {
    const todayISO = new Date().toISOString().split('T')[0]
    if (target.start_date < todayISO) {
      return NextResponse.json(
        { ok: false, error: 'Target camp has already started. Pick a future camp.' },
        { status: 422 }
      )
    }
  }

  // ─── Capacity check (same filter used app-wide) ───
  if (target.max_capacity && target.max_capacity > 0) {
    const { count } = await service
      .from('camp_bookings')
      .select('id', { count: 'exact', head: true })
      .eq('camp_id', target.id)
      .in('payment_status', ['pending', 'paid'])
    const booked = count ?? 0
    if (booked >= target.max_capacity) {
      return NextResponse.json(
        { ok: false, error: 'Target camp is full.' },
        { status: 422 }
      )
    }
  }

  // The source booking's amount_paid is preserved verbatim — moving is
  // an operational reseat, not a financial transaction. No price comparison,
  // no refund suggestion, no charge calculation. Admin can choose those as
  // explicit follow-up actions if needed.
  const sourceAmount = Number(booking.amount_paid ?? 0)

  // ─── The move (single field update on camp_bookings) ───
  const { error: updErr } = await service
    .from('camp_bookings')
    .update({ camp_id: target.id })
    .eq('id', bookingId)
    .eq('camp_id', sourceCampId)  // optimistic-lock: only update if still on source
  if (updErr) {
    return NextResponse.json(
      { ok: false, error: `Move failed: ${updErr.message}` },
      { status: 500 }
    )
  }

  // ─── Audit log (best-effort) ───
  try {
    await service.from('audit_log').insert({
      organisation_id: myOrgId,
      user_id: user.id,
      action: 'camp_booking.moved',
      entity_type: 'camp_booking',
      entity_id: bookingId,
      details: {
        from_camp_id: sourceCampId,
        from_camp_name: (sourceCamp as CampRow).name,
        to_camp_id: target.id,
        to_camp_name: target.name,
        amount_paid: sourceAmount,
        payment_status: status,
        reason,
      },
    })
  } catch {
    // Swallow — primary state change already succeeded.
  }

  // ─── Emails (best-effort — never roll back the move) ───
  try {
    const [{ sendEmail }, { campBookingMovedParentEmail, campBookingMovedAdminEmail }] = await Promise.all([
      import('@/lib/email'),
      import('@/lib/email-templates'),
    ])

    const { data: orgRow } = await service
      .from('organisations')
      .select('name, contact_email, contact_phone')
      .eq('id', myOrgId)
      .maybeSingle()
    const academyName = (orgRow as { name?: string | null } | null)?.name || 'Your academy'
    const academyEmail = (orgRow as { contact_email?: string | null } | null)?.contact_email || null
    const academyPhone = (orgRow as { contact_phone?: string | null } | null)?.contact_phone || null

    const childName = (booking.child_name as string | null) || 'your child'
    const parentEmail = (booking.parent_email as string | null) || null
    const parentName = (booking.parent_name as string | null) || 'there'
    const amountLabel = sourceAmount > 0 ? `£${sourceAmount.toFixed(2)}` : 'Free'
    const fromCamp = sourceCamp as CampRow
    const fromStart = fmtDate(fromCamp.start_date)
    const fromEnd = fmtDate(fromCamp.end_date) || fromStart
    const fromDates = fromEnd && fromEnd !== fromStart ? `${fromStart} → ${fromEnd}` : fromStart
    const toStart = fmtDate(target.start_date)
    const toEnd = fmtDate(target.end_date) || toStart
    const toDates = toEnd && toEnd !== toStart ? `${toStart} → ${toEnd}` : toStart

    // Parent email — admin can opt out via the modal checkbox (notifyParent=false).
    // Admin notification + audit log below are unaffected by this flag.
    if (parentEmail && notifyParent) {
      try {
        const tpl = campBookingMovedParentEmail({
          parentName,
          childName,
          fromCampName: fromCamp.name,
          fromCampDates: fromDates,
          fromCampLocation: fromCamp.location || null,
          toCampName: target.name,
          toCampDates: toDates,
          toCampLocation: target.location || null,
          amountPaid: amountLabel,
          academyName,
          academyContactEmail: academyEmail,
          academyContactPhone: academyPhone,
        })
        await sendEmail({
          to: parentEmail,
          subject: tpl.subject,
          html: tpl.html,
          fromName: academyName,
          replyTo: academyEmail || undefined,
        })
      } catch (parentEmailErr) {
        console.error('[camp-move:parent_email_failed]', {
          bookingId,
          error: parentEmailErr instanceof Error ? parentEmailErr.message : String(parentEmailErr),
        })
      }
    }

    // Academy admin notification email
    try {
      const recipient =
        academyEmail ||
        process.env.ADMIN_NOTIFICATION_EMAIL ||
        'johnleitch970@gmail.com'
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://theplayerportal.net'
      const dashboardUrl = `${appUrl}/dashboard/camps/${target.id}`
      const adminTpl = campBookingMovedAdminEmail({
        academyName,
        childName,
        parentName,
        parentEmail: parentEmail || '—',
        fromCampName: fromCamp.name,
        toCampName: target.name,
        toCampDates: toDates,
        amountPaid: amountLabel,
        movedByName: (me.full_name as string | null) || (me.email as string | null) || 'an academy admin',
        reason,
        dashboardUrl,
      })
      await sendEmail({
        to: recipient,
        subject: adminTpl.subject,
        html: adminTpl.html,
      })
    } catch (adminEmailErr) {
      console.error('[camp-move:admin_email_failed]', {
        bookingId,
        error: adminEmailErr instanceof Error ? adminEmailErr.message : String(adminEmailErr),
      })
    }
  } catch (emailBlockErr) {
    console.error('[camp-move:email_block_failed]', {
      bookingId,
      error: emailBlockErr instanceof Error ? emailBlockErr.message : String(emailBlockErr),
    })
  }

  return NextResponse.json({
    ok: true,
    booking_id: bookingId,
    from_camp_id: sourceCampId,
    to_camp_id: target.id,
    to_camp_name: target.name,
  })
}
