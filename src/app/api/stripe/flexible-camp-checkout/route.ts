// Flexible Camps — Phase 3A backend checkout.
//
// POST /api/stripe/flexible-camp-checkout
//
// Creates a pending flexible-days camp_bookings row (+ one
// camp_booking_days row per selected day) atomically via the RPC from
// migration 096, then opens a Stripe Checkout Session for the parent to
// pay. Every failure path either short-circuits before any DB write or
// compensates a partially-created booking so no ghost pending row can
// hold a seat.
//
// ─── Scope guards (all gated by FLEXIBLE_CAMPS_ENABLED === true) ───
//   * Whole-camp checkout (/api/stripe/camp-checkout) is completely
//     untouched.
//   * Parent UI is still blocked in Phase 3A — no page.tsx calls this
//     route. The route is only reachable by a hand-crafted POST until
//     Phase 3D wires the picker.
//   * Webhook is not yet aware of booking_mode='flexible_days' — the
//     existing session.metadata.camp_booking_id path will flip the
//     booking to 'paid' and send a whole-camp-shaped email. Emails +
//     day-aware payments-row description arrive in Phase 3C.

import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'
import { mapStripeCheckoutError } from '@/lib/stripe-errors'
import { isConnectChargeReady, CONNECT_NOT_READY_MESSAGE } from '@/lib/connect-readiness'
import { FLEXIBLE_CAMPS_ENABLED, BOOKING_MODE_FLEXIBLE_DAYS } from '@/lib/flexible-camps'

// Same service-role pattern as /api/stripe/camp-checkout. Anon parents
// can book, and RLS is bypassed by the connection so nothing about the
// booking depends on an elevated SQL function.
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// Payload sanity cap — a real camp has at most ~14 days. This protects
// against payload abuse without constraining any realistic use.
const MAX_SELECTED_DAYS = 60

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v)
}

// djb2-XOR — same terms-audit hash used by /api/stripe/camp-checkout.
// Kept inline (not extracted to /lib) so a change in the whole-camp
// route can't accidentally alter the flexible route's audit trail, and
// vice-versa. Both hashes must match at the byte level so an org's
// terms_text produces the same hash regardless of which route wrote it.
function computeTermsHash(text: string): string {
  let h = 5381
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h) ^ text.charCodeAt(i)
  return (h >>> 0).toString(16) + '-' + text.length
}

function formatDayDescription(childName: string, dateIso: string): string {
  const d = new Date(dateIso + 'T00:00:00Z')
  const label = d.toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
  })
  return `${childName} — ${label}`
}

type CampDayRow = {
  id: string
  date: string
  price: number | null
  max_capacity: number | null
  is_available: boolean
  sort_order: number | null
}

export async function POST(request: NextRequest) {
  try {
    // ─── 0. Feature flag ────────────────────────────────────────────
    // Second line of defence beyond the parent page's notFound(). When
    // the flag is off, this route pretends not to exist.
    if (!FLEXIBLE_CAMPS_ENABLED) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // ─── 1. Body parse + required-field check ───────────────────────
    const body = await request.json()
    const {
      campId,
      organisationId,
      parentName,
      parentEmail,
      parentPhone,
      childName,
      childDob,
      medicalInfo,
      consentGiven,
      siblingDiscount,
      slug,
      selectedCampDayIds,
    } = body

    if (!campId || !organisationId || !parentName || !parentEmail || !childName || !slug) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // ─── 2. selectedCampDayIds sanity (before any DB read) ──────────
    if (!Array.isArray(selectedCampDayIds) || selectedCampDayIds.length === 0) {
      return NextResponse.json({ error: 'Please select at least one day.' }, { status: 400 })
    }
    if (selectedCampDayIds.length > MAX_SELECTED_DAYS) {
      return NextResponse.json({ error: 'Too many days selected.' }, { status: 400 })
    }
    if (!selectedCampDayIds.every(isUuid)) {
      return NextResponse.json({ error: 'Invalid day id in selection.' }, { status: 400 })
    }
    const dedupedIds = Array.from(new Set(selectedCampDayIds as string[]))
    if (dedupedIds.length !== selectedCampDayIds.length) {
      return NextResponse.json({ error: 'Duplicate day ids in selection.' }, { status: 400 })
    }

    // ─── 3. Age derivation from DOB (matches whole-camp route) ──────
    let derivedAge: number | null = null
    if (childDob) {
      const dob = new Date(childDob)
      if (!isNaN(dob.getTime())) {
        const t = new Date()
        derivedAge = t.getFullYear() - dob.getFullYear()
        const m = t.getMonth() - dob.getMonth()
        if (m < 0 || (m === 0 && t.getDate() < dob.getDate())) derivedAge--
      }
    }

    const supabase = getServiceClient()

    // ─── 4. Camp fetch + mode/publish/org guards ────────────────────
    const { data: camp, error: campError } = await supabase
      .from('camps')
      .select('*')
      .eq('id', campId)
      .single()

    if (campError || !camp) {
      return NextResponse.json({ error: 'Camp not found' }, { status: 404 })
    }
    if (camp.is_published === false) {
      return NextResponse.json({ error: 'This camp isn’t open for bookings.' }, { status: 404 })
    }
    if (camp.booking_mode !== BOOKING_MODE_FLEXIBLE_DAYS) {
      return NextResponse.json({ error: 'This camp is not booked per-day.' }, { status: 400 })
    }
    if (camp.organisation_id !== organisationId) {
      return NextResponse.json({ error: 'Organisation mismatch.' }, { status: 400 })
    }
    if (camp.start_date) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const startDate = new Date(`${camp.start_date}T00:00:00`)
      if (!isNaN(startDate.getTime()) && startDate < today) {
        return NextResponse.json({ error: 'This camp has already started.' }, { status: 400 })
      }
    }

    // ─── 5. Fetch camp_days (pre-lock; RPC re-verifies inside lock) ─
    const { data: dayRowsRaw, error: daysError } = await supabase
      .from('camp_days')
      .select('id, date, price, max_capacity, is_available, sort_order')
      .eq('camp_id', campId)
      .in('id', dedupedIds)

    if (daysError) {
      return NextResponse.json({ error: 'Could not read camp days.' }, { status: 500 })
    }
    const dayRows = (dayRowsRaw || []) as CampDayRow[]
    if (dayRows.length !== dedupedIds.length) {
      return NextResponse.json({ error: 'Some selected days do not belong to this camp.' }, { status: 400 })
    }
    const unavailable = dayRows.filter((d) => !d.is_available)
    if (unavailable.length) {
      return NextResponse.json({
        error: 'Some selected days are no longer available. Please refresh and try again.',
        unavailableDayIds: unavailable.map((d) => d.id),
      }, { status: 400 })
    }

    // ─── 6. Minimum-days requirement ────────────────────────────────
    if (camp.flex_min_days != null && dedupedIds.length < Number(camp.flex_min_days)) {
      return NextResponse.json({
        error: `Please select at least ${camp.flex_min_days} day(s).`,
      }, { status: 400 })
    }

    // ─── 7. Per-day GROSS price resolution ──────────────────────────
    // Order matters — Stripe line items + camp_booking_days rows must
    // pair 1:1 with dedupedIds, so we index by id.
    const flatPerDay = camp.flex_price_per_day != null ? Number(camp.flex_price_per_day) : null
    const dayById = new Map<string, CampDayRow>()
    for (const row of dayRows) dayById.set(row.id, row)

    const orderedRows = dedupedIds.map((id) => dayById.get(id)!) as CampDayRow[]
    const perDayGross: number[] = []
    for (const row of orderedRows) {
      const rowPrice = row.price != null ? Number(row.price) : flatPerDay
      if (rowPrice == null || isNaN(rowPrice) || rowPrice < 0) {
        return NextResponse.json({ error: 'Invalid price on a selected day.' }, { status: 400 })
      }
      perDayGross.push(Math.round(rowPrice * 100) / 100)
    }
    const grossTotal = perDayGross.reduce((s, p) => s + p, 0)

    // ─── 8. Sibling discount (whole-camp early-bird deliberately N/A) ─
    // Early-bird pricing is a whole-camp concept (single price) and is
    // deliberately NOT applied to flexible bookings. Only the sibling
    // discount ports over.
    let discountAmount = 0
    if (siblingDiscount && camp.sibling_discount_enabled && camp.sibling_discount_percent) {
      discountAmount = grossTotal * (Number(camp.sibling_discount_percent) / 100)
    }
    const netTotal = Math.round((grossTotal - discountAmount) * 100) / 100
    if (netTotal < 0) {
      return NextResponse.json({ error: 'Discount produced a negative total.' }, { status: 400 })
    }

    // ─── 9. Terms version hash (T&C audit) ──────────────────────────
    let termsVersionHash: string | null = null
    if (consentGiven) {
      const { data: orgRow } = await supabase
        .from('organisations')
        .select('terms_text')
        .eq('id', organisationId)
        .single()
      const txt = (orgRow?.terms_text as string | null) || ''
      termsVersionHash = computeTermsHash(txt)
    }

    // ─── 10. Atomic RPC: capacity check + booking + booking_days ────
    // Snapshotting GROSS per-day amounts (perDayGross). Any total-level
    // discount is applied only on the parent camp_bookings.amount_paid,
    // so future partial-refund apportioning can recover the pre-discount
    // per-day rate.
    const { data: rpcData, error: rpcError } = await supabase.rpc('book_flexible_camp_days', {
      p_camp_id: campId,
      p_organisation_id: organisationId,
      p_parent_name: parentName,
      p_parent_email: parentEmail,
      p_parent_phone: parentPhone || null,
      p_child_name: childName,
      p_child_age: derivedAge,
      p_child_dob: childDob || null,
      p_medical_info: medicalInfo || null,
      p_consent_given: !!consentGiven,
      p_terms_accepted_at: consentGiven ? new Date().toISOString() : null,
      p_terms_version_hash: termsVersionHash,
      p_amount_total: netTotal,
      p_selected_day_ids: dedupedIds,
      p_per_day_amounts: perDayGross,
      p_booking_source: 'public_checkout',
    })

    if (rpcError) {
      const msg = rpcError.message || ''
      if (msg.startsWith('day_full:')) {
        const dayId = msg.replace('day_full:', '').trim()
        return NextResponse.json({
          error: 'One of the selected days has just become full. Please refresh and try again.',
          fullDayIds: [dayId],
        }, { status: 400 })
      }
      if (msg.includes('day_unavailable')) {
        return NextResponse.json({ error: 'One of the selected days is no longer available.' }, { status: 400 })
      }
      if (msg.includes('invalid_day_ids')) {
        return NextResponse.json({ error: 'One or more selected days are invalid for this camp.' }, { status: 400 })
      }
      if (msg.includes('no_days_selected')) {
        return NextResponse.json({ error: 'Please select at least one day.' }, { status: 400 })
      }
      console.error('[flexible-camp-checkout] RPC error:', rpcError)
      return NextResponse.json({ error: 'Booking could not be created. Please try again.' }, { status: 500 })
    }

    const bookingId = rpcData as unknown as string
    if (!isUuid(bookingId)) {
      console.error('[flexible-camp-checkout] RPC returned invalid booking id:', rpcData)
      return NextResponse.json({ error: 'Booking could not be created. Please try again.' }, { status: 500 })
    }

    // ─── 11. Free-camp short-circuit ────────────────────────────────
    // netTotal = 0 (all days had price 0, or discount reduced to 0).
    // Mark paid inline. Emails are deliberately NOT sent here in
    // Phase 3A — the existing templates don't yet know how to list
    // selected days (that arrives in Phase 3C). Parent UI is still
    // blocked in Phase 3A, so this path is only reachable by backend
    // tests until 3C.
    if (netTotal <= 0) {
      await supabase
        .from('camp_bookings')
        .update({ payment_status: 'paid' })
        .eq('id', bookingId)
      return NextResponse.json({
        success: true,
        free: true,
        bookingId,
      })
    }

    // ─── 12. Connect routing (mirrors whole-camp behaviour byte-for-byte) ─
    const { data: payoutOrg } = await supabase
      .from('organisations')
      .select('stripe_account_id, platform_plan_id')
      .eq('id', organisationId)
      .single()

    if (!payoutOrg?.stripe_account_id) {
      // Compensating delete — cascade drops camp_booking_days rows via
      // ON DELETE CASCADE from Phase 0.
      await supabase.from('camp_bookings').delete().eq('id', bookingId)
      return NextResponse.json(
        { error: 'This academy is still finishing their setup. Camp bookings can\'t be paid for just yet.' },
        { status: 503 },
      )
    }

    if (!(await isConnectChargeReady(payoutOrg.stripe_account_id))) {
      await supabase.from('camp_bookings').delete().eq('id', bookingId)
      return NextResponse.json({ error: CONNECT_NOT_READY_MESSAGE }, { status: 503 })
    }

    // ─── 13. Platform fee resolution ────────────────────────────────
    let PLATFORM_FEE_RATE = 0.035
    if (payoutOrg.platform_plan_id) {
      const { data: platformPlan } = await supabase
        .from('platform_plans')
        .select('transaction_fee_percent')
        .eq('id', payoutOrg.platform_plan_id)
        .single()
      if (platformPlan) {
        PLATFORM_FEE_RATE = Number(platformPlan.transaction_fee_percent) / 100
      }
    }
    const netTotalPence = Math.round(netTotal * 100)
    const feeAmount = PLATFORM_FEE_RATE > 0 ? Math.round(netTotalPence * PLATFORM_FEE_RATE) : 0

    // ─── 14. Apportion any discount across days for Stripe line items ─
    // Stripe Checkout Sessions do NOT support negative line-item amounts,
    // so we can't add a separate "sibling discount" line. Instead we
    // apportion the discount proportionally per day and correct any
    // rounding drift on the last item so the line-item sum equals
    // netTotalPence exactly.
    //
    // camp_booking_days.amount_paid keeps the GROSS snapshot (perDayGross)
    // via the RPC — this apportioning affects only the Stripe receipt,
    // never the DB.
    const netPerDayPence: number[] = []
    if (discountAmount > 0 && grossTotal > 0) {
      for (const gross of perDayGross) {
        netPerDayPence.push(Math.round(gross * (netTotal / grossTotal) * 100))
      }
      const sum = netPerDayPence.reduce((s, p) => s + p, 0)
      const drift = netTotalPence - sum
      if (drift !== 0) {
        netPerDayPence[netPerDayPence.length - 1] += drift
      }
    } else {
      for (const gross of perDayGross) {
        netPerDayPence.push(Math.round(gross * 100))
      }
    }

    // ─── 15. Stripe Checkout Session ────────────────────────────────
    const origin = request.headers.get('origin') || 'https://theplayerportal.net'
    const successUrl = `${origin}/book/${slug}/camps/${campId}?booked=1&booking=${bookingId}`
    const cancelUrl = `${origin}/book/${slug}/camps/${campId}?cancelled=1`

    const lineItems = orderedRows.map((row, i) => ({
      price_data: {
        currency: 'gbp' as const,
        product_data: {
          name: camp.name as string,
          description: formatDayDescription(childName, row.date),
        },
        unit_amount: netPerDayPence[i],
      },
      quantity: 1,
    }))

    let session
    try {
      session = await stripe.checkout.sessions.create({
        customer_email: parentEmail,
        line_items: lineItems,
        mode: 'payment',
        payment_intent_data: {
          // on_behalf_of + transfer_data are byte-for-byte identical to
          // whole-camp checkout — brands the payment with the academy's
          // Stripe account and routes funds to their connected account.
          on_behalf_of: payoutOrg.stripe_account_id,
          ...(feeAmount > 0 ? { application_fee_amount: feeAmount } : {}),
          transfer_data: {
            destination: payoutOrg.stripe_account_id,
          },
        },
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          // camp_booking_id preserved — the existing webhook's
          // metadata.camp_booking_id branch flips payment_status='paid'
          // mode-agnostically. Do NOT change this key name.
          camp_booking_id: bookingId,
          camp_id: campId,
          child_name: childName,
          // NEW for flexible bookings — Phase 3C will branch on this in
          // the webhook to fetch selected days for the email + payments
          // description.
          booking_mode: BOOKING_MODE_FLEXIBLE_DAYS,
          day_count: String(dedupedIds.length),
        },
      })
    } catch (stripeErr) {
      // ─── Compensating rollback ───
      // Stripe session creation failed after we inserted the pending
      // booking + booking_days rows. Delete the parent booking; the FK
      // ON DELETE CASCADE from Phase 0 drops the child camp_booking_days
      // rows. If cleanup itself fails we log and continue — the nightly
      // pending-cleanup cron (see Phase 3 plan) is the belt-and-braces.
      try {
        await supabase.from('camp_bookings').delete().eq('id', bookingId)
      } catch (cleanupErr) {
        console.error('[flexible-camp-checkout] rollback delete failed:', cleanupErr)
      }
      console.error('[flexible-camp-checkout] Stripe session create failed:', stripeErr)
      return NextResponse.json({ error: mapStripeCheckoutError(stripeErr) }, { status: 500 })
    }

    // ─── 16. Persist the session id on the booking ──────────────────
    await supabase
      .from('camp_bookings')
      .update({ stripe_session_id: session.id })
      .eq('id', bookingId)

    return NextResponse.json({ url: session.url, bookingId })
  } catch (err: unknown) {
    console.error('Flexible camp checkout error:', err)
    return NextResponse.json({ error: mapStripeCheckoutError(err) }, { status: 500 })
  }
}
