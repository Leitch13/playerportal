/**
 * Revenue Forecast widget — admin home.
 *
 * Shows true MRR (sum of active subscription plan amounts) rather than what
 * happened to land in the bank this month. Helps academy admins see what
 * they're earning right now and project annual recurring revenue.
 *
 * Inputs are pre-computed server-side and passed in to keep this component
 * a thin presentational layer.
 */

import Link from 'next/link'

interface Props {
  mrr: number              // Current monthly recurring revenue (£)
  arr: number              // Annual = MRR × 12
  activeSubs: number       // Count of subscriptions with status='active'
  atRiskMrr: number        // Sum of past_due subs (£) — revenue under threat
  atRiskCount: number      // Count of past_due subs
  trialingCount: number    // Count of subs in 'trialing' state
  trialingMrr: number      // £ that will start charging when trials convert
  bookingSlug?: string     // For the "Share booking link" empty-state CTA
}

function formatMoney(n: number, opts: { compact?: boolean } = {}): string {
  if (opts.compact && n >= 1000) {
    return `£${(n / 1000).toFixed(1)}k`
  }
  return `£${n.toFixed(n >= 100 ? 0 : n >= 10 ? 0 : 2)}`
}

export default function RevenueForecast({
  mrr,
  arr,
  activeSubs,
  atRiskMrr,
  atRiskCount,
  trialingCount,
  trialingMrr,
  bookingSlug,
}: Props) {
  const hasRevenue = mrr > 0 || activeSubs > 0
  const averagePerParent = activeSubs > 0 ? mrr / activeSubs : 0

  if (!hasRevenue) {
    // Empty state — common for newly onboarded academies
    return (
      <div className="relative overflow-hidden rounded-2xl border border-[#1e1e1e] bg-gradient-to-br from-[#141414] via-[#0f1716] to-[#0a0a0a] p-6">
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
            <h2 className="font-bold text-base text-white">Recurring Revenue</h2>
          </div>
          <p className="text-4xl font-extrabold text-white mb-1">£0<span className="text-base text-white/40 font-medium ml-1">/mo</span></p>
          <p className="text-sm text-white/50 mb-4">No active subscriptions yet. Your first paying parent will show up here.</p>

          {bookingSlug ? (
            <div className="flex flex-wrap gap-2">
              <a
                href={`/book/${bookingSlug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
                Preview booking page
              </a>
              <Link
                href="/dashboard/players/import"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-white/5 text-white/70 border border-white/10 hover:bg-white/10 transition-colors"
              >
                Import existing players
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    )
  }

  // Has revenue — full forecast view
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#1e1e1e] bg-gradient-to-br from-[#141414] via-[#0f1716] to-[#0a0a0a] p-6">
      <div className="absolute -top-12 -right-12 w-56 h-56 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
      <div className="relative">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="font-bold text-base text-white">Recurring Revenue</h2>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400/70">Live</span>
        </div>

        {/* MRR headline */}
        <div className="mb-5">
          <div className="flex items-baseline gap-2">
            <p className="text-4xl sm:text-5xl font-extrabold text-white tabular-nums">{formatMoney(mrr)}</p>
            <span className="text-base text-white/40 font-medium">/month</span>
          </div>
          <p className="text-xs text-white/40 mt-1">
            Projected annual revenue: <span className="font-semibold text-white/80">{formatMoney(arr, { compact: true })}</span>
          </p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">Active subs</p>
            <p className="text-xl font-extrabold text-white tabular-nums mt-1">{activeSubs}</p>
          </div>
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">Avg / parent</p>
            <p className="text-xl font-extrabold text-white tabular-nums mt-1">{formatMoney(averagePerParent)}</p>
          </div>
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">In trial</p>
            <p className="text-xl font-extrabold text-white tabular-nums mt-1">{trialingCount}</p>
            {trialingMrr > 0 && (
              <p className="text-[10px] text-emerald-400/70 mt-0.5">+{formatMoney(trialingMrr)} pending</p>
            )}
          </div>
        </div>

        {/* At-risk warning */}
        {atRiskCount > 0 && (
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-amber-200">{atRiskCount} subscription{atRiskCount !== 1 ? 's' : ''} at risk</p>
              <p className="text-[11px] text-amber-200/70">{formatMoney(atRiskMrr)} MRR — payment failed, parent needs to update card</p>
            </div>
            <Link
              href="/dashboard/payments?status=past_due"
              className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-amber-300 hover:text-amber-200 transition-colors px-2 py-1 rounded-md bg-amber-500/10"
            >
              View
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
