'use client'

interface SmartInsightsProps {
  attendanceRate: number
  monthlyRevenue: number
  prevRevenue: number
  totalPlayers: number
  newLeadsThisWeek: number
  overdueCount: number
  todaysSessionCount: number
}

type InsightType = 'positive' | 'attention' | 'urgent'

interface Insight {
  type: InsightType
  text: string
  actionLabel?: string
  actionHref?: string
}

const borderColors: Record<InsightType, string> = {
  positive: 'border-l-emerald-500',
  attention: 'border-l-amber-500',
  urgent: 'border-l-red-500',
}

const icons: Record<InsightType, React.ReactNode> = {
  positive: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  attention: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
  urgent: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
}

function generateInsights(props: SmartInsightsProps): Insight[] {
  const insights: Insight[] = []

  // Attendance insights
  if (props.attendanceRate < 70) {
    insights.push({
      type: 'urgent',
      text: 'Attendance has dipped below 70%. Consider sending a re-engagement message to absent players.',
      actionLabel: 'Send message',
      actionHref: '/dashboard/messages',
    })
  } else if (props.attendanceRate > 90) {
    insights.push({
      type: 'positive',
      text: 'Outstanding attendance this month! Your players are loving it.',
    })
  }

  // Revenue insights
  if (props.prevRevenue > 0) {
    if (props.monthlyRevenue > props.prevRevenue * 1.1) {
      const pct = Math.round(((props.monthlyRevenue - props.prevRevenue) / props.prevRevenue) * 100)
      insights.push({
        type: 'positive',
        text: `Revenue is up ${pct}% this month. Great growth!`,
      })
    } else if (props.monthlyRevenue < props.prevRevenue * 0.9) {
      insights.push({
        type: 'attention',
        text: 'Revenue is down this month. Consider running a promotion or re-engaging lapsed parents.',
        actionLabel: 'View payments',
        actionHref: '/dashboard/payments',
      })
    }
  }

  // Overdue payments
  if (props.overdueCount > 3) {
    insights.push({
      type: 'urgent',
      text: `${props.overdueCount} overdue payments need attention. Send payment reminders today.`,
      actionLabel: 'View overdue',
      actionHref: '/dashboard/payments',
    })
  }

  // Leads insights
  if (props.newLeadsThisWeek > 0) {
    insights.push({
      type: 'positive',
      text: `${props.newLeadsThisWeek} new lead${props.newLeadsThisWeek === 1 ? '' : 's'} this week — make sure to follow up within 24 hours for best conversion.`,
      actionLabel: 'View leads',
      actionHref: '/dashboard/leads',
    })
  } else {
    insights.push({
      type: 'attention',
      text: 'No new leads this week. Consider running a Facebook ad or sharing your booking link.',
    })
  }

  // Today's sessions
  if (props.todaysSessionCount === 0) {
    insights.push({
      type: 'attention',
      text: 'No sessions today — great time to review player progress and plan ahead.',
      actionLabel: 'Review players',
      actionHref: '/dashboard/players',
    })
  }

  // Return top 3 insights
  const priority: Record<InsightType, number> = { urgent: 0, attention: 1, positive: 2 }
  insights.sort((a, b) => priority[a.type] - priority[b.type])
  return insights.slice(0, 3)
}

export default function SmartInsights(props: SmartInsightsProps) {
  const insights = generateInsights(props)

  if (insights.length === 0) return null

  return (
    <div className="space-y-2">
      <p className="text-xs text-white/40 font-medium uppercase tracking-wider mb-3">Smart Insights</p>
      {insights.map((insight, i) => (
        <div
          key={i}
          className={`bg-[#141414] border border-[#1e1e1e] border-l-[3px] ${borderColors[insight.type]} rounded-xl px-4 py-3 flex items-start gap-3`}
        >
          <div className="mt-0.5 shrink-0">{icons[insight.type]}</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white/80 leading-snug">{insight.text}</p>
            {insight.actionLabel && insight.actionHref && (
              <a
                href={insight.actionHref}
                className="inline-block mt-1.5 text-xs font-medium text-[#4ecde6] hover:text-[#4ecde6]/80 transition-colors"
              >
                {insight.actionLabel} &rarr;
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
