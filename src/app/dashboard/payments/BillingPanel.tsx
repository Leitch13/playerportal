/**
 * §4 Billing — payment method preview · last/next payment · outstanding · history link.
 *
 * "Update payment method" reuses the existing ManageBillingButton (opens
 * Stripe customer portal). All Stripe behaviour unchanged.
 */
import Link from 'next/link'
import ManageBillingButton from './ManageBillingButton'

export interface BillingFacts {
  hasStripeCustomer: boolean
  outstanding: number          // pence-free pounds
  totalPaid: number
  overdueCount: number
  lastPaymentDate: string | null
  lastPaymentAmount: number | null
  nextPaymentDate: string | null
  nextPaymentAmount: number | null
}

function fmtGBP(n: number | null): string {
  if (n == null) return '—'
  return '£' + n.toFixed(2)
}
function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch { return '—' }
}

export default function BillingPanel({ facts }: { facts: BillingFacts }) {
  return (
    <section className="space-y-3" data-testid="billing-panel" id="billing">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-white/50">Billing</h2>
        <Link
          href="/dashboard/payments/statement"
          className="text-xs text-[#4ecde6] hover:text-[#7adeeb] font-semibold"
        >
          View payment history →
        </Link>
      </div>

      <div className="bg-[#141414] border border-[#1e1e1e] rounded-2xl p-5 space-y-4">
        {/* Update method CTA */}
        {facts.hasStripeCustomer && (
          <div className="flex items-center justify-between gap-3 flex-wrap pb-4 border-b border-white/[0.06]">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-white/40 mb-0.5">Payment method</p>
              <p className="text-sm text-white">Card on file via Stripe</p>
            </div>
            <ManageBillingButton />
          </div>
        )}

        {/* Last / Next payment grid */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-0.5">Last payment</p>
            <p className="text-white">{fmtGBP(facts.lastPaymentAmount)}</p>
            <p className="text-xs text-white/40">{fmtDate(facts.lastPaymentDate)}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-0.5">Next payment</p>
            <p className="text-white">{fmtGBP(facts.nextPaymentAmount)}</p>
            <p className="text-xs text-white/40">{fmtDate(facts.nextPaymentDate)}</p>
          </div>
        </div>

        {/* Outstanding pill */}
        {(facts.outstanding > 0 || facts.overdueCount > 0) && (
          <div className="rounded-xl p-3 bg-rose-500/10 border border-rose-500/30 flex items-center gap-3 flex-wrap">
            <span className="text-lg">⚠️</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-rose-200">
                {fmtGBP(facts.outstanding)} outstanding
                {facts.overdueCount > 0 && <span className="text-rose-300/80 font-medium"> · {facts.overdueCount} overdue payment{facts.overdueCount !== 1 ? 's' : ''}</span>}
              </p>
              <p className="text-xs text-rose-300/70 mt-0.5">Tap below to update your card or settle the balance.</p>
            </div>
            {facts.hasStripeCustomer && <ManageBillingButton />}
          </div>
        )}

        {/* Stats footer */}
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/[0.06] text-xs text-white/50">
          <span>Total paid all-time</span>
          <span className="text-white/80 font-semibold tabular-nums">{fmtGBP(facts.totalPaid)}</span>
        </div>
      </div>
    </section>
  )
}
