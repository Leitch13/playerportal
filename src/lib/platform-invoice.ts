// Player Portal's own invoice to an academy for its monthly plan.
//
// Stripe already creates a numbered invoice and PDF for every platform payment,
// but never emailed it and academies had nowhere to find it (28 Sep 2026). This
// turns a paid platform invoice into the details for our branded invoice email
// and the Billing → Invoices list. Read-only against Stripe: it never charges.

import type Stripe from 'stripe'

export const PLATFORM_SELLER = {
  name: 'Player Portal',
  company: 'JSL Sports Technology Ltd',
  email: 'support@theplayerportal.net',
}

export interface PlatformInvoice {
  id: string
  number: string
  status: string
  amountPence: number
  currency: string
  issuedOn: string // ISO date
  paidOn: string | null
  periodStart: string | null
  periodEnd: string | null
  description: string
  card: string | null // "Visa •••• 4242"
  billedToName: string | null
  billedToEmail: string | null
  pdfUrl: string | null
  hostedUrl: string | null
}

const iso = (ts?: number | null) => (ts ? new Date(ts * 1000).toISOString().slice(0, 10) : null)

async function cardFor(stripe: Stripe, invoice: Stripe.Invoice): Promise<string | null> {
  try {
    const inv = invoice as Stripe.Invoice & {
      charge?: string | Stripe.Charge | null
      payment_intent?: string | Stripe.PaymentIntent | null
    }
    let charge: Stripe.Charge | null = null
    if (inv.charge) charge = typeof inv.charge === 'string' ? await stripe.charges.retrieve(inv.charge) : inv.charge
    if (!charge && inv.payment_intent) {
      const pi = typeof inv.payment_intent === 'string'
        ? await stripe.paymentIntents.retrieve(inv.payment_intent, { expand: ['latest_charge'] })
        : inv.payment_intent
      const lc = pi.latest_charge
      charge = lc ? (typeof lc === 'string' ? await stripe.charges.retrieve(lc) : lc) : null
    }
    if (!charge && typeof invoice.customer === 'string') {
      // Newer API versions no longer put the charge on the invoice: find the one it paid.
      const list = await stripe.charges.list({ customer: invoice.customer, limit: 10 })
      charge = list.data.find((c) => c.amount === invoice.amount_paid && Math.abs(c.created - (invoice.status_transitions?.paid_at ?? invoice.created)) < 86400) ?? null
    }
    const card = charge?.payment_method_details?.card
    if (!card) return null
    const brand = card.brand ? card.brand.charAt(0).toUpperCase() + card.brand.slice(1) : 'Card'
    return `${brand} •••• ${card.last4}`
  } catch {
    return null
  }
}

export async function describePlatformInvoice(stripe: Stripe, invoice: Stripe.Invoice): Promise<PlatformInvoice> {
  const line = invoice.lines?.data?.[0]
  return {
    id: invoice.id as string,
    number: invoice.number || (invoice.id as string),
    status: invoice.status || 'open',
    amountPence: invoice.amount_paid || invoice.amount_due || 0,
    currency: (invoice.currency || 'gbp').toUpperCase(),
    issuedOn: iso(invoice.status_transitions?.finalized_at ?? invoice.created) as string,
    paidOn: iso(invoice.status_transitions?.paid_at ?? null),
    periodStart: iso(line?.period?.start ?? null),
    periodEnd: iso(line?.period?.end ?? null),
    description: 'Player Portal, monthly plan',
    card: await cardFor(stripe, invoice),
    billedToName: invoice.customer_name || null,
    billedToEmail: invoice.customer_email || null,
    pdfUrl: invoice.invoice_pdf || null,
    hostedUrl: invoice.hosted_invoice_url || null,
  }
}

/** Every invoice for an academy's platform subscription, newest first. */
export async function listPlatformInvoices(stripe: Stripe, subscriptionId: string): Promise<Stripe.Invoice[]> {
  const res = await stripe.invoices.list({ subscription: subscriptionId, limit: 36 })
  return res.data.filter((i) => i.status !== 'draft')
}

/**
 * Email an academy its branded invoice for one paid platform invoice.
 * Goes to the billing email Stripe holds for the academy (the address the
 * £35 is charged against); falls back to the academy's admins if Stripe has none.
 * Replies go to Player Portal support. Returns who it went to.
 */
export async function sendPlatformInvoiceEmail(
  stripe: Stripe,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  orgId: string,
  invoice: Stripe.Invoice,
): Promise<string[]> {
  const { platformInvoiceEmail } = await import('@/lib/email-templates')
  const { sendEmail } = await import('@/lib/email')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.theplayerportal.net'
  const d = await describePlatformInvoice(stripe, invoice)
  const { data: org } = await supabase.from('organisations').select('name, platform_stripe_subscription_id').eq('id', orgId).maybeSingle()
  let nextPaymentOn: string | null = null
  if (org?.platform_stripe_subscription_id) {
    try {
      const sub = await stripe.subscriptions.retrieve(org.platform_stripe_subscription_id)
      const end = (sub.items?.data?.[0] as { current_period_end?: number } | undefined)?.current_period_end
        ?? (sub as Stripe.Subscription & { current_period_end?: number }).current_period_end
      if (sub.status === 'active' && end) nextPaymentOn = new Date(end * 1000).toISOString().slice(0, 10)
    } catch { /* optional line */ }
  }
  let to = d.billedToEmail ? [d.billedToEmail] : []
  if (!to.length) {
    const { data: admins } = await supabase.from('profiles').select('email').eq('organisation_id', orgId).eq('role', 'admin')
    to = ((admins ?? []) as { email: string | null }[]).map((a) => a.email).filter((e): e is string => !!e)
  }
  const tpl = platformInvoiceEmail({
    academyName: (org?.name as string) || d.billedToName || 'your academy',
    number: d.number, issuedOn: d.issuedOn, paidOn: d.paidOn, card: d.card,
    periodStart: d.periodStart, periodEnd: d.periodEnd, amountPence: d.amountPence,
    billedToEmail: d.billedToEmail, seller: PLATFORM_SELLER, pdfUrl: d.pdfUrl,
    nextPaymentOn, billingUrl: `${appUrl}/dashboard/billing#invoices`,
  })
  for (const addr of to) {
    await sendEmail({ to: addr, ...tpl, fromName: 'Player Portal', replyTo: PLATFORM_SELLER.email })
  }
  return to
}
