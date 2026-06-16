'use client'

// Phase 1A — Membership & Billing reskin tab shell. Pure presentation: a
// client component that toggles which server-rendered panel is visible. All
// three panels are rendered into the DOM and inactive ones are `hidden`, so
// every protected testid in the Overview panel stays present in the markup
// regardless of the active tab. No data fetching, no Stripe, no mutation —
// it only flips local UI state.

import { useState } from 'react'

type TabId = 'overview' | 'history' | 'payments'

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'history', label: 'Billing History' },
  { id: 'payments', label: 'Payment Methods' },
]

export default function MembershipTabs({
  overview,
  billingHistory,
  paymentMethods,
}: {
  overview: React.ReactNode
  billingHistory: React.ReactNode
  paymentMethods: React.ReactNode
}) {
  const [tab, setTab] = useState<TabId>('overview')

  return (
    <div className="space-y-4 sm:space-y-6">
      <div
        role="tablist"
        aria-label="Membership sections"
        className="inline-flex rounded-xl border border-white/10 bg-[#141414] p-1 text-sm"
      >
        {TABS.map((t) => {
          const active = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={`rounded-lg px-3 py-1.5 font-semibold transition-colors ${
                active ? 'bg-[#4ecde6] text-[#0a0a0a]' : 'text-white/60 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {/* All panels stay in the DOM; inactive ones are hidden so protected
          testids in Overview remain present in the server markup. */}
      <div hidden={tab !== 'overview'}>{overview}</div>
      <div hidden={tab !== 'history'}>{billingHistory}</div>
      <div hidden={tab !== 'payments'}>{paymentMethods}</div>
    </div>
  )
}
