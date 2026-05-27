import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'

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
      childAge,
      medicalInfo,
      consentGiven,
      siblingDiscount,
      slug,
    } = body

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
        child_age: childAge ? parseInt(childAge) : null,
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

      return NextResponse.json({
        success: true,
        free: true,
        bookingId: booking.id,
      })
    }

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
            unit_amount: Math.round(price * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
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
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
