import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'
import { createInvoiceCheckoutSession } from '@/lib/invoice-checkout'

// Parent-facing money route: give it real headroom instead of the platform
// default. A timeout here surfaces to the parent as a mislabelled network
// error mid-payment; the cron routes already run at 300.
export const maxDuration = 60

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

    // ─── Route the payment to the academy's connected Stripe account ───
    // An invoice is money owed to the ACADEMY. Previously this session was
    // created with no Connect routing at all, so the funds would have landed
    // on the PLATFORM account and never reached the academy — the same defect
    // that took the payment-link generator offline on 2026-07-17. No money was
    // ever misrouted in practice because the caller (PayNowButton) was never
    // rendered, but the landmine is removed here rather than left armed.
    //
    // Shared with the emailed /pay/[id] surface so both build an identical,
    // correctly-routed session. Balance/settled checks live in the helper.
    const origin = request.headers.get('origin') || 'https://theplayerportal.net'

    const result = await createInvoiceCheckoutSession({
      db: supabase,
      payment: {
        id: payment.id as string,
        amount: payment.amount as number,
        amount_paid: payment.amount_paid as number | null,
        status: payment.status as string,
        description: payment.description as string | null,
        organisation_id: payment.organisation_id as string | null,
      },
      parentEmail: parent?.email || user.email || null,
      customerId,
      successUrl: `${origin}/dashboard/payments?success=1`,
      cancelUrl: `${origin}/dashboard/payments?cancelled=1`,
      metadata: { supabase_user_id: user.id, pp_flow: 'one_off_invoice' },
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status || 400 })
    }

    return NextResponse.json({ url: result.url })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : ''
    return NextResponse.json(
      { error: message, detail: stack?.slice(0, 500) },
      { status: 500 }
    )
  }
}
