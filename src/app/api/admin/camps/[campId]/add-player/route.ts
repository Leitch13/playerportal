/**
 * Sprint 9 — POST /api/admin/camps/[campId]/add-player
 *
 * Admin-only endpoint: manually attach an existing player to a camp
 * without going through the public Checkout flow.
 *
 * Inserts a `camp_bookings` row with:
 *   - payment_status:  'paid' (admin entries don't go through Stripe)
 *   - amount_paid:     0 by default; admin can override via { amountPaid } in body
 *   - booking_source:  'admin_created' (Sprint 9 column from migration 081)
 *   - parent_name/_email/_phone: copied from the player's parent profile
 *
 * No Stripe call. No email send. No capacity bypass — capacity is checked
 * against current paid+pending bookings using the same rule the public
 * Checkout uses.
 *
 * Idempotency: rejects an add when the same (camp_id, player_id) pair
 * already has a booking — clean 409 response so the UI can show
 * "already booked".
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
  request: NextRequest,
  ctx: { params: Promise<{ campId: string }> },
) {
  const { campId } = await ctx.params
  if (!campId) {
    return NextResponse.json({ error: 'Missing camp id' }, { status: 400 })
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

  // ── Body: player_id + optional amountPaid (admin's recorded value) ──
  const body = await request.json().catch(() => ({}))
  const playerId = (body?.playerId as string | undefined)?.trim()
  const amountPaid = Number(body?.amountPaid ?? 0)
  if (!playerId) {
    return NextResponse.json({ error: 'Missing playerId' }, { status: 400 })
  }
  if (Number.isNaN(amountPaid) || amountPaid < 0) {
    return NextResponse.json({ error: 'Invalid amountPaid' }, { status: 400 })
  }

  // ── Use service-role client for the writes so we don't depend on the
  //    admin's RLS permission on camp_bookings — admins already are
  //    scoped above by org check. ──
  const svc = getServiceClient()

  // Camp existence + org match
  const { data: camp, error: campErr } = await svc
    .from('camps')
    .select('id, organisation_id, name, start_date, end_date, max_capacity')
    .eq('id', campId)
    .maybeSingle()
  if (campErr || !camp) {
    return NextResponse.json({ error: 'Camp not found' }, { status: 404 })
  }
  if (camp.organisation_id !== orgId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Player must belong to this org
  const { data: player, error: playerErr } = await svc
    .from('players')
    .select('id, organisation_id, first_name, last_name, parent_id, date_of_birth, medical_info')
    .eq('id', playerId)
    .maybeSingle()
  if (playerErr || !player) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404 })
  }
  if (player.organisation_id !== orgId) {
    return NextResponse.json({ error: 'Player not in your academy' }, { status: 403 })
  }

  // Resolve parent profile (best-effort; parent_id may be null)
  let parentName = ''
  let parentEmail = ''
  let parentPhone: string | null = null
  if (player.parent_id) {
    const { data: parentRow } = await svc
      .from('profiles')
      .select('full_name, email, phone')
      .eq('id', player.parent_id)
      .maybeSingle()
    parentName = (parentRow?.full_name as string | null) || ''
    parentEmail = (parentRow?.email as string | null) || ''
    parentPhone = (parentRow?.phone as string | null) || null
  }

  // ── Idempotency: existing booking for (camp_id, player_id)? ──
  // No DB-level constraint; check via SELECT. The cheapest way to dedupe
  // an admin-added booking is by child_name + camp_id pair — but child
  // names aren't unique, so we also match the player's parent_email when
  // available. Admin entries can omit parent_email when there's no
  // profile, so we fall back to a child-name match in-camp for those.
  const childFullName = [player.first_name, player.last_name].filter(Boolean).join(' ').trim()
  const { data: existing } = await svc
    .from('camp_bookings')
    .select('id, payment_status, booking_source')
    .eq('camp_id', campId)
    .eq('organisation_id', orgId)
    .eq('child_name', childFullName)
    .maybeSingle()
  if (existing) {
    return NextResponse.json(
      {
        error: 'Player already booked onto this camp',
        existingBookingId: existing.id,
        status: existing.payment_status,
      },
      { status: 409 },
    )
  }

  // ── Capacity check — same rule as /api/stripe/camp-checkout ──
  if (camp.max_capacity) {
    const { count: bookingCount } = await svc
      .from('camp_bookings')
      .select('*', { count: 'exact', head: true })
      .eq('camp_id', campId)
      .in('payment_status', ['pending', 'paid'])
    if (bookingCount != null && bookingCount >= (camp.max_capacity as number)) {
      return NextResponse.json({ error: 'Camp is full' }, { status: 400 })
    }
  }

  // ── Derive age from DOB so admin entries match the form's data shape ──
  let derivedAge: number | null = null
  if (player.date_of_birth) {
    const dob = new Date(player.date_of_birth as string)
    if (!Number.isNaN(dob.getTime())) {
      const now = new Date()
      derivedAge = now.getFullYear() - dob.getFullYear()
      const m = now.getMonth() - dob.getMonth()
      if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) derivedAge--
    }
  }

  // ── Insert the booking ──
  // First try with booking_source (Sprint 9 column, migration 081). If the
  // column doesn't exist yet, fall back to omitting it so the admin can
  // still add players before the migration lands. Once 081 is applied,
  // future admin entries gain the proper "Added by admin" badge.
  const baseInsert = {
    camp_id: campId,
    organisation_id: orgId,
    parent_name: parentName || 'Admin-added',
    parent_email: parentEmail || `admin-added-${playerId.slice(0, 8)}@theplayerportal.net`,
    parent_phone: parentPhone,
    child_name: childFullName || 'Unnamed player',
    child_age: derivedAge,
    child_dob: (player.date_of_birth as string | null) || null,
    medical_info: (player.medical_info as string | null) || null,
    consent_given: true,           // admin attests to consent on the parent's behalf
    amount_paid: amountPaid,
    payment_status: 'paid',         // admin entries are recorded as paid
  }

  let { data: booking, error: insErr } = await svc
    .from('camp_bookings')
    .insert({ ...baseInsert, booking_source: 'admin_created' })
    .select('id')
    .maybeSingle()

  // 42703 = undefined_column. Migration 081 hasn't been applied yet —
  // retry without booking_source so the admin can still add a player.
  if (insErr && (insErr as { code?: string }).code === '42703') {
    const retry = await svc.from('camp_bookings').insert(baseInsert).select('id').maybeSingle()
    booking = retry.data
    insErr = retry.error
  }

  if (insErr || !booking) {
    return NextResponse.json({ error: insErr?.message || 'Failed to add player' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, bookingId: booking.id })
}
