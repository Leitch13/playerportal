/**
 * §6 Available Upgrades — the catalogue, moved below the fold.
 *
 * Reuses the existing SubscribeButton component end-to-end (same Stripe
 * flow, same prop signature). No new business logic, no new Stripe
 * calls. Pure presentation rewrap.
 */
import SubscribeButton from './SubscribeButton'
import type { SubscriptionPlan } from '@/lib/types'

export default function AvailableUpgrades({
  plans,
  hasActiveSub,
  quarterlyEnabled = false,
}: {
  plans: SubscriptionPlan[]
  hasActiveSub: boolean
  // Per-org quarterly enablement, computed server-side by the parent page via
  // isQuarterlyEnabledForOrg(). Defaults OFF so the toggle never shows unless
  // explicitly enabled for this academy.
  quarterlyEnabled?: boolean
}) {
  if (!plans || plans.length === 0) return null

  return (
    <section className="space-y-3" data-testid="available-upgrades" id="available-upgrades">
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-white/50 mb-1">
          {hasActiveSub ? 'Available upgrades' : 'Available plans'}
        </h2>
        <p className="text-xs text-white/40">
          {hasActiveSub
            ? 'Add another subscription or upgrade an existing one.'
            : 'Pick a plan to start your child’s training.'
          }
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {plans.map(plan => {
          const monthly = Number(plan.amount)
          const sessions = (plan as { sessions_per_week?: number | null }).sessions_per_week ?? null
          return (
            <div
              key={plan.id}
              className="bg-[#141414] border border-[#1e1e1e] rounded-2xl p-5 flex flex-col gap-3 hover:border-[#4ecde6]/30 transition-colors"
              data-testid="upgrade-plan-card"
            >
              <div>
                <h3 className="text-base font-bold text-white">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-3xl font-extrabold text-[#4ecde6] tabular-nums">£{monthly.toFixed(0)}</span>
                  <span className="text-sm text-white/50 font-medium">/{plan.interval || 'month'}</span>
                </div>
                {sessions != null && sessions > 0 && (
                  <p className="text-xs text-white/55 mt-1">
                    {sessions} session{sessions === 1 ? '' : 's'} / week
                  </p>
                )}
              </div>
              <div className="mt-auto pt-2">
                <SubscribeButton
                  planId={plan.id}
                  planName={plan.name}
                  amount={Number(plan.amount)}
                  interval={plan.interval || 'month'}
                  quarterlyEnabled={quarterlyEnabled}
                />
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
