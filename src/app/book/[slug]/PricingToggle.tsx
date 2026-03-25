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
}: {
  plans: Plan[]
  slug: string
  primaryColor: string
}) {
  const [billing, setBilling] = useState<'monthly' | 'quarterly'>('monthly')

  return (
    <div>
      {/* Billing Toggle */}
      <div className="flex justify-center mb-8">
        <div className="bg-gray-100 rounded-full p-1 inline-flex">
          <button
            onClick={() => setBilling('monthly')}
            className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all ${
              billing === 'monthly'
                ? 'bg-white shadow-sm text-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Pay Monthly
          </button>
          <button
            onClick={() => setBilling('quarterly')}
            className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all relative ${
              billing === 'quarterly'
                ? 'bg-white shadow-sm text-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Pay 3 Months
            <span className="absolute -top-2 -right-2 bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
              Save 10%
            </span>
          </button>
        </div>
      </div>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans.map((plan, i) => {
          const monthly = plan.amount
          const quarterlyTotal = monthly * 3
          const quarterlyDiscounted = quarterlyTotal * 0.9
          const saving = quarterlyTotal - quarterlyDiscounted

          return (
            <div
              key={plan.id}
              className={`rounded-2xl border-2 p-6 text-center transition-all ${
                i === 0 ? 'shadow-lg scale-105' : ''
              }`}
              style={i === 0 ? { borderColor: primaryColor } : { borderColor: '#e5e7eb' }}
            >
              {i === 0 && (
                <span
                  className="inline-block px-3 py-1 rounded-full text-xs font-bold text-white mb-3"
                  style={{ backgroundColor: primaryColor }}
                >
                  Most Popular
                </span>
              )}
              <h3 className="text-xl font-bold">{plan.name}</h3>
              {plan.description && (
                <p className="text-sm text-gray-500 mt-1">{plan.description}</p>
              )}

              {billing === 'monthly' ? (
                <div className="my-4">
                  <span className="text-4xl font-bold">&pound;{monthly.toFixed(0)}</span>
                  <span className="text-gray-500">/month</span>
                </div>
              ) : (
                <div className="my-4">
                  <div className="text-4xl font-bold text-green-600">
                    &pound;{quarterlyDiscounted.toFixed(0)}
                  </div>
                  <div className="text-sm text-gray-400 line-through">
                    &pound;{quarterlyTotal.toFixed(0)}
                  </div>
                  <div className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">
                    Save &pound;{saving.toFixed(0)}
                  </div>
                </div>
              )}

              <div className="text-sm text-gray-600 mb-2">
                {plan.sessions_per_week} session{plan.sessions_per_week !== 1 ? 's' : ''} per week
              </div>

              {billing === 'monthly' ? (
                <p className="text-xs text-gray-400 mb-4">
                  Auto-renews monthly · Pro-rated first month · Cancel anytime
                </p>
              ) : (
                <p className="text-xs text-gray-400 mb-4">
                  One payment for 3 months · 10% discount · Best value
                </p>
              )}

              <Link
                href={`/auth/signup?org=${slug}&plan=${plan.id}&billing=${billing}`}
                className="block w-full py-2.5 rounded-lg font-semibold text-white transition-all hover:opacity-90 hover:scale-[1.02]"
                style={{ backgroundColor: billing === 'quarterly' ? '#16a34a' : primaryColor }}
              >
                {billing === 'quarterly' ? 'Get 10% Off' : 'Get Started'}
              </Link>

              {billing === 'quarterly' && (
                <p className="text-[11px] text-green-600 font-medium mt-2">
                  &pound;{(quarterlyDiscounted / 3).toFixed(2)}/month effective rate
                </p>
              )}
            </div>
          )
        })}
      </div>

      {billing === 'quarterly' && (
        <p className="text-center text-sm text-green-600 font-medium mt-6">
          💰 Pay upfront for 3 months and save 10% on every plan!
        </p>
      )}
    </div>
  )
}
