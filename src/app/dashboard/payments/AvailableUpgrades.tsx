'use client'

/**
 * §6 Available Upgrades — the catalogue, moved below the fold.
 *
 * Reuses the existing SubscribeButton component end-to-end (same Stripe
 * flow, same prop signature). No new business logic, no new Stripe calls.
 *
 * WHO IS THIS FOR?
 * ----------------
 * This section used to render SubscribeButton with no `playerId`. The prop is
 * optional, so nothing complained — and the payment was created attached to no
 * child at all. By 1 Sep 2026 that had produced 32 live subscriptions worth
 * ~£2,485/month that no per-child screen could see, growing by about twenty a
 * month.
 *
 * Two things follow from a payment with no child on it, and both cost money:
 *   • the academy's "request payment" guard checks by child, so it cannot see
 *     that the parent already pays, and invites them onto a SECOND membership
 *   • the duplicate guard on the way in has nothing to check, so it lets the
 *     second one through
 *
 * One parent bought a second plan through this very section on 1 Sep while
 * already paying for the same child, which would have billed him twice.
 *
 * So the section now asks. One child is filled in automatically; several means
 * the parent picks before they can subscribe. The question is never skipped.
 */
import { useState } from 'react'
import SubscribeButton from './SubscribeButton'
import type { SubscriptionPlan } from '@/lib/types'

export interface UpgradeChild {
  id: string
  first_name: string | null
  last_name: string | null
}

export default function AvailableUpgrades({
  plans,
  hasActiveSub,
  quarterlyEnabled = false,
  myChildren = [],
}: {
  plans: SubscriptionPlan[]
  hasActiveSub: boolean
  // Per-org quarterly enablement, computed server-side by the parent page via
  // isQuarterlyEnabledForOrg(). Defaults OFF so the toggle never shows unless
  // explicitly enabled for this academy.
  quarterlyEnabled?: boolean
  /** The parent's own children. Empty is tolerated — see below. */
  myChildren?: UpgradeChild[]
}) {
  // One child needs no question asked; several must be chosen between.
  const [selectedChildId, setSelectedChildId] = useState<string>(
    myChildren.length === 1 ? myChildren[0].id : '',
  )

  if (!plans || plans.length === 0) return null

  const name = (c: UpgradeChild) =>
    `${(c.first_name ?? '').trim()} ${(c.last_name ?? '').trim()}`.trim() || 'Unnamed child'

  const mustChoose = myChildren.length > 1 && !selectedChildId
  // A parent with no children on record can still subscribe — they may be
  // adding their first child through a different route, and blocking a payment
  // is worse than an unattached one. The server infers where it safely can.
  const blocked = mustChoose

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

      {myChildren.length > 1 && (
        <div className="bg-[#0f1a2b] border border-[#1d2c42] rounded-2xl p-4">
          <label htmlFor="upgrade-child" className="block text-xs font-semibold text-white/70 mb-2">
            Who is this for?
          </label>
          <select
            id="upgrade-child"
            value={selectedChildId}
            onChange={(e) => setSelectedChildId(e.target.value)}
            data-testid="upgrade-child-select"
            className="w-full px-3 py-2.5 rounded-xl bg-[#080e18] border border-[#1d2c42] text-white text-sm focus:outline-none focus:border-[#4ecde6]/50"
          >
            <option value="">Choose a child…</option>
            {myChildren.map((c) => (
              <option key={c.id} value={c.id}>{name(c)}</option>
            ))}
          </select>
          {mustChoose && (
            <p className="text-[11.5px] text-amber-300/80 mt-2">
              Choose a child first, so this membership is attached to the right one.
            </p>
          )}
        </div>
      )}

      {myChildren.length === 1 && (
        <p className="text-xs text-white/40" data-testid="upgrade-child-implied">
          For <span className="text-white/70 font-medium">{name(myChildren[0])}</span>
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {plans.map(plan => {
          const monthly = Number(plan.amount)
          const sessions = (plan as { sessions_per_week?: number | null }).sessions_per_week ?? null
          return (
            <div
              key={plan.id}
              className="bg-[#0f1a2b] border border-[#1d2c42] rounded-2xl p-5 flex flex-col gap-3 hover:border-[#4ecde6]/30 transition-colors"
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
              <div className={`mt-auto pt-2${blocked ? ' opacity-40 pointer-events-none' : ''}`}>
                <SubscribeButton
                  planId={plan.id}
                  planName={plan.name}
                  amount={Number(plan.amount)}
                  interval={plan.interval || 'month'}
                  playerId={selectedChildId || undefined}
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
