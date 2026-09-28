import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { listPlatformInvoices, sendPlatformInvoiceEmail } from '@/lib/platform-invoice'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

// Operator-only: (re)send an academy its branded Player Portal invoice for the
// latest PAID platform invoice. Used to send September 2026's invoices, before
// the automatic email existed, and for any "please resend my invoice" later.
// Guarded by CRON_SECRET. Body: { orgIds?: string[] } — omit for every academy
// with a platform subscription. { dryRun: true } lists without sending.
export async function POST(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = (await req.json().catch(() => ({}))) as { orgIds?: string[]; dryRun?: boolean }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  let q = supabase.from('organisations').select('id, name, platform_stripe_subscription_id').not('platform_stripe_subscription_id', 'is', null)
  if (body.orgIds?.length) q = q.in('id', body.orgIds)
  const { data: orgs } = await q
  const results: { academy: string; invoice?: string; sentTo?: string[]; error?: string }[] = []
  for (const o of orgs ?? []) {
    try {
      const invs = await listPlatformInvoices(stripe, o.platform_stripe_subscription_id as string)
      const paid = invs.find((i) => i.status === 'paid' && (i.amount_paid ?? 0) > 0)
      if (!paid) { results.push({ academy: o.name as string, error: 'no paid invoice' }); continue }
      if (body.dryRun) {
        let email = paid.customer_email || '(admins)'
        if (typeof paid.customer === 'string') {
          const c = await stripe.customers.retrieve(paid.customer).catch(() => null)
          if (c && !('deleted' in c && c.deleted) && (c as Stripe.Customer).email) email = (c as Stripe.Customer).email as string
        }
        results.push({ academy: o.name as string, invoice: paid.number || paid.id, sentTo: [email] }); continue
      }
      const sentTo = await sendPlatformInvoiceEmail(stripe, supabase, o.id as string, paid)
      results.push({ academy: o.name as string, invoice: paid.number || paid.id, sentTo })
    } catch (e) {
      results.push({ academy: o.name as string, error: e instanceof Error ? e.message : String(e) })
    }
  }
  return NextResponse.json({ ok: true, dryRun: !!body.dryRun, results })
}
