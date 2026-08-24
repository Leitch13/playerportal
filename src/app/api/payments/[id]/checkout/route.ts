import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createInvoiceCheckoutSession } from '@/lib/invoice-checkout'
import { mapStripeCheckoutError } from '@/lib/stripe-errors'

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────────────────
// POST /api/payments/[id]/checkout
//
// Parent-facing checkout for a single one-off invoice, reached from the
// emailed /pay/[id] link. Deliberately does NOT require a login: the invoice
// id is an unguessable UUID acting as a bearer capability, exactly as
// /confirm-subscription/[token] does for migration invites. This matters —
// parents routinely have no password set, and forcing a login here is the
// difference between an invoice that gets paid and one that doesn't.
//
// The capability grants only the ability to PAY a specific invoice. It cannot
// read or mutate anything else.
//
// SAFETY: this route never creates, cancels or alters a subscription, and
// never marks a payment paid itself — the money-moving state change is made
// solely by the existing, proven webhook branch on metadata.payment_id.
// ─────────────────────────────────────────────────────────────────────────

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params
    // Reject anything that isn't a UUID before it reaches the database.
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 })
    }

    const db = adminDb()

    const { data: payment } = await db
      .from('payments')
      .select(
        'id, amount, amount_paid, status, description, organisation_id, parent:profiles!payments_parent_id_fkey(email, stripe_customer_id)'
      )
      .eq('id', id)
      .maybeSingle()

    if (!payment) {
      return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 })
    }

    const parent = payment.parent as unknown as {
      email: string | null
      stripe_customer_id: string | null
    } | null

    const origin = request.headers.get('origin') || 'https://theplayerportal.net'

    const result = await createInvoiceCheckoutSession({
      db,
      payment: {
        id: payment.id as string,
        amount: payment.amount as number,
        amount_paid: payment.amount_paid as number | null,
        status: payment.status as string,
        description: payment.description as string | null,
        organisation_id: payment.organisation_id as string | null,
      },
      parentEmail: parent?.email || null,
      customerId: parent?.stripe_customer_id || null,
      successUrl: `${origin}/pay/${id}?paid=1`,
      cancelUrl: `${origin}/pay/${id}?cancelled=1`,
      metadata: { pp_flow: 'one_off_invoice' },
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status || 400 })
    }

    return NextResponse.json({ url: result.url })
  } catch (err: unknown) {
    console.error('[payments/checkout] failed:', err)
    return NextResponse.json({ error: mapStripeCheckoutError(err) }, { status: 500 })
  }
}
