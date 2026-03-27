'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'

/* ── Types ── */
type AcademyRow = {
  id: string
  name: string
  slug: string
  plan: string
  status: string
  players: number
  parents: number
  classes: number
  monthlyRevenue: number
  txFees: number
  trialEnds: string | null
  createdAt: string
}

type MonthlyRevenue = { month: string; subscriptions: number; fees: number }

type Props = {
  mrr: number
  totalAcademies: number
  totalPlayers: number
  totalParents: number
  txFeesThisMonth: number
  monthlyRevenue: MonthlyRevenue[]
  academyRows: AcademyRow[]
  newOrgsThisMonth: number
  newOrgsLastMonth: number
  churnRate: number
  avgRevenuePerAcademy: number
  totalPaymentsThisMonth: number
  recentSignups: { name: string; date: string; status: string }[]
  atRisk: {
    trialEndingSoon: { name: string; trialEnds: string }[]
    pastDue: { name: string }[]
    inactive: { name: string }[]
  }
}

/* ── Helpers ── */
function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n)
}
function formatDate(s: string) {
  return new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const statusColors: Record<string, string> = {
  trial: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  past_due: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
}

type SortKey = 'name' | 'plan' | 'status' | 'players' | 'parents' | 'classes' | 'monthlyRevenue' | 'txFees' | 'createdAt'

export default function PlatformDashboard({
  mrr, totalAcademies, totalPlayers, totalParents, txFeesThisMonth,
  monthlyRevenue, academyRows, newOrgsThisMonth, newOrgsLastMonth,
  churnRate, avgRevenuePerAcademy, totalPaymentsThisMonth,
  recentSignups, atRisk,
}: Props) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const filteredRows = useMemo(() => {
    let rows = academyRows.filter(r =>
      r.name.toLowerCase().includes(search.toLowerCase())
    )
    rows.sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      }
      return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number)
    })
    return rows
  }, [academyRows, search, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sortArrow = (key: SortKey) => sortKey === key ? (sortDir === 'asc' ? ' \u2191' : ' \u2193') : ''

  /* ── Revenue Chart (pure SVG) ── */
  const maxRev = Math.max(...monthlyRevenue.map(m => m.subscriptions + m.fees), 1)
  const chartW = 600
  const chartH = 200
  const barW = 60
  const gap = (chartW - barW * monthlyRevenue.length) / (monthlyRevenue.length + 1)

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-[#0a0a0a]/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Platform Admin</h1>
              <p className="text-xs text-white/40">theplayerportal.net</p>
            </div>
          </div>
          <Link
            href="/dashboard"
            className="text-sm text-white/50 hover:text-white transition-colors flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* ── Hero Stats ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Monthly Recurring Revenue" value={formatCurrency(mrr)} accent="text-emerald-400" />
          <StatCard label="Active Academies" value={totalAcademies.toString()} accent="text-[#4ecde6]" />
          <StatCard label="Total Players" value={totalPlayers.toLocaleString()} accent="text-violet-400" />
          <StatCard label="Tx Fee Revenue (Month)" value={formatCurrency(txFeesThisMonth)} accent="text-amber-400" />
        </div>

        {/* ── Revenue Chart ── */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-6">
          <h2 className="text-sm font-semibold text-white/70 mb-4">Revenue — Last 6 Months</h2>
          <div className="overflow-x-auto">
            <svg viewBox={`0 0 ${chartW} ${chartH + 30}`} className="w-full max-w-[600px] mx-auto" preserveAspectRatio="xMidYMid meet">
              {/* Grid lines */}
              {[0, 0.25, 0.5, 0.75, 1].map(f => (
                <line key={f} x1={0} y1={chartH * (1 - f)} x2={chartW} y2={chartH * (1 - f)} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
              ))}
              {monthlyRevenue.map((m, i) => {
                const x = gap + i * (barW + gap)
                const totalH = ((m.subscriptions + m.fees) / maxRev) * chartH
                const subH = (m.subscriptions / maxRev) * chartH
                const feeH = totalH - subH
                return (
                  <g key={i}>
                    {/* Subscription bar */}
                    <rect x={x} y={chartH - totalH} width={barW} height={subH} rx={4} fill="#4ecde6" opacity={0.8} />
                    {/* Fee bar stacked on top */}
                    <rect x={x} y={chartH - feeH} width={barW} height={feeH} rx={4} fill="#f59e0b" opacity={0.7} />
                    {/* Label */}
                    <text x={x + barW / 2} y={chartH + 16} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize={11}>{m.month}</text>
                    {/* Value */}
                    <text x={x + barW / 2} y={chartH - totalH - 6} textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize={10}>
                      {formatCurrency(m.subscriptions + m.fees)}
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>
          <div className="flex items-center gap-6 mt-4 justify-center text-xs text-white/50">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#4ecde6]" /> Subscriptions</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-500" /> Transaction Fees</span>
          </div>
        </section>

        {/* ── Academies Table ── */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h2 className="text-sm font-semibold text-white/70">All Academies ({academyRows.length})</h2>
            <input
              type="text"
              placeholder="Search academies..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#4ecde6]/50 w-full sm:w-64"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-white/40 text-xs border-b border-white/10">
                  <th className="pb-2 pr-4 cursor-pointer hover:text-white/70" onClick={() => toggleSort('name')}>Academy{sortArrow('name')}</th>
                  <th className="pb-2 pr-4 cursor-pointer hover:text-white/70" onClick={() => toggleSort('plan')}>Plan{sortArrow('plan')}</th>
                  <th className="pb-2 pr-4 cursor-pointer hover:text-white/70" onClick={() => toggleSort('status')}>Status{sortArrow('status')}</th>
                  <th className="pb-2 pr-4 cursor-pointer hover:text-white/70 text-right" onClick={() => toggleSort('players')}>Players{sortArrow('players')}</th>
                  <th className="pb-2 pr-4 cursor-pointer hover:text-white/70 text-right hidden md:table-cell" onClick={() => toggleSort('parents')}>Parents{sortArrow('parents')}</th>
                  <th className="pb-2 pr-4 cursor-pointer hover:text-white/70 text-right hidden lg:table-cell" onClick={() => toggleSort('classes')}>Classes{sortArrow('classes')}</th>
                  <th className="pb-2 pr-4 cursor-pointer hover:text-white/70 text-right hidden md:table-cell" onClick={() => toggleSort('monthlyRevenue')}>Revenue{sortArrow('monthlyRevenue')}</th>
                  <th className="pb-2 pr-4 cursor-pointer hover:text-white/70 text-right hidden lg:table-cell" onClick={() => toggleSort('txFees')}>Tx Fees{sortArrow('txFees')}</th>
                  <th className="pb-2 pr-4 text-right hidden xl:table-cell">Trial Ends</th>
                  <th className="pb-2 cursor-pointer hover:text-white/70 text-right" onClick={() => toggleSort('createdAt')}>Created{sortArrow('createdAt')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map(r => (
                  <tr key={r.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td className="py-2.5 pr-4 font-medium text-white/90">{r.name}</td>
                    <td className="py-2.5 pr-4 text-white/60">{r.plan}</td>
                    <td className="py-2.5 pr-4">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium border ${statusColors[r.status] || 'bg-white/10 text-white/50 border-white/10'}`}>
                        {r.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-right text-white/60">{r.players}</td>
                    <td className="py-2.5 pr-4 text-right text-white/60 hidden md:table-cell">{r.parents}</td>
                    <td className="py-2.5 pr-4 text-right text-white/60 hidden lg:table-cell">{r.classes}</td>
                    <td className="py-2.5 pr-4 text-right text-white/60 hidden md:table-cell">{formatCurrency(r.monthlyRevenue)}</td>
                    <td className="py-2.5 pr-4 text-right text-white/60 hidden lg:table-cell">{formatCurrency(r.txFees)}</td>
                    <td className="py-2.5 pr-4 text-right text-white/40 text-xs hidden xl:table-cell">{r.trialEnds ? formatDate(r.trialEnds) : '-'}</td>
                    <td className="py-2.5 text-right text-white/40 text-xs">{formatDate(r.createdAt)}</td>
                  </tr>
                ))}
                {filteredRows.length === 0 && (
                  <tr><td colSpan={10} className="py-8 text-center text-white/30">No academies found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Growth Metrics + Recent Activity ── */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Growth */}
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-6">
            <h2 className="text-sm font-semibold text-white/70 mb-4">Growth Metrics</h2>
            <div className="space-y-3">
              <MetricRow label="New academies this month" value={newOrgsThisMonth.toString()} sub={newOrgsLastMonth > 0 ? `vs ${newOrgsLastMonth} last month` : undefined} />
              <MetricRow label="Churn rate" value={`${churnRate}%`} alert={churnRate > 5} />
              <MetricRow label="Avg revenue per academy" value={formatCurrency(avgRevenuePerAcademy)} />
              <MetricRow label="Parent payments processed" value={formatCurrency(totalPaymentsThisMonth)} sub="this month" />
              <MetricRow label="Total parents" value={totalParents.toLocaleString()} />
            </div>
          </section>

          {/* Recent Activity */}
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-6">
            <h2 className="text-sm font-semibold text-white/70 mb-4">Recent Activity</h2>
            {recentSignups.length === 0 ? (
              <p className="text-white/30 text-sm">No recent activity</p>
            ) : (
              <div className="space-y-2.5">
                {recentSignups.map((s, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#4ecde6]" />
                      <span className="text-sm text-white/80">{s.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full border ${statusColors[s.status] || 'bg-white/10 text-white/50 border-white/10'}`}>
                        {s.status.replace('_', ' ')}
                      </span>
                      <span className="text-xs text-white/30">{formatDate(s.date)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* ── At-Risk Academies ── */}
        <section className="rounded-2xl border border-red-500/20 bg-red-500/[0.03] backdrop-blur-sm p-6">
          <h2 className="text-sm font-semibold text-red-400/80 mb-4 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            At-Risk Academies
          </h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {/* Trial ending soon */}
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-amber-400/70 uppercase tracking-wider">Trial Ending (&lt; 3 days)</h3>
              {atRisk.trialEndingSoon.length === 0 ? (
                <p className="text-xs text-white/20">None</p>
              ) : (
                atRisk.trialEndingSoon.map((a, i) => (
                  <div key={i} className="text-sm text-white/60 flex justify-between">
                    <span>{a.name}</span>
                    <span className="text-xs text-amber-400/60">{formatDate(a.trialEnds)}</span>
                  </div>
                ))
              )}
            </div>
            {/* Past due */}
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-red-400/70 uppercase tracking-wider">Past Due</h3>
              {atRisk.pastDue.length === 0 ? (
                <p className="text-xs text-white/20">None</p>
              ) : (
                atRisk.pastDue.map((a, i) => (
                  <div key={i} className="text-sm text-white/60">{a.name}</div>
                ))
              )}
            </div>
            {/* Inactive */}
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider">No Players (Inactive)</h3>
              {atRisk.inactive.length === 0 ? (
                <p className="text-xs text-white/20">None</p>
              ) : (
                atRisk.inactive.map((a, i) => (
                  <div key={i} className="text-sm text-white/60">{a.name}</div>
                ))
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

/* ── Sub-components ── */
function StatCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-5">
      <p className="text-xs text-white/40 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accent}`}>{value}</p>
    </div>
  )
}

function MetricRow({ label, value, sub, alert }: { label: string; value: string; sub?: string; alert?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
      <span className="text-sm text-white/50">{label}</span>
      <div className="text-right">
        <span className={`text-sm font-semibold ${alert ? 'text-red-400' : 'text-white/80'}`}>{value}</span>
        {sub && <p className="text-[11px] text-white/30">{sub}</p>}
      </div>
    </div>
  )
}
