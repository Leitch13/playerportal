import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'

/**
 * Create a Stripe Checkout Session for a paid one-off trial session.
 *
 * Used for classes where free trials aren't viable (e.g. 1-2-1s). The academy
 * sets training_groups.trial_price to enable this; parents pay once and book
 * a single trial session, no recurring subscription.
 *
 * Returns a Checkout URL the client redirects to.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      groupId,
      childFirstName,
      childLastName,
      childDob,
      parentName,
      parentEmail,
      parentPhone,
      sessionDate,
    } = await request.json()

    if (!groupId) {
      return NextResponse.json({ error: 'Missing groupId' }, { status: 400 })
    }
    if (!parentEmail) {
      return NextResponse.json({ error: 'Missing parent email' }, { status: 400 })
    }

    // Look up the class + academy + trial price + connected stripe account
    const { data: group } = await supabase
      .from('training_groups')
      .select('id, name, trial_price, organisation_id, day_of_week, time_slot, location, class_type')
      .eq('id', groupId)
      .single()

    if (!group) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 })
    }

    const trialPrice = Number(group.trial_price || 0)
    if (trialPrice <= 0) {
      return NextResponse.json(
        { error: 'This class offers free trials — use the free trial flow instead.' },
        { status: 400 }
      )
    }

    const { data: org } = await supabase
      .from('organisations')
      .select('id, name, slug, stripe_account_id, platform_plan_id')
      .eq('id', group.organisation_id)
      .single()

    if (!org) {
      return NextResponse.json({ error: 'Academy not found' }, { status: 404 })
    }

    if (!org.stripe_account_id) {
      return NextResponse.json(
        { error: 'This academy is still finishing their setup. Trials can\'t be booked just yet.' },
        { status: 503 }
      )
    }

    // Resolve the platform fee rate from the academy's platform plan
    let PLATFORM_FEE_RATE = 0.035
    if (org.platform_plan_id) {
      const { data: platformPlan } = await supabase
        .from('platform_plans')
        .select('transaction_fee_percent')
        .eq('id', org.platform_plan_id)
        .single()
      if (platformPlan) {
        PLATFORM_FEE_RATE = Number(platformPlan.transaction_fee_percent) / 100
      }
    }

    const amountPence = Math.round(trialPrice * 100)
    const feeAmount = PLATFORM_FEE_RATE > 0 ? Math.round(amountPence * PLATFORM_FEE_RATE) : 0
    const origin = request.headers.get('origin') || 'https://theplayerportal.net'

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: parentEmail,
      line_items: [
        {
          price_data: {
            currency: 'gbp',
            product_data: {
              name: `Trial session — ${group.name}`,
              description: `One-off trial session at ${org.name}.`,
            },
            unit_amount: amountPence,
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/book/${org.slug}/class/${groupId}/trial/paid/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/book/${org.slug}/class/${groupId}`,
      metadata: {
        type: 'paid_trial',
        supabase_class_id: groupId,
        supabase_org_id: org.id,
        child_first_name: childFirstName || '',
        child_last_name: childLastName || '',
        child_dob: childDob || '',
        parent_name: parentName || '',
        parent_email: parentEmail,
        parent_phone: parentPhone || '',
        session_date: sessionDate || '',
      },
      payment_intent_data: {
        ...(feeAmount > 0 ? { application_fee_amount: feeAmount } : {}),
        transfer_data: {
          destination: org.stripe_account_id,
        },
      },
    }

    const session = await stripe.checkout.sessions.create(sessionParams)

    return NextResponse.json({
      url: session.url,
      amount: trialPrice,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create trial checkout'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
