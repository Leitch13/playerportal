export interface TimelineItem {
  type: 'review' | 'attendance' | 'achievement' | 'note'
  date: string
  title: string
  subtitle?: string
  icon: string
  color: string
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
              i % 2 === 0 ? 'bg-surface-dark/50' : ''
            }`}
          >
            {/* Icon circle */}
            <div
              className="relative z-10 flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg border-2 border-white"
              style={{ backgroundColor: item.color }}
            >
              {item.icon}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pt-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-medium text-text truncate">
                  {item.title}
                </p>
                <time className="text-xs text-text-light flex-shrink-0">
                  {new Date(item.date).toLocaleDateString()}
                </time>
              </div>
              {item.subtitle && (
                <p className="text-xs text-text-light mt-0.5 line-clamp-2">
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
