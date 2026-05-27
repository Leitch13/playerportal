'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Plan {
  id: string
  name: string
  description: string | null
  amount: number
  sessions_per_week: number
}

export default function PricingToggle({
  plans,
  slug,
  primaryColor,
  quarterlyEnabled = true,
  quarterlyDiscountPercent = 10,
}: {
  plans: Plan[]
  slug: string
  primaryColor: string
  quarterlyEnabled?: boolean
  quarterlyDiscountPercent?: number
}) {
  const [billing, setBilling] = useState<'monthly' | 'quarterly'>('monthly')
  const discountRate = Math.max(0, Math.min(50, quarterlyDiscountPercent)) / 100

  // Find the lowest-priced plan — usually the best starting point
  const sortedByPrice = [...plans].sort((a, b) => a.amount - b.amount)
  // "Most Popular" = mid-tier (second cheapest) if there are 3+ plans, otherwise cheapest
  const popularPlanId = plans.length >= 3 ? sortedByPrice[1]?.id : sortedByPrice[0]?.id

  // If the academy has disabled quarterly or set discount to 0, don't show the toggle
  const showQuarterlyToggle = quarterlyEnabled && discountRate > 0

  return (
    <div>
      {/* Billing Toggle (only shown if academy enables quarterly + has a discount) */}
      {showQuarterlyToggle && (
      <div className="flex justify-center mb-8">
        <div className="bg-[#1a1a1a] rounded-full p-1 inline-flex">
          <button
            onClick={() => setBilling('monthly')}
            className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all ${
              billing === 'monthly'
                ? 'text-white'
                : 'text-white/50 hover:text-white/70'
            }`}
            style={billing === 'monthly' ? { backgroundColor: primaryColor, color: '#0a0a0a' } : undefined}
          >
            Pay Monthly
          </button>
          <button
            onClick={() => setBilling('quarterly')}
            className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all relative ${
              billing === 'quarterly'
                ? 'text-white'
                : 'text-white/50 hover:text-white/70'
            }`}
            style={billing === 'quarterly' ? { backgroundColor: primaryColor, color: '#0a0a0a' } : undefined}
          >
            Pay 3 Months
            <span className="absolute -top-2 -right-2 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
              Save {Math.round(discountRate * 100)}%
            </span>
          </button>
        </div>
      </div>
      )}

      {/* Plan Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 items-stretch">
        {plans.map((plan) => {
          const monthly = plan.amount
          const quarterlyTotal = monthly * 3
          const quarterlyDiscounted = quarterlyTotal * (1 - discountRate)
          const saving = quarterlyTotal - quarterlyDiscounted
          const isPopular = plan.id === popularPlanId

          return (
            <div
              key={plan.id}
              className={`relative rounded-2xl border bg-[#141414] p-6 flex flex-col transition-all ${
                isPopular
                  ? 'border-2 shadow-xl'
                  : 'border-[#1e1e1e] hover:border-[#2a2a2a]'
              }`}
              style={isPopular ? { borderColor: primaryColor, boxShadow: `0 8px 40px ${primaryColor}20` } : undefined}
            >
              {isPopular && (
                <span
                  className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                  style={{ backgroundColor: primaryColor, color: '#0a0a0a' }}
                >
                  Most Popular
                </span>
              )}

              {/* Title + description */}
              <div className="text-center mb-4">
                <h3 className="text-lg font-bold text-white capitalize">{plan.name}</h3>
                <p className="text-xs text-white/50 mt-1 min-h-[2.5rem]">
                  {plan.description || ((!plan.sessions_per_week || plan.sessions_per_week >= 7)
                    ? 'Unlimited sessions per week'
                    : `${plan.sessions_per_week} session${plan.sessions_per_week !== 1 ? 's' : ''} per week`)}
                </p>
              </div>

              {/* Price */}
              <div className="text-center my-2">
                {billing === 'monthly' ? (
                  <>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-4xl font-extrabold text-white">&pound;{monthly.toFixed(0)}</span>
                      <span className="text-sm text-white/50">/month</span>
                    </div>
                    <p className="text-[11px] text-white/40 mt-2">
                      {showQuarterlyToggle ? <>Or &pound;{quarterlyDiscounted.toFixed(0)} quarterly (save &pound;{saving.toFixed(0)})</> : <>Cancel anytime</>}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex items-baseline justify-center gap-2">
                      <span className="text-4xl font-extrabold text-emerald-400">&pound;{quarterlyDiscounted.toFixed(0)}</span>
                      <span className="text-sm text-white/30 line-through">&pound;{quarterlyTotal.toFixed(0)}</span>
                    </div>
                    <p className="text-[11px] text-emerald-400 font-semibold mt-2">
                      Save &pound;{saving.toFixed(0)} · &pound;{(quarterlyDiscounted / 3).toFixed(0)}/month effective
                    </p>
                  </>
                )}
              </div>

              {/* Details pushed to bottom */}
              <div className="flex-1" />

              <ul className="space-y-1.5 text-xs text-white/60 mb-5">
                <li className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {(!plan.sessions_per_week || plan.sessions_per_week >= 7)
                    ? 'Unlimited sessions'
                    : `${plan.sessions_per_week} session${plan.sessions_per_week !== 1 ? 's' : ''} per week`}
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {billing === 'monthly' ? 'Auto-renews monthly' : 'One payment for 3 months'}
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Cancel anytime
                </li>
              </ul>

              <Link
                href={`/auth/signup?org=${slug}&plan=${plan.id}&billing=${billing}`}
                className="block w-full text-center py-5 rounded-xl font-extrabold text-lg transition-all hover:scale-[1.03] active:scale-[0.97] hover:brightness-110"
                style={{
                  background: `linear-gradient(135deg, #ffffff 0%, #e8f9fc 100%)`,
                  color: '#0a0a0a',
                  boxShadow: isPopular
                    ? `0 12px 48px ${primaryColor}80, 0 0 0 3px ${primaryColor}, inset 0 -3px 0 rgba(0,0,0,0.08)`
                    : `0 8px 32px ${primaryColor}50, 0 0 0 2px ${primaryColor}80, inset 0 -3px 0 rgba(0,0,0,0.06)`,
                }}
              >
                {billing === 'quarterly' ? `Start — Save ${Math.round(discountRate * 100)}% →` : 'Get Started →'}
              </Link>
            </div>
          )
        })}
      </div>

      {billing === 'quarterly' && (
        <p className="text-center text-sm text-emerald-400 font-medium mt-6">
          💰 Pay upfront for 3 months and save 10% on every plan.
        </p>
      )}
    </div>
  )
}
