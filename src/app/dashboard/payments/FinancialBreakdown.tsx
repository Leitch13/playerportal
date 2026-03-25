'use client'

interface MonthlyData {
  label: string
  monthKey: string
  subscriptionIncome: number
  oneOffIncome: number
  totalIncome: number
  newSignups: number
  churnedSubs: number
}

interface PlanBreakdown {
  name: string
  activeSubs: number
  monthlyValue: number
  percentage: number
}

interface ParentRevenue {
  name: string
  subscriptions: number
  oneOff: number
  total: number
}

interface Props {
  monthlyData: MonthlyData[]
  planBreakdown: PlanBreakdown[]
  topParents: ParentRevenue[]
  summary: {
    totalLifetimeRevenue: number
    monthlyRecurring: number
    projectedAnnual: number
    avgRevenuePerPlayer: number
    avgRevenuePerParent: number
    collectionRate: number
    activeParents: number
    totalParents: number
    churnRate: number
    growthRate: number
  }
}

export default function FinancialBreakdown({
  monthlyData,
  planBreakdown,
  topParents,
  summary,
}: Props) {
  const maxIncome = Math.max(...monthlyData.map((m) => m.totalIncome), 1)
  const maxSignups = Math.max(...monthlyData.map((m) => m.newSignups), 1)
  const chartHeight = 160

  return (
    <div className="space-y-6">
      {/* ─── Key Financial Metrics ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard
          label="Monthly Recurring"
          value={`£${summary.monthlyRecurring.toFixed(0)}`}
          subtext="per month"
          color="text-accent"
        />
        <MetricCard
          label="Projected Annual"
          value={`£${summary.projectedAnnual.toFixed(0)}`}
          subtext="at current rate"
          color="text-accent"
        />
        <MetricCard
          label="Lifetime Revenue"
          value={`£${summary.totalLifetimeRevenue.toFixed(0)}`}
          subtext="all time"
          color="text-primary"
        />
        <MetricCard
          label="Avg / Player"
          value={`£${summary.avgRevenuePerPlayer.toFixed(0)}`}
          subtext="per month"
          color="text-primary"
        />
        <MetricCard
          label="Collection Rate"
          value={`${summary.collectionRate}%`}
          subtext={`${summary.activeParents} of ${summary.totalParents} parents`}
          color={summary.collectionRate >= 90 ? 'text-accent' : summary.collectionRate >= 70 ? 'text-warning' : 'text-danger'}
        />
        <MetricCard
          label="Growth Rate"
          value={`${summary.growthRate >= 0 ? '+' : ''}${summary.growthRate}%`}
          subtext="month over month"
          color={summary.growthRate >= 0 ? 'text-accent' : 'text-danger'}
        />
      </div>

      {/* ─── Monthly Income Chart ─── */}
      <div className="bg-white dark:bg-surface-dark rounded-xl border border-border p-5">
        <h3 className="text-sm font-semibold mb-4">Monthly Income Breakdown</h3>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs mb-4">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-accent" />
            <span>Subscriptions</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-primary" />
            <span>One-off Payments</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-warning" />
            <span>New Signups</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div
            className="flex items-end gap-3"
            style={{ minWidth: Math.max(monthlyData.length * 80, 400), height: chartHeight + 60 }}
          >
            {monthlyData.map((month, i) => {
              const subH = (month.subscriptionIncome / maxIncome) * chartHeight
              const oneOffH = (month.oneOffIncome / maxIncome) * chartHeight
              const signupH = maxSignups > 0 ? (month.newSignups / maxSignups) * 30 : 0
              const isLatest = i === monthlyData.length - 1

              return (
                <div key={month.monthKey} className="flex-1 flex flex-col items-center gap-1">
                  {/* Income amount */}
                  <span className={`text-[10px] font-bold ${isLatest ? 'text-accent' : 'text-text-light'}`}>
                    £{month.totalIncome.toFixed(0)}
                  </span>

                  {/* Stacked bar */}
                  <div className="flex flex-col items-center" style={{ height: chartHeight }}>
                    <div className="flex-1" />
                    <div
                      className={`w-8 rounded-t ${isLatest ? 'bg-primary' : 'bg-primary/40'}`}
                      style={{ height: oneOffH }}
                      title={`One-off: £${month.oneOffIncome.toFixed(0)}`}
                    />
                    <div
                      className={`w-8 ${isLatest ? 'bg-accent' : 'bg-accent/40'}`}
                      style={{ height: subH }}
                      title={`Subscriptions: £${month.subscriptionIncome.toFixed(0)}`}
                    />
                  </div>

                  {/* Signup dot */}
                  <div className="flex items-center gap-0.5">
                    {month.newSignups > 0 && (
                      <div
                        className="rounded-full bg-warning"
                        style={{ width: Math.max(6, signupH), height: Math.max(6, signupH) }}
                        title={`${month.newSignups} new signups`}
                      />
                    )}
                  </div>

                  <span className="text-[10px] text-text-light whitespace-nowrap">{month.label}</span>
                  {month.newSignups > 0 && (
                    <span className="text-[9px] text-warning font-medium">+{month.newSignups}</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* ─── Plan Breakdown ─── */}
        <div className="bg-white dark:bg-surface-dark rounded-xl border border-border p-5">
          <h3 className="text-sm font-semibold mb-4">Revenue by Plan</h3>
          {planBreakdown.length === 0 ? (
            <p className="text-sm text-text-light">No active plans yet.</p>
          ) : (
            <div className="space-y-3">
              {planBreakdown.map((plan) => (
                <div key={plan.name}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{plan.name}</span>
                      <span className="text-xs text-text-light">{plan.activeSubs} subs</span>
                    </div>
                    <span className="text-sm font-bold text-accent">£{plan.monthlyValue.toFixed(0)}/mo</span>
                  </div>
                  <div className="w-full bg-surface-dark rounded-full h-2.5">
                    <div
                      className="h-2.5 rounded-full bg-accent transition-all"
                      style={{ width: `${plan.percentage}%` }}
                    />
                  </div>
                  <div className="text-right text-[10px] text-text-light mt-0.5">
                    {plan.percentage.toFixed(0)}% of recurring revenue
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ─── Revenue by Parent ─── */}
        <div className="bg-white dark:bg-surface-dark rounded-xl border border-border p-5">
          <h3 className="text-sm font-semibold mb-4">Top Parents by Revenue</h3>
          {topParents.length === 0 ? (
            <p className="text-sm text-text-light">No revenue data yet.</p>
          ) : (
            <div className="space-y-2">
              {topParents.map((parent, i) => (
                <div
                  key={parent.name}
                  className="flex items-center justify-between py-1.5 border-b border-border last:border-0"
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      i === 0 ? 'bg-accent/20 text-accent' : 'bg-surface-dark text-text-light'
                    }`}>
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium">{parent.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold">£{parent.total.toFixed(0)}</span>
                    <div className="flex gap-2 text-[10px] text-text-light">
                      {parent.subscriptions > 0 && <span>Subs: £{parent.subscriptions.toFixed(0)}</span>}
                      {parent.oneOff > 0 && <span>One-off: £{parent.oneOff.toFixed(0)}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── Parent Signup Funnel ─── */}
      <div className="bg-white dark:bg-surface-dark rounded-xl border border-border p-5">
        <h3 className="text-sm font-semibold mb-4">Signup & Conversion Funnel</h3>
        <div className="grid grid-cols-4 gap-2">
          <FunnelStep
            label="Signed Up"
            value={summary.totalParents}
            color="bg-primary/20 text-primary"
            width={100}
          />
          <FunnelStep
            label="Has Players"
            value={summary.activeParents}
            color="bg-accent/20 text-accent"
            width={summary.totalParents > 0 ? (summary.activeParents / summary.totalParents) * 100 : 0}
          />
          <FunnelStep
            label="Has Payments"
            value={topParents.length}
            color="bg-warning/20 text-warning"
            width={summary.totalParents > 0 ? (topParents.length / summary.totalParents) * 100 : 0}
          />
          <FunnelStep
            label="Subscribed"
            value={Math.round(summary.monthlyRecurring / Math.max(1, topParents.length > 0 ? topParents[0].subscriptions || 50 : 50))}
            color="bg-accent/30 text-accent"
            width={summary.totalParents > 0 ? (summary.monthlyRecurring > 0 ? 40 : 0) : 0}
          />
        </div>
      </div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  subtext,
  color,
}: {
  label: string
  value: string
  subtext: string
  color: string
}) {
  return (
    <div className="bg-white dark:bg-surface-dark rounded-xl border border-border p-3 text-center">
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      <div className="text-xs font-medium mt-0.5">{label}</div>
      <div className="text-[10px] text-text-light">{subtext}</div>
    </div>
  )
}

function FunnelStep({
  label,
  value,
  color,
  width,
}: {
  label: string
  value: number
  color: string
  width: number
}) {
  return (
    <div className="text-center">
      <div className={`mx-auto rounded-lg py-3 px-2 ${color}`} style={{ width: `${Math.max(60, width)}%` }}>
        <div className="text-lg font-bold">{value}</div>
      </div>
      <div className="text-[10px] text-text-light mt-1 font-medium">{label}</div>
    </div>
  )
}
