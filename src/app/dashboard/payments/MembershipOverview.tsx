/**
 * §1 Membership Overview — first thing the parent sees on the Hub.
 *
 * Answers the 10-second question: "What do I have and what do I pay?"
 *
 * States rendered:
 *   • Has 1 active sub  → single hero card
 *   • Has N>1 active subs → header summary + N stacked cards (one per child)
 *   • Has scheduled-cancel sub → amber "Cancels on <date>" banner inline
 *   • Has past_due sub → red "Action needed" inline banner
 *   • No active sub → empty CTA jumping to §6
 *
 * Pure server component. No client state. No API calls beyond presentation.
 */
import type { SubscriptionPlan } from '@/lib/types'
import Link from 'next/link'
import TermInfo from '@/components/TermInfo'

type Sub = {
  id: string
  status: string
  cancel_at_period_end?: boolean
  current_period_end?: string | null
  created_at: string
  plan: SubscriptionPlan | null
  player: { first_name: string; last_name: string } | null
  // Phase 1B — optional term for the player's enrolled class. Renders an
  // inline term line beneath the plan title. Null when the class has no term.
  term?: {
    id: string
    name: string
    start_date: string
    end_date: string
    parent_message: string | null
  } | null
}

function fmtGBP(amount: number): string {
  return '£' + amount.toFixed(amount % 1 === 0 ? 0 : 2)
}
function fmtDate(iso: string | null | undefined, opts?: Intl.DateTimeFormatOptions): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-GB', opts || { day: 'numeric', month: 'long', year: 'numeric' })
  } catch { return '—' }
}

export default function MembershipOverview({
  activeSubs,
  outstanding,
}: {
  activeSubs: Sub[]
  outstanding: number
}) {
  const subCount = activeSubs.length
  const monthlyTotal = activeSubs.reduce((sum, s) => sum + Number(s.plan?.amount ?? 0), 0)
  const anyPastDue = activeSubs.some(s => s.status === 'past_due' || s.status === 'unpaid')
  const anyScheduledCancel = activeSubs.some(s => s.cancel_at_period_end)

  // ─── Empty state — no active sub ───
  if (subCount === 0) {
    return (
      <section className="bg-gradient-to-br from-[#141414] via-[#0f1416] to-[#0a0a0a] rounded-3xl border border-[#1e1e1e] p-6 sm:p-8 shadow-2xl" data-testid="membership-overview-empty">
        <h2 className="text-sm font-bold uppercase tracking-wider text-white/50 mb-3">Your membership</h2>
        <h3 className="text-2xl font-bold text-white mb-2">You don&apos;t have an active membership yet</h3>
        <p className="text-sm text-white/60 mb-6 max-w-md">
          Pick a plan below to start your child&apos;s training. You can change or cancel at any time.
        </p>
        <a
          href="#available-upgrades"
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm bg-[#4ecde6] text-[#0a0a0a] hover:bg-[#5edcf6] transition-colors"
        >
          See available plans ↓
        </a>
      </section>
    )
  }

  // ─── Active sub(s) — render one hero card per sub ───
  return (
    <section className="space-y-4" data-testid="membership-overview">
      {/* Header summary line — totals only when N > 1 so single-sub parents see less noise */}
      {subCount > 1 && (
        <div className="flex items-baseline justify-between flex-wrap gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-white/50">Your membership</h2>
          <p className="text-xs text-white/60">
            You pay <strong className="text-white">{fmtGBP(monthlyTotal)}/month</strong> across {subCount} memberships
          </p>
        </div>
      )}

      {/* Past-due alert (across all subs) */}
      {anyPastDue && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-2xl p-4 flex items-start gap-3" data-testid="past-due-banner">
          <span className="text-xl shrink-0">⚠️</span>
          <div className="flex-1 text-sm">
            <strong className="block text-rose-200">Action needed</strong>
            One of your payments couldn&apos;t be processed. Update your payment method to avoid losing your child&apos;s place.
          </div>
        </div>
      )}

      {/* Scheduled-cancel alert (informational, separate from past_due) */}
      {anyScheduledCancel && !anyPastDue && (
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-200 rounded-2xl p-4 flex items-start gap-3" data-testid="cancel-pending-banner">
          <span className="text-xl shrink-0">📅</span>
          <div className="flex-1 text-sm">
            <strong className="block text-amber-100">Your membership will end soon</strong>
            One subscription is scheduled to cancel at the end of the current period.
          </div>
        </div>
      )}

      {/* Hero card(s) — one per active sub */}
      {activeSubs.map(sub => {
        const monthly = Number(sub.plan?.amount ?? 0)
        const planName = sub.plan?.name || 'Membership'
        const childName = sub.player ? `${sub.player.first_name} ${sub.player.last_name}`.trim() : null
        const isTrialing = sub.status === 'trialing'
        const isPastDue = sub.status === 'past_due' || sub.status === 'unpaid'
        const willCancel = sub.cancel_at_period_end
        return (
          <div
            key={sub.id}
            className={`relative overflow-hidden rounded-3xl border p-6 sm:p-8 shadow-2xl ${
              isPastDue
                ? 'bg-gradient-to-br from-rose-500/10 via-[#1a0a0a] to-[#0a0a0a] border-rose-500/30'
                : willCancel
                  ? 'bg-gradient-to-br from-amber-500/10 via-[#1a1610] to-[#0a0a0a] border-amber-500/30'
                  : 'bg-gradient-to-br from-[#4ecde6]/8 via-[#0f1820] to-[#0a0a0a] border-[#4ecde6]/30'
            }`}
            data-testid="membership-card"
          >
            <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50 mb-1.5">
                  {isTrialing ? 'Free trial' : isPastDue ? 'Payment overdue' : willCancel ? 'Cancelling soon' : 'Active membership'}
                </p>
                <h3 className="text-xl sm:text-2xl font-bold text-white truncate">
                  {planName}
                  {childName && <span className="text-white/60 font-normal text-base"> · {childName}</span>}
                </h3>
                {/* Phase 1B — Term info inline beneath the plan/child line */}
                {sub.term && (
                  <div className="mt-1.5">
                    <TermInfo
                      variant="inline"
                      name={sub.term.name}
                      start_date={sub.term.start_date}
                      end_date={sub.term.end_date}
                    />
                  </div>
                )}
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                isTrialing ? 'bg-purple-500/15 text-purple-200 border-purple-500/30'
                : isPastDue ? 'bg-rose-500/15 text-rose-200 border-rose-500/30'
                : willCancel ? 'bg-amber-500/15 text-amber-200 border-amber-500/30'
                : 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30'
              }`}>
                {sub.status.replace('_', ' ')}
              </span>
            </div>

            {/* Big number */}
            <div className="flex items-baseline gap-2 mb-5">
              <span className="text-4xl sm:text-5xl font-extrabold text-white tabular-nums">{fmtGBP(monthly)}</span>
              <span className="text-base text-white/60 font-medium">/month</span>
            </div>

            {/* Membership facts grid */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-0.5">
                  {willCancel ? 'Access ends' : isTrialing ? 'Trial ends' : 'Next payment'}
                </p>
                <p className="text-white" data-testid="next-payment-date">{fmtDate(sub.current_period_end)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-0.5">Member since</p>
                <p className="text-white">{fmtDate(sub.created_at, { month: 'short', year: 'numeric' })}</p>
              </div>
            </div>

            {/* Outstanding inline pill, if any */}
            {outstanding > 0 && (
              <div className="mt-5 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-300 text-xs font-bold">
                Outstanding balance: {fmtGBP(outstanding)}
                <Link href="#billing" className="text-orange-200 underline hover:text-orange-100">Pay now →</Link>
              </div>
            )}
          </div>
        )
      })}
    </section>
  )
}
