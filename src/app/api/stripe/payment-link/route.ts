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

    // Only admins/coaches can create payment links
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'coach'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { description, amount, type } = await request.json()

    if (!description || !amount) {
      return NextResponse.json({ error: 'Missing description or amount' }, { status: 400 })
    }

    if (type === 'subscription') {
      // Create a recurring payment link from a plan
      const { planId } = await request.json()
      // For subscriptions, use the subscribe flow instead
      return NextResponse.json({ error: 'Use subscribe endpoint for subscriptions' }, { status: 400 })
    }

    // Create a one-time Stripe product + price
    const product = await stripe.products.create({
      name: description,
    })

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: Math.round(Number(amount) * 100),
      currency: 'gbp',
    })

    // Create payment link
    const paymentLink = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      payment_method_types: ['card', 'bacs_debit'],
      after_completion: {
        type: 'redirect',
        redirect: {
          url: `${request.headers.get('origin') || 'https://playerportal-eight.vercel.app'}/dashboard/payments?success=1`,
        },
      },
    })

    return NextResponse.json({ url: paymentLink.url })
  } catch (err) {
    console.error('Payment link error:', err)
    return NextResponse.json(
      { error: 'Failed to create payment link' },
      { status: 500 }
    )
  }
}
