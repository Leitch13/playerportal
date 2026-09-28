import Stripe from 'stripe'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { listPlatformInvoices } from '@/lib/platform-invoice'

// Billing → Invoices: every Player Portal invoice for this academy, from Stripe,
// with the official PDF. Read-only. Server component; the org id comes from the
// signed-in admin's own profile (the page checks role before rendering this).

const gbp = (pence: number) => `£${(pence / 100).toFixed(2)}`
const day = (ts: number | null | undefined) =>
  ts ? new Date(ts * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

const STATUS: Record<string, { label: string; cls: string }> = {
  paid: { label: 'Paid', cls: 'bg-emerald-400/10 text-emerald-300' },
  open: { label: 'Due', cls: 'bg-amber-400/10 text-amber-300' },
  uncollectible: { label: 'Unpaid', cls: 'bg-red-400/10 text-red-300' },
  void: { label: 'Void', cls: 'bg-white/5 text-white/40' },
}

export default async function Invoices({ orgId }: { orgId: string }) {
  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: org } = await admin.from('organisations').select('platform_stripe_subscription_id').eq('id', orgId).maybeSingle()
  const subId = (org?.platform_stripe_subscription_id as string | null) || null

  let invoices: Stripe.Invoice[] = []
  let failed = false
  if (subId && process.env.STRIPE_SECRET_KEY) {
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
      invoices = await listPlatformInvoices(stripe, subId)
    } catch {
      failed = true
    }
  }

  return (
    <section id="invoices" className="rounded-2xl border border-white/[0.08] bg-[#0f1a2b] p-5">
      <h2 className="text-base font-bold text-white">Invoices</h2>
      <p className="mt-0.5 text-xs text-white/50">Your Player Portal invoices. Each one is also emailed to you when it&apos;s paid.</p>
      {failed ? (
        <p className="mt-4 text-sm text-white/60">Invoices couldn&apos;t be loaded just now. Refresh in a moment.</p>
      ) : invoices.length === 0 ? (
        <p className="mt-4 text-sm text-white/60">No invoices yet. Your first one appears here once your plan is paid.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-white/40">
                <th className="py-2 pr-3 font-semibold">Date</th>
                <th className="py-2 pr-3 font-semibold">Invoice</th>
                <th className="py-2 pr-3 font-semibold text-right">Amount</th>
                <th className="py-2 pr-3 font-semibold">Status</th>
                <th className="py-2 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const st = STATUS[inv.status || ''] || { label: inv.status || '—', cls: 'bg-white/5 text-white/50' }
                return (
                  <tr key={inv.id} className="border-t border-white/[0.06] text-white/80">
                    <td className="py-2.5 pr-3 whitespace-nowrap">{day(inv.status_transitions?.paid_at ?? inv.created)}</td>
                    <td className="py-2.5 pr-3 font-mono text-xs">{inv.number || inv.id}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{gbp(inv.amount_paid || inv.amount_due || 0)}</td>
                    <td className="py-2.5 pr-3"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${st.cls}`}>{st.label}</span></td>
                    <td className="py-2.5 text-right whitespace-nowrap">
                      {inv.invoice_pdf && <a href={inv.invoice_pdf} target="_blank" rel="noopener" className="text-xs font-semibold text-[#4ecde6] hover:underline">Download PDF</a>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
