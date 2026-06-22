import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'
import { mapStripeCheckoutError } from '@/lib/stripe-errors'
import { isConnectChargeReady, CONNECT_NOT_READY_MESSAGE } from '@/lib/connect-readiness'

// Use service-role client since public users (no auth) can book camps
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: NextRequest) {
  try {
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
    } = body

    // Derive age from DOB so existing age-based logic keeps working.
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

    if (!campId || !parentName || !parentEmail || !childName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = getServiceClient()

    // Fetch camp details
    const { data: camp, error: campError } = await supabase
      .from('camps')
      .select('*')
      .eq('id', campId)
      .single()

    if (campError || !camp) {
      return NextResponse.json({ error: 'Camp not found' }, { status: 404 })
    }

    // Refuse to take payment for an unpublished camp. Front-end pages already
    // hide unpublished camps, but the checkout API is a separate surface — a
    // parent with a stale link (e.g. one Jamie shared, then un-published)
    // could otherwise sail past the gate and pay for something not running.
    if (camp.is_published === false) {
      return NextResponse.json({ error: 'This camp isn’t open for bookings.' }, { status: 404 })
    }

    // Refuse to book a camp whose start date has already passed.
    if (camp.start_date) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const startDate = new Date(`${camp.start_date}T00:00:00`)
      if (!isNaN(startDate.getTime()) && startDate < today) {
        return NextResponse.json({ error: 'This camp has already started.' }, { status: 400 })
      }
    }

    // Check capacity
    const { count: bookingCount } = await supabase
      .from('camp_bookings')
      .select('*', { count: 'exact', head: true })
      .eq('camp_id', campId)
      .in('payment_status', ['pending', 'paid'])

    if (camp.max_capacity && bookingCount != null && bookingCount >= camp.max_capacity) {
      return NextResponse.json({ error: 'Camp is full' }, { status: 400 })
    }

    // Calculate price
    let price = Number(camp.price) || 0
    const today = new Date().toISOString().split('T')[0]

    // Apply early bird pricing if applicable
    if (camp.early_bird_price && camp.early_bird_deadline && today <= camp.early_bird_deadline) {
      price = Number(camp.early_bird_price)
    }

    // Apply sibling discount if applicable
    if (siblingDiscount && camp.sibling_discount_enabled && camp.sibling_discount_percent) {
      price = price * (1 - Number(camp.sibling_discount_percent) / 100)
    }

    price = Math.round(price * 100) / 100 // round to 2 decimal places

    // Compute terms_version_hash so we have an audit trail of which version
    // of the academy's T&Cs the parent agreed to (consent_given tickbox).
    let termsVersionHash: string | null = null
    if (consentGiven) {
      const { data: orgRow } = await supabase
        .from('organisations')
        .select('terms_text')
        .eq('id', organisationId)
        .single()
      const txt = (orgRow?.terms_text as string | null) || ''
      let h = 5381
      for (let i = 0; i < txt.length; i++) h = ((h << 5) + h) ^ txt.charCodeAt(i)
      termsVersionHash = (h >>> 0).toString(16) + '-' + txt.length
    }

    // Insert booking record
    const { data: booking, error: bookingError } = await supabase
      .from('camp_bookings')
      .insert({
        camp_id: campId,
        organisation_id: organisationId,
        parent_name: parentName,
        parent_email: parentEmail,
        parent_phone: parentPhone || null,
        child_name: childName,
        child_age: derivedAge,
        child_dob: childDob || null,
        medical_info: medicalInfo || null,
        consent_given: consentGiven || false,
        amount_paid: price,
        payment_status: 'pending',
        terms_accepted_at: consentGiven ? new Date().toISOString() : null,
        terms_version_hash: termsVersionHash,
      })
      .select()
      .single()

    if (bookingError || !booking) {
      return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 })
    }

    // If free camp, mark as paid immediately
    if (price <= 0) {
      await supabase
        .from('camp_bookings')
        .update({ payment_status: 'paid' })
        .eq('id', booking.id)

      // Free camps short-circuit the Stripe webhook (no Checkout Session is
      // created), so the parent confirmation + academy notification emails
      // must be fired inline here. Mirrors the webhook's paid-camp branch
      // exactly so paid and free bookings produce the same email surface.
      //
      // Wrapped in try/catch — Resend failures must not roll back the
      // booking, which is already inserted and marked paid above. Errors
      // are logged for ops visibility; the parent still sees a success
      // response from the form.
      try {
        const [
          { sendEmail },
          { campBookingConfirmationEmail, newCampBookingAdminEmail },
          { buildWhatsappUrl, WA_TEMPLATES },
        ] = await Promise.all([
          import('@/lib/email'),
          import('@/lib/email-templates'),
          import('@/lib/whatsapp'),
        ])

        const { data: orgRow } = await supabase
          .from('organisations')
          .select('name, contact_email, contact_phone')
          .eq('id', organisationId)
          .maybeSingle()
        const academyName = (orgRow as { name?: string | null } | null)?.name || 'Your academy'
        const academyEmail = (orgRow as { contact_email?: string | null } | null)?.contact_email || null
        const academyPhone = (orgRow as { contact_phone?: string | null } | null)?.contact_phone || null

        const fmtDate = (iso: string | null) =>
          iso
            ? new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', {
                weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
              })
            : ''
        const startDateLabel = fmtDate(camp.start_date as string | null)
        const endDateLabel = fmtDate(camp.end_date as string | null) || startDateLabel
        const datesLabel = startDateLabel
          ? (endDateLabel && endDateLabel !== startDateLabel ? `${startDateLabel} → ${endDateLabel}` : startDateLabel)
          : null

        const whatsappUrl = academyPhone
          ? buildWhatsappUrl(
              academyPhone,
              WA_TEMPLATES.parentToAcademyHi({ academyName, childName: childName || undefined }),
            )
          : null

        // ─── Parent confirmation (matches paid-camp webhook send) ───
        try {
          const tpl = campBookingConfirmationEmail({
            parentName: parentName || 'there',
            childName: childName || 'your child',
            campName: camp.name as string,
            startDate: startDateLabel,
            endDate: endDateLabel,
            amountPaid: 'Free',
            academyName,
            academyContactEmail: academyEmail,
            academyContactPhone: academyPhone,
            whatsappUrl,
            bookingReference: booking.id,
          })
          await sendEmail({
            to: parentEmail,
            subject: tpl.subject,
            html: tpl.html,
            fromName: academyName,
            replyTo: academyEmail || undefined,
          })
        } catch (emailErr) {
          console.error('[camp-checkout:free_parent_confirmation_email] failed:', emailErr)
        }

        // ─── Academy admin notification ───
        try {
          const recipient =
            academyEmail ||
            process.env.ADMIN_NOTIFICATION_EMAIL ||
            'johnleitch970@gmail.com'
          const origin = request.headers.get('origin') || 'https://theplayerportal.net'
          const dashboardUrl = `${origin}/dashboard/camps/${campId}`
          const adminTpl = newCampBookingAdminEmail({
            academyName,
            parentName: parentName || '—',
            parentEmail,
            parentPhone: parentPhone || null,
            childName: childName || '—',
            campName: camp.name as string,
            campDates: datesLabel,
            amountPaid: 'Free',
            dashboardUrl,
          })
          await sendEmail({
            to: recipient,
            subject: adminTpl.subject,
            html: adminTpl.html,
          })
        } catch (emailErr) {
          console.error('[camp-checkout:free_admin_notification_email] failed:', emailErr)
        }
      } catch (emailBlockErr) {
        console.error('[camp-checkout:free_email_block] failed:', emailBlockErr)
      }

      return NextResponse.json({
        success: true,
        free: true,
        bookingId: booking.id,
      })
    }

    // ─── Route the payment to the academy's connected Stripe account ───
    // Camp fees belong to the academy, not the platform. Same model as
    // subscriptions + paid trials: transfer to their connected account and
    // take the platform fee from their plan tier.
    const { data: payoutOrg } = await supabase
      .from('organisations')
      .select('stripe_account_id, platform_plan_id')
      .eq('id', organisationId)
      .single()

    if (!payoutOrg?.stripe_account_id) {
      return NextResponse.json(
        { error: 'This academy is still finishing their setup. Camp bookings can\'t be paid for just yet.' },
        { status: 503 }
      )
    }

    // CONNECT READINESS PRE-FLIGHT — a connected account that can't take charges
    // yet (charges_enabled=false / transfers inactive) would fail mid-checkout.
    // Block here before any Stripe object is created. Mirrors the proven pre-flight
    // in /api/migration/confirm-checkout. Additive — fee/on_behalf_of/transfer_data
    // routing below is unchanged.
    if (!(await isConnectChargeReady(payoutOrg.stripe_account_id))) {
      return NextResponse.json({ error: CONNECT_NOT_READY_MESSAGE }, { status: 503 })
    }

    // Resolve the platform fee rate from the academy's plan tier (default 3.5%)
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
    const amountPence = Math.round(price * 100)
    const feeAmount = PLATFORM_FEE_RATE > 0 ? Math.round(amountPence * PLATFORM_FEE_RATE) : 0

    // Create Stripe Checkout Session
    const origin = request.headers.get('origin') || 'https://theplayerportal.net'
    const successUrl = `${origin}/book/${slug}/camps/${campId}?booked=1&booking=${booking.id}`
    const cancelUrl = `${origin}/book/${slug}/camps/${campId}?cancelled=1`

    const session = await stripe.checkout.sessions.create({
      customer_email: parentEmail,
      line_items: [
        {
          price_data: {
            currency: 'gbp',
            product_data: {
              name: camp.name,
              description: `${childName} - ${camp.name}`,
            },
            unit_amount: amountPence,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      payment_intent_data: {
        // on_behalf_of brands the camp Checkout with the academy's Stripe
        // account name instead of the platform's, matching the subscribe +
        // trial flows for consistency.
        on_behalf_of: payoutOrg.stripe_account_id,
        ...(feeAmount > 0 ? { application_fee_amount: feeAmount } : {}),
        transfer_data: {
          destination: payoutOrg.stripe_account_id,
        },
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        camp_booking_id: booking.id,
        camp_id: campId,
        child_name: childName,
      },
    })

    // Store stripe session on booking
    await supabase
      .from('camp_bookings')
      .update({ stripe_session_id: session.id })
      .eq('id', booking.id)

    return NextResponse.json({ url: session.url, bookingId: booking.id })
  } catch (err: unknown) {
    console.error('Camp checkout error:', err)
    return NextResponse.json({ error: mapStripeCheckoutError(err) }, { status: 500 })
  }
}
