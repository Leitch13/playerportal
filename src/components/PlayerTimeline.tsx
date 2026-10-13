export interface TimelineItem {
  type: 'review' | 'attendance' | 'achievement' | 'note'
  date: string
  title: string
  subtitle?: string
  icon: string
  color: string
}

const TIMELINE_ICON: Record<TimelineItem['type'], string> = {
  review: 'M9 12h6m-6 4h6M7 3h7l5 5v11a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z',
  attendance: 'M6 6l12 12M18 6L6 18',
  achievement: 'M8 4h8v4a4 4 0 01-8 0V4zm4 8v4m-3 4h6M5 5H3v2a3 3 0 003 3m13-5h2v2a3 3 0 01-3 3',
  note: 'M4 20h4L19 9l-4-4L4 16v4z',
}

interface PlayerTimelineProps {
  items: TimelineItem[]
}

export default function PlayerTimeline({ items }: PlayerTimelineProps) {
  const displayItems = items.slice(0, 15)
  const hasMore = items.length > 15

  if (displayItems.length === 0) return null

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-5 top-3 bottom-3 w-0.5 bg-border" />

      <div className="space-y-0">
        {displayItems.map((item, i) => (
          <div
            key={`${item.type}-${item.date}-${i}`}
            className={`relative flex items-start gap-4 py-3 px-3 rounded-lg ${
              i % 2 === 0 ? 'bg-[#142236]/50' : ''
            }`}
          >
            {/* Icon circle */}
            {/* A line icon for the kind of event. The emoji this used to show looked out of place beside the rest of the app. */}
            <div
              className="relative z-10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-white/[0.1] bg-[#0f1a2b]"
              style={{ boxShadow: `inset 0 0 0 999px ${item.color}` }}
              data-testid="timeline-icon"
            >
              <svg className="h-4 w-4 text-white/85" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.9}><path strokeLinecap="round" strokeLinejoin="round" d={TIMELINE_ICON[item.type]} /></svg>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pt-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-medium text-[#eef2f9] truncate">
                  {item.title}
                </p>
                <time className="text-xs text-[#93a2ba] flex-shrink-0">
                  {new Date(item.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </time>
              </div>
              {item.subtitle && (
                <p className="text-xs text-[#93a2ba] mt-0.5 line-clamp-2">
                  {item.subtitle}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {hasMore && (
        <div className="text-center pt-3">
          <span className="text-sm text-primary hover:underline cursor-pointer">
            View more activity...
          </span>
        </div>
      )}
    </div>
  )
}
