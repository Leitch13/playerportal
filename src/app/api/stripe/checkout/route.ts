import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { paymentId } = await request.json()
    if (!paymentId) {
      return NextResponse.json({ error: 'Missing paymentId' }, { status: 400 })
    }

    // Fetch the payment record — parent can only see their own (RLS enforced)
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('*, parent:profiles!payments_parent_id_fkey(full_name, email, stripe_customer_id)')
      .eq('id', paymentId)
      .single()

    if (paymentError || !payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    // Only allow paying your own payments
    if (payment.parent_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Calculate remaining balance in pence
    const amountDue = Number(payment.amount)
    const amountPaid = Number(payment.amount_paid || 0)
    const remaining = amountDue - amountPaid

    if (remaining <= 0) {
      return NextResponse.json({ error: 'Payment already completed' }, { status: 400 })
    }

    const parent = payment.parent as unknown as {
      full_name: string
      email: string
      stripe_customer_id: string | null
    }

    // Get or create Stripe customer
    let customerId = parent?.stripe_customer_id

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: parent?.email || user.email || '',
        name: parent?.full_name || '',
        metadata: { supabase_user_id: user.id },
      })
      customerId = customer.id

      // Save Stripe customer ID to profile
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)
    }

    // Create Stripe Checkout Session
    const origin = request.headers.get('origin') || 'http://localhost:3000'

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: 'gbp',
            product_data: {
              name: payment.description || 'Payment',
              description: `Payment for ${parent?.full_name || 'Parent'}`,
            },
            unit_amount: Math.round(remaining * 100), // Stripe uses pence
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${origin}/dashboard/payments?success=1`,
      cancel_url: `${origin}/dashboard/payments?cancelled=1`,
      metadata: {
        payment_id: paymentId,
        supabase_user_id: user.id,
      },
    })

    // Store session ID on payment for webhook reconciliation
    await supabase
      .from('payments')
      .update({ stripe_session_id: session.id })
      .eq('id', paymentId)

    return NextResponse.json({ url: session.url })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : ''
    console.error('Stripe checkout error:', message, stack)
    return NextResponse.json(
      { error: message, detail: stack?.slice(0, 500) },
      { status: 500 }
    )
  }
}
