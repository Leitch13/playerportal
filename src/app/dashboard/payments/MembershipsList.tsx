'use client'

import { useMemo, useState } from 'react'
import type { SubscriptionPlan } from '@/lib/types'
import SubscriptionActions from './SubscriptionActions'

// Oct 2026 — the calm Payments page. One row per membership: who, which plan,
// how much, when the next payment is, and one pill. Search and four tabs sit
// on top. Every action is the same SubscriptionActions as before; this file
// only decides what is shown.

export interface MembershipRow {
  id: string
  status: string
  planId: string
  parentName: string
  playerName: string | null
  planName: string
  amount: number | null
  nextLabel: string | null
  endsLabel: string | null
}

type Tab = 'paying' | 'problem' | 'paused' | 'ended' | 'all'

function tabOf(status: string): Exclude<Tab, 'all'> | 'other' {
  if (status === 'active' || status === 'trialing' || status === 'scheduled') return 'paying'
  if (status === 'past_due' || status === 'incomplete' || status === 'unpaid') return 'problem'
  if (status === 'paused') return 'paused'
  if (status === 'canceled' || status === 'cancelled') return 'ended'
  return 'other'
}

function pill(status: string): { label: string; cls: string } {
  const quiet = 'border-[#293b58] text-[#93a2ba]'
  switch (status) {
    case 'active': return { label: 'Paying', cls: 'border-[#67c79a]/40 text-[#67c79a]' }
    case 'trialing': return { label: 'Paying', cls: 'border-[#67c79a]/40 text-[#67c79a]' }
    case 'scheduled': return { label: 'Starts soon', cls: quiet }
    case 'paused': return { label: 'Paused', cls: quiet }
    case 'past_due': return { label: 'Payment problem', cls: 'border-[#e0736d]/50 text-[#e0736d]' }
    case 'unpaid': return { label: 'Payment problem', cls: 'border-[#e0736d]/50 text-[#e0736d]' }
    case 'incomplete': return { label: 'Not finished paying', cls: 'border-[#d8a95a]/50 text-[#d8a95a]' }
    case 'pending_migration': return { label: 'Invite not confirmed', cls: 'border-[#d8a95a]/50 text-[#d8a95a]' }
    case 'canceled':
    case 'cancelled': return { label: 'Ended', cls: quiet }
    default: return { label: status.replace(/_/g, ' '), cls: quiet }
  }
}

function initials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase() || '').join('') || '—'
}

export default function MembershipsList({ rows, plans }: { rows: MembershipRow[]; plans: SubscriptionPlan[] }) {
  const counts = useMemo(() => {
    const c = { paying: 0, problem: 0, paused: 0, ended: 0, all: rows.length }
    for (const r of rows) { const t = tabOf(r.status); if (t !== 'other') c[t]++ }
    return c
  }, [rows])
  const [tab, setTab] = useState<Tab>(counts.paying > 0 ? 'paying' : 'all')
  const [q, setQ] = useState('')

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return rows.filter((r) => {
      if (tab !== 'all' && tabOf(r.status) !== tab) return false
      if (!needle) return true
      return `${r.parentName} ${r.playerName || ''} ${r.planName}`.toLowerCase().includes(needle)
    })
  }, [rows, tab, q])

  const tabs: Array<{ key: Tab; label: string }> = [
    { key: 'paying', label: 'Paying' },
    { key: 'problem', label: 'Payment problem' },
    { key: 'paused', label: 'Paused' },
    { key: 'ended', label: 'Ended' },
    { key: 'all', label: 'All' },
  ]

  return (
    <section aria-label="Memberships" className="rounded-[15px] border border-[#1d2c42] bg-[#0f1a2b]" data-testid="memberships-list">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1d2c42] p-4 sm:px-5">
        <h2 className="text-[15px] font-semibold text-[#eef2f9]">Memberships</h2>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search a parent, child or plan"
          aria-label="Search memberships"
          className="w-full rounded-[10px] border border-[#293b58] bg-[#080e18] px-3 py-2 text-sm text-[#eef2f9] placeholder:text-[#5b6c86] focus:border-[#4ecde6] focus:outline-none sm:w-72"
        />
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-[#1d2c42] px-4 py-3 sm:px-5" role="tablist">
        {tabs.filter((t) => t.key === 'all' || t.key === 'paying' || counts[t.key] > 0).map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              tab === t.key ? 'bg-[#4ecde6] text-[#04141a]' : 'border border-[#293b58] text-[#93a2ba] hover:text-[#eef2f9]'
            }`}
          >
            {t.label} <span className="tabular-nums opacity-80">{counts[t.key]}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-[#93a2ba]">
          {q ? 'Nobody matches that search.' : 'Nothing here.'}
        </p>
      ) : (
        <ul className="divide-y divide-[#1d2c42]">
          {shown.map((r) => {
            const p = pill(r.status)
            return (
              <li key={r.id} className="flex flex-col gap-3 px-4 py-3.5 sm:px-5 lg:flex-row lg:items-start lg:gap-4">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#293b58] bg-[#142236] text-xs font-semibold text-[#93a2ba]" aria-hidden>
                    {initials(r.parentName)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#eef2f9]">
                      {r.parentName || '—'}
                      {r.playerName && <span className="font-normal text-[#93a2ba]"> · {r.playerName}</span>}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-[#93a2ba]">
                      {r.planName}
                      {r.amount != null && <> · <span className="tabular-nums text-[#eef2f9]">£{r.amount.toFixed(r.amount % 1 ? 2 : 0)}</span> a month</>}
                      {r.endsLabel ? <> · ends {r.endsLabel}</> : r.nextLabel ? <> · next payment {r.nextLabel}</> : null}
                    </p>
                  </div>
                </div>
                <span className={`inline-flex w-fit shrink-0 items-center rounded-full border px-2.5 py-0.5 lg:mt-1.5 text-xs font-medium ${p.cls}`}>{p.label}</span>
                <div className="lg:w-[340px] lg:shrink-0">
                  <SubscriptionActions subscriptionId={r.id} currentStatus={r.status} currentPlanId={r.planId} plans={plans} />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
