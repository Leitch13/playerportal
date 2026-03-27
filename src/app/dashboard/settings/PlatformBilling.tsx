'use client'

import { useState, useEffect } from 'react'

interface PlatformPlan {
  id: string
  name: string
  slug: string
  monthly_price: number
  transaction_fee_percent: number
  features: string[]
  sort_order: number
}

interface PlatformStatus {
  currentPlan: PlatformPlan | null
  allPlans: PlatformPlan[]
  status: 'trial' | 'active' | 'past_due' | 'cancelled'
  trialDaysRemaining: number
  trialEndsAt: string | null
  hasSubscription: boolean
}

export default function PlatformBilling({
  usage,
}: {
  usage: { players: number; coaches: number; classes: number }
}) {
  const [data, setData] = useState<PlatformStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [showPlans, setShowPlans] = useState(false)
  const [subscribing, setSubscribing] = useState<string | null>(null)

  useEffect(() => {
    fetchStatus()
  }, [])

  async function fetchStatus() {
    try {
      const res = await fetch('/api/platform/status')
      const json = await res.json()
      setData(json)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  async function handleSubscribe(planSlug: string) {
    setSubscribing(planSlug)
    try {
      const res = await fetch('/api/platform/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planSlug }),
      })
      const json = await res.json()
      if (json.url) {
        window.location.href = json.url
      }
    } catch {
      // ignore
    } finally {
      setSubscribing(null)
    }
  }

  async function handleManageBilling() {
    setSubscribing('manage')
    try {
      const res = await fetch('/api/platform/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planSlug: data?.currentPlan?.slug || 'starter' }),
      })
      const json = await res.json()
      if (json.url) {
        window.location.href = json.url
      }
    } catch {
      // ignore
    } finally {
      setSubscribing(null)
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-6 bg-white/5 rounded w-48" />
        <div className="h-40 bg-white/5 rounded-2xl" />
      </div>
    )
  }

  if (!data) return null

  const currentPlan = data.currentPlan
  const statusLabel =
    data.status === 'trial'
      ? `Trial - ${data.trialDaysRemaining} day${data.trialDaysRemaining !== 1 ? 's' : ''} remaining`
      : data.status === 'active'
        ? 'Active'
        : data.status === 'past_due'
          ? 'Past Due'
          : 'Cancelled'

  const statusColor =
    data.status === 'active'
      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
      : data.status === 'trial'
        ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
        : data.status === 'past_due'
          ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
          : 'bg-red-500/20 text-red-400 border-red-500/30'

  // Plan limits for usage bars
  function getPlanLimits(slug: string | undefined) {
    switch (slug) {
      case 'starter':
        return { players: 50, classes: 3 }
      case 'pro':
        return { players: 200, classes: Infinity }
      case 'enterprise':
        return { players: Infinity, classes: Infinity }
      default:
        return { players: 50, classes: 3 } // trial defaults to starter limits
    }
  }

  const limits = getPlanLimits(currentPlan?.slug)

  return (
    <div className="space-y-6">
      {/* Current Plan Card - Dark Glass */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-gray-900/95 via-gray-800/95 to-gray-900/95 backdrop-blur-xl p-6 shadow-2xl">
        {/* Glow effect */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-accent/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative space-y-5">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">Platform Plan</h3>
              <p className="text-sm text-gray-400 mt-0.5">
                {currentPlan ? currentPlan.name : 'No plan selected'}
              </p>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold border ${statusColor}`}
            >
              {statusLabel}
            </span>
          </div>

          {/* Plan details */}
          {currentPlan && (
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">
                  Monthly Price
                </p>
                <p className="text-2xl font-bold text-white mt-1">
                  &pound;{Number(currentPlan.monthly_price).toFixed(0)}
                  <span className="text-sm font-normal text-gray-500">/mo</span>
                </p>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">
                  Transaction Fee
                </p>
                <p className="text-2xl font-bold text-white mt-1">
                  {Number(currentPlan.transaction_fee_percent) === 0
                    ? '0%'
                    : `${Number(currentPlan.transaction_fee_percent)}%`}
                </p>
              </div>
            </div>
          )}

          {/* Usage bars */}
          <div className="space-y-3">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">
              Usage
            </p>
            <UsageBar
              label="Players"
              used={usage.players}
              limit={limits.players}
            />
            <UsageBar
              label="Classes"
              used={usage.classes}
              limit={limits.classes}
            />
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3 pt-2">
            <button
              onClick={() => setShowPlans(!showPlans)}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-accent text-white hover:opacity-90 transition-all"
            >
              {showPlans ? 'Hide Plans' : 'Change Plan'}
            </button>
            {data.hasSubscription && (
              <button
                onClick={handleManageBilling}
                disabled={subscribing === 'manage'}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-white/10 text-white border border-white/20 hover:bg-white/20 disabled:opacity-50 transition-all"
              >
                {subscribing === 'manage' ? 'Loading...' : 'Manage Billing'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Plan Selection */}
      {showPlans && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {data.allPlans.map((plan) => {
            const isCurrentPlan = currentPlan?.id === plan.id
            const features: string[] =
              typeof plan.features === 'string'
                ? JSON.parse(plan.features)
                : plan.features || []
            const isPro = plan.slug === 'pro'

            return (
              <div
                key={plan.id}
                className={`relative overflow-hidden rounded-2xl border p-5 transition-all ${
                  isPro
                    ? 'border-accent/50 bg-gradient-to-br from-gray-900/95 via-gray-800/95 to-gray-900/95 shadow-xl shadow-accent/10'
                    : 'border-white/10 bg-gradient-to-br from-gray-900/90 to-gray-800/90'
                }`}
              >
                {isPro && (
                  <div className="absolute top-0 right-0 bg-accent text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl">
                    POPULAR
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <h4 className="text-base font-bold text-white">{plan.name}</h4>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-3xl font-bold text-white">
                        &pound;{Number(plan.monthly_price).toFixed(0)}
                      </span>
                      <span className="text-sm text-gray-500">/mo</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {Number(plan.transaction_fee_percent) === 0
                        ? 'No transaction fees'
                        : `${Number(plan.transaction_fee_percent)}% transaction fee`}
                    </p>
                  </div>

                  <ul className="space-y-2">
                    {features.map((feature, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-xs text-gray-300"
                      >
                        <svg
                          className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handleSubscribe(plan.slug)}
                    disabled={isCurrentPlan || subscribing === plan.slug}
                    className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${
                      isCurrentPlan
                        ? 'bg-white/5 text-gray-500 border border-white/10 cursor-default'
                        : isPro
                          ? 'bg-accent text-white hover:opacity-90 disabled:opacity-50'
                          : 'bg-white/10 text-white border border-white/20 hover:bg-white/20 disabled:opacity-50'
                    }`}
                  >
                    {isCurrentPlan
                      ? 'Current Plan'
                      : subscribing === plan.slug
                        ? 'Loading...'
                        : 'Select Plan'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function UsageBar({
  label,
  used,
  limit,
}: {
  label: string
  used: number
  limit: number
}) {
  const isUnlimited = !isFinite(limit)
  const percent = isUnlimited ? Math.min((used / 500) * 100, 100) : Math.min((used / limit) * 100, 100)
  const isNearLimit = !isUnlimited && percent >= 80
  const isOverLimit = !isUnlimited && used > limit

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">{label}</span>
        <span className="text-xs font-medium text-gray-300">
          {used} / {isUnlimited ? 'Unlimited' : limit}
        </span>
      </div>
      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            isOverLimit
              ? 'bg-red-500'
              : isNearLimit
                ? 'bg-amber-500'
                : 'bg-accent'
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
