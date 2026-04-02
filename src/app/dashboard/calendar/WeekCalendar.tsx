'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import type { CalendarGroup } from './page'

/* ═══════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════ */

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

const START_HOUR = 8
const END_HOUR = 21
const SLOT_HEIGHT = 60 // px per hour
const HALF_SLOT = SLOT_HEIGHT / 2

const CLASS_TYPE_COLORS: Record<string, string> = {
  development: '#4ecde6',
  advanced: '#a855f7',
  tots: '#f97316',
  girls: '#ec4899',
  goalkeeper: '#22c55e',
  elite: '#eab308',
  disability: '#06b6d4',
  holiday_camp: '#f43f5e',
}
const DEFAULT_COLOR = '#6b7280'

function getTypeColor(classType: string | null): string {
  if (!classType) return DEFAULT_COLOR
  return CLASS_TYPE_COLORS[classType.toLowerCase().replace(/[\s-]/g, '_')] || DEFAULT_COLOR
}

function formatTypeName(classType: string | null): string {
  if (!classType) return 'General'
  return classType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/* ═══════════════════════════════════════════════
   TIME PARSING
   ═══════════════════════════════════════════════ */

function parseTime(timeStr: string): { startHour: number; startMin: number; endHour: number; endMin: number } | null {
  if (!timeStr) return null
  const cleaned = timeStr.trim()

  // Try "HH:MM - HH:MM" or "HH:MM-HH:MM" (24h)
  const range24 = cleaned.match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/)
  if (range24) {
    return {
      startHour: parseInt(range24[1]),
      startMin: parseInt(range24[2]),
      endHour: parseInt(range24[3]),
      endMin: parseInt(range24[4]),
    }
  }

  // Try "H:MM AM/PM - H:MM AM/PM"
  const range12 = cleaned.match(
    /^(\d{1,2}):(\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)$/i
  )
  if (range12) {
    let sh = parseInt(range12[1])
    const sm = parseInt(range12[2])
    const sap = range12[3].toUpperCase()
    let eh = parseInt(range12[4])
    const em = parseInt(range12[5])
    const eap = range12[6].toUpperCase()

    if (sap === 'PM' && sh !== 12) sh += 12
    if (sap === 'AM' && sh === 12) sh = 0
    if (eap === 'PM' && eh !== 12) eh += 12
    if (eap === 'AM' && eh === 12) eh = 0

    return { startHour: sh, startMin: sm, endHour: eh, endMin: em }
  }

  // Try single time "HH:MM" — assume 1 hour duration
  const single24 = cleaned.match(/^(\d{1,2}):(\d{2})$/)
  if (single24) {
    const sh = parseInt(single24[1])
    const sm = parseInt(single24[2])
    return { startHour: sh, startMin: sm, endHour: sh + 1, endMin: sm }
  }

  // Try single time "H:MM AM/PM"
  const single12 = cleaned.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (single12) {
    let sh = parseInt(single12[1])
    const sm = parseInt(single12[2])
    const ap = single12[3].toUpperCase()
    if (ap === 'PM' && sh !== 12) sh += 12
    if (ap === 'AM' && sh === 12) sh = 0
    return { startHour: sh, startMin: sm, endHour: sh + 1, endMin: sm }
  }

  return null
}

function formatTimeDisplay(startHour: number, startMin: number, endHour: number, endMin: number): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${pad(startHour)}:${pad(startMin)} - ${pad(endHour)}:${pad(endMin)}`
}

function timeToTop(hour: number, min: number): number {
  return (hour - START_HOUR) * SLOT_HEIGHT + (min / 60) * SLOT_HEIGHT
}

function getCurrentDayName(): string {
  const dayIndex = new Date().getDay() // 0 = Sunday
  return dayIndex === 0 ? 'Sunday' : DAYS[dayIndex - 1]
}

/* ═══════════════════════════════════════════════
   SVG ICONS (inline, no libraries)
   ═══════════════════════════════════════════════ */

function IconClock() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function IconMapPin() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

function IconUsers() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function IconUser() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function IconChevronLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

function IconChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

function IconX() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function IconCalendar() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

function IconPlus() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function IconClipboard() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    </svg>
  )
}

function IconEdit() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

function IconStar() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}

/* ═══════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════ */

type ViewMode = 'week' | 'day'

interface Props {
  groups: CalendarGroup[]
  role: 'admin' | 'coach' | 'parent'
  locations: string[]
  classTypes: string[]
}

export default function WeekCalendar({ groups, role, locations, classTypes }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [selectedDay, setSelectedDay] = useState<string>(getCurrentDayName())
  const [filterTypes, setFilterTypes] = useState<Set<string>>(new Set())
  const [filterLocation, setFilterLocation] = useState<string>('')
  const [selectedGroup, setSelectedGroup] = useState<CalendarGroup | null>(null)
  const [currentTimeTop, setCurrentTimeTop] = useState<number | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [isMobile, setIsMobile] = useState(false)

  // Touch handling for mobile swipe
  const touchStartX = useRef(0)
  const touchEndX = useRef(0)

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      if (mobile) setViewMode('day')
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Update current time indicator
  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      const h = now.getHours()
      const m = now.getMinutes()
      if (h >= START_HOUR && h < END_HOUR) {
        setCurrentTimeTop(timeToTop(h, m))
      } else {
        setCurrentTimeTop(null)
      }
    }
    updateTime()
    const interval = setInterval(updateTime, 60000)
    return () => clearInterval(interval)
  }, [])

  // Scroll to current time on mount
  useEffect(() => {
    if (scrollRef.current && currentTimeTop !== null) {
      scrollRef.current.scrollTop = Math.max(0, currentTimeTop - 120)
    }
  }, [currentTimeTop, viewMode])

  // Filter groups
  const filteredGroups = useMemo(() => {
    return groups.filter((g) => {
      if (filterTypes.size > 0 && !filterTypes.has(g.class_type || '')) return false
      if (filterLocation && g.location !== filterLocation) return false
      return true
    })
  }, [groups, filterTypes, filterLocation])

  // Groups by day
  const groupsByDay = useMemo(() => {
    const map = new Map<string, CalendarGroup[]>()
    for (const day of DAYS) map.set(day, [])
    for (const g of filteredGroups) {
      const day = g.day_of_week || ''
      if (map.has(day)) {
        map.get(day)!.push(g)
      }
    }
    return map
  }, [filteredGroups])

  const toggleTypeFilter = (type: string) => {
    setFilterTypes((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  const navigateDay = useCallback((dir: 1 | -1) => {
    setSelectedDay((prev) => {
      const idx = DAYS.indexOf(prev as typeof DAYS[number])
      const next = (idx + dir + 7) % 7
      return DAYS[next]
    })
  }, [])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }, [])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].clientX
    const diff = touchStartX.current - touchEndX.current
    if (Math.abs(diff) > 50) {
      navigateDay(diff > 0 ? 1 : -1)
    }
  }, [navigateDay])

  const todayName = getCurrentDayName()
  const totalHeight = (END_HOUR - START_HOUR) * SLOT_HEIGHT

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Calendar</h1>
          <p className="text-sm text-white/60 mt-0.5">Visual timetable of all training sessions</p>
        </div>
        <div className="flex items-center gap-2">
          {role === 'admin' && (
            <a
              href="/dashboard/groups"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#4ecde6] text-[#0a0a0a] rounded-lg text-sm font-bold hover:bg-[#3dbcd5] transition-colors"
            >
              <IconPlus />
              Add Class
            </a>
          )}
        </div>
      </div>

      {/* Controls Row */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        {/* View Toggle */}
        <div className="flex items-center gap-2">
          <div className="inline-flex bg-[#141414] border border-[#1e1e1e] rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewMode === 'week'
                  ? 'bg-[#4ecde6]/15 text-[#4ecde6]'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setViewMode('day')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewMode === 'day'
                  ? 'bg-[#4ecde6]/15 text-[#4ecde6]'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              Day
            </button>
          </div>

          {viewMode === 'day' && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => navigateDay(-1)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
              >
                <IconChevronLeft />
              </button>
              <span className="text-sm font-semibold min-w-[90px] text-center">
                {selectedDay}
              </span>
              <button
                onClick={() => navigateDay(1)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
              >
                <IconChevronRight />
              </button>
              {selectedDay !== todayName && (
                <button
                  onClick={() => setSelectedDay(todayName)}
                  className="ml-1 px-2.5 py-1 rounded-md text-xs font-medium bg-[#4ecde6]/10 text-[#4ecde6] hover:bg-[#4ecde6]/20 transition-colors"
                >
                  Today
                </button>
              )}
            </div>
          )}

          {viewMode === 'week' && selectedDay !== todayName && (
            <button
              onClick={() => setSelectedDay(todayName)}
              className="px-2.5 py-1 rounded-md text-xs font-medium bg-[#4ecde6]/10 text-[#4ecde6] hover:bg-[#4ecde6]/20 transition-colors"
            >
              Today
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Location filter */}
          {locations.length > 1 && (
            <select
              value={filterLocation}
              onChange={(e) => setFilterLocation(e.target.value)}
              className="bg-[#141414] border border-[#1e1e1e] rounded-lg px-3 py-1.5 text-xs text-white/80 focus:outline-none focus:border-[#4ecde6]/50 appearance-none cursor-pointer"
            >
              <option value="" className="bg-[#1a1a1a] text-white">All Locations</option>
              {locations.map((loc) => (
                <option key={loc} value={loc} className="bg-[#1a1a1a] text-white">{loc}</option>
              ))}
            </select>
          )}

          {/* Class type chips */}
          {classTypes.map((type) => {
            const color = getTypeColor(type)
            const active = filterTypes.has(type)
            return (
              <button
                key={type}
                onClick={() => toggleTypeFilter(type)}
                className="px-2.5 py-1 rounded-full text-xs font-medium border transition-all"
                style={{
                  backgroundColor: active ? `${color}20` : 'transparent',
                  borderColor: active ? color : '#1e1e1e',
                  color: active ? color : 'rgba(255,255,255,0.5)',
                }}
              >
                {formatTypeName(type)}
              </button>
            )
          })}
          {filterTypes.size > 0 && (
            <button
              onClick={() => setFilterTypes(new Set())}
              className="px-2 py-1 text-xs text-white/40 hover:text-white/70 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-[#141414] border border-[#1e1e1e] rounded-2xl overflow-hidden">
        {viewMode === 'week' ? (
          <WeekView
            days={DAYS}
            groupsByDay={groupsByDay}
            todayName={todayName}
            totalHeight={totalHeight}
            currentTimeTop={currentTimeTop}
            scrollRef={scrollRef}
            onSelectGroup={setSelectedGroup}
            onSwitchToDay={(day) => { setSelectedDay(day); setViewMode('day') }}
            role={role}
          />
        ) : (
          <DayView
            day={selectedDay}
            groups={groupsByDay.get(selectedDay) || []}
            isToday={selectedDay === todayName}
            totalHeight={totalHeight}
            currentTimeTop={currentTimeTop}
            scrollRef={scrollRef}
            onSelectGroup={setSelectedGroup}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            role={role}
          />
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 px-1">
        <span className="text-xs text-white/40">Legend:</span>
        {classTypes.map((type) => (
          <div key={type} className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-sm"
              style={{ backgroundColor: getTypeColor(type) }}
            />
            <span className="text-xs text-white/60">{formatTypeName(type)}</span>
          </div>
        ))}
        {classTypes.length === 0 && (
          <span className="text-xs text-white/40">No classes scheduled</span>
        )}
      </div>

      {/* Modal */}
      {selectedGroup && (
        <ClassDetailModal
          group={selectedGroup}
          role={role}
          onClose={() => setSelectedGroup(null)}
        />
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════
   WEEK VIEW
   ═══════════════════════════════════════════════ */

function WeekView({
  days,
  groupsByDay,
  todayName,
  totalHeight,
  currentTimeTop,
  scrollRef,
  onSelectGroup,
  onSwitchToDay,
  role,
}: {
  days: readonly string[]
  groupsByDay: Map<string, CalendarGroup[]>
  todayName: string
  totalHeight: number
  currentTimeTop: number | null
  scrollRef: React.RefObject<HTMLDivElement | null>
  onSelectGroup: (g: CalendarGroup) => void
  onSwitchToDay: (day: string) => void
  role?: string
}) {
  return (
    <div className="flex flex-col">
      {/* Day headers */}
      <div className="flex border-b border-[#1e1e1e]">
        <div className="w-16 shrink-0" />
        {days.map((day, i) => {
          const isToday = day === todayName
          const count = groupsByDay.get(day)?.length || 0
          return (
            <div
              key={day}
              className={`flex-1 min-w-[100px] py-3 px-2 text-center border-l border-[#1e1e1e] cursor-pointer hover:bg-white/[0.02] transition-colors ${
                isToday ? 'bg-[#4ecde6]/[0.04]' : ''
              }`}
              onClick={() => onSwitchToDay(day)}
            >
              <div className={`text-xs font-bold ${isToday ? 'text-[#4ecde6]' : 'text-white/80'}`}>
                {DAY_SHORT[i]}
              </div>
              {count > 0 && (
                <div className="text-[10px] text-white/40 mt-0.5">
                  {count} class{count !== 1 ? 'es' : ''}
                </div>
              )}
              {isToday && (
                <div className="w-1.5 h-1.5 rounded-full bg-[#4ecde6] mx-auto mt-1" />
              )}
            </div>
          )
        })}
      </div>

      {/* Time grid */}
      <div ref={scrollRef} className="overflow-y-auto max-h-[600px] relative">
        <div className="flex" style={{ height: totalHeight }}>
          {/* Time labels */}
          <div className="w-16 shrink-0 relative">
            {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => {
              const hour = START_HOUR + i
              return (
                <div
                  key={hour}
                  className="absolute left-0 right-0 text-right pr-2 text-[10px] text-white/40 -translate-y-1/2"
                  style={{ top: i * SLOT_HEIGHT }}
                >
                  {hour.toString().padStart(2, '0')}:00
                </div>
              )
            })}
          </div>

          {/* Day columns */}
          {days.map((day) => {
            const isToday = day === todayName
            const dayGroups = groupsByDay.get(day) || []
            return (
              <div
                key={day}
                className={`flex-1 min-w-[100px] relative border-l border-[#1e1e1e] ${
                  isToday ? 'bg-[#4ecde6]/[0.02]' : ''
                }`}
              >
                {/* Hour lines */}
                {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
                  <div
                    key={i}
                    className="absolute left-0 right-0 border-t border-[#1e1e1e]"
                    style={{ top: i * SLOT_HEIGHT }}
                  />
                ))}
                {/* Half-hour lines */}
                {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
                  <div
                    key={`half-${i}`}
                    className="absolute left-0 right-0 border-t border-[#1e1e1e]/40"
                    style={{ top: i * SLOT_HEIGHT + HALF_SLOT }}
                  />
                ))}

                {/* Current time line */}
                {isToday && currentTimeTop !== null && (
                  <div
                    className="absolute left-0 right-0 z-20 pointer-events-none"
                    style={{ top: currentTimeTop }}
                  >
                    <div className="relative">
                      <div className="absolute -left-1 -top-1 w-2.5 h-2.5 rounded-full bg-red-500" />
                      <div className="h-[2px] bg-red-500 w-full" />
                    </div>
                  </div>
                )}

                {/* Class blocks */}
                {dayGroups.map((g) => {
                  const parsed = parseTime(g.time_slot || '')
                  if (!parsed) return null
                  const { startHour, startMin, endHour, endMin } = parsed
                  if (startHour < START_HOUR || startHour >= END_HOUR) return null

                  const top = timeToTop(startHour, startMin)
                  const bottom = timeToTop(endHour, endMin)
                  const height = Math.max(bottom - top, 24)
                  const color = getTypeColor(g.class_type)
                  const capacity = g.max_capacity || 20

                  return (
                    <button
                      key={g.id}
                      onClick={() => onSelectGroup(g)}
                      className="absolute left-1 right-1 z-10 rounded-lg overflow-hidden cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:z-30 group text-left"
                      style={{
                        top,
                        height,
                        backgroundColor: `${color}18`,
                        borderLeft: `3px solid ${color}`,
                        boxShadow: 'none',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.boxShadow = `0 0 12px ${color}30`
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.boxShadow = 'none'
                      }}
                    >
                      <div className="p-1.5 h-full flex flex-col justify-between overflow-hidden">
                        <div>
                          <div className="text-[10px] font-bold text-white truncate leading-tight">
                            {g.name}
                          </div>
                          {height > 40 && (
                            <div className="text-[9px] text-white/50 truncate mt-0.5">
                              {formatTimeDisplay(startHour, startMin, endHour, endMin)}
                            </div>
                          )}
                        </div>
                        {height > 50 && (
                          <div className="text-[9px] text-white/50 truncate">
                            {g.enrolledCount}/{capacity}
                          </div>
                        )}
                      </div>
                      {/* Enrolled indicator as child highlight */}
                      {g.isMyChild && (
                        <div
                          className="absolute top-1 right-1 w-2 h-2 rounded-full"
                          style={{ backgroundColor: '#4ecde6' }}
                          title="Your child is enrolled"
                        />
                      )}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════
   DAY VIEW
   ═══════════════════════════════════════════════ */

function DayView({
  day,
  groups,
  isToday,
  totalHeight,
  currentTimeTop,
  scrollRef,
  onSelectGroup,
  onTouchStart,
  onTouchEnd,
  role,
}: {
  day: string
  groups: CalendarGroup[]
  isToday: boolean
  totalHeight: number
  currentTimeTop: number | null
  scrollRef: React.RefObject<HTMLDivElement | null>
  onSelectGroup: (g: CalendarGroup) => void
  onTouchStart: (e: React.TouchEvent) => void
  onTouchEnd: (e: React.TouchEvent) => void
  role?: string
}) {
  return (
    <div
      className="flex flex-col"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Day header */}
      <div className="flex border-b border-[#1e1e1e]">
        <div className="w-16 shrink-0" />
        <div className={`flex-1 py-3 px-4 ${isToday ? 'bg-[#4ecde6]/[0.04]' : ''}`}>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-bold ${isToday ? 'text-[#4ecde6]' : 'text-white'}`}>
              {day}
            </span>
            {isToday && (
              <span className="px-2 py-0.5 text-[10px] rounded-full bg-[#4ecde6]/10 text-[#4ecde6] font-semibold">
                Today
              </span>
            )}
            <span className="text-xs text-white/40">
              {groups.length} class{groups.length !== 1 ? 'es' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Time grid */}
      <div ref={scrollRef} className="overflow-y-auto max-h-[600px] relative">
        <div className="flex" style={{ height: totalHeight }}>
          {/* Time labels */}
          <div className="w-16 shrink-0 relative">
            {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => {
              const hour = START_HOUR + i
              return (
                <div
                  key={hour}
                  className="absolute left-0 right-0 text-right pr-2 text-[10px] text-white/40 -translate-y-1/2"
                  style={{ top: i * SLOT_HEIGHT }}
                >
                  {hour.toString().padStart(2, '0')}:00
                </div>
              )
            })}
          </div>

          {/* Single day column */}
          <div className={`flex-1 relative border-l border-[#1e1e1e] ${isToday ? 'bg-[#4ecde6]/[0.02]' : ''}`}>
            {/* Hour lines */}
            {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
              <div
                key={i}
                className="absolute left-0 right-0 border-t border-[#1e1e1e]"
                style={{ top: i * SLOT_HEIGHT }}
              />
            ))}
            {/* Half-hour lines */}
            {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
              <div
                key={`half-${i}`}
                className="absolute left-0 right-0 border-t border-[#1e1e1e]/40"
                style={{ top: i * SLOT_HEIGHT + HALF_SLOT }}
              />
            ))}

            {/* Current time line */}
            {isToday && currentTimeTop !== null && (
              <div
                className="absolute left-0 right-0 z-20 pointer-events-none"
                style={{ top: currentTimeTop }}
              >
                <div className="relative">
                  <div className="absolute -left-1 -top-1 w-2.5 h-2.5 rounded-full bg-red-500" />
                  <div className="h-[2px] bg-red-500 w-full" />
                </div>
              </div>
            )}

            {/* Class blocks — larger in day view */}
            {groups.map((g) => {
              const parsed = parseTime(g.time_slot || '')
              if (!parsed) return null
              const { startHour, startMin, endHour, endMin } = parsed
              if (startHour < START_HOUR || startHour >= END_HOUR) return null

              const top = timeToTop(startHour, startMin)
              const bottom = timeToTop(endHour, endMin)
              const height = Math.max(bottom - top, 36)
              const color = getTypeColor(g.class_type)
              const capacity = g.max_capacity || 20
              const fillPct = Math.min((g.enrolledCount / capacity) * 100, 100)

              return (
                <button
                  key={g.id}
                  onClick={() => onSelectGroup(g)}
                  className="absolute left-2 right-2 z-10 rounded-xl overflow-hidden cursor-pointer transition-all duration-200 hover:scale-[1.01] hover:z-30 group text-left"
                  style={{
                    top,
                    height,
                    backgroundColor: `${color}15`,
                    borderLeft: `4px solid ${color}`,
                    boxShadow: 'none',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = `0 0 16px ${color}25`
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  <div className="p-3 h-full flex flex-col justify-between overflow-hidden">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-sm font-bold text-white truncate">{g.name}</div>
                        <span
                          className="shrink-0 px-2 py-0.5 text-[10px] font-semibold rounded-full"
                          style={{ backgroundColor: `${color}25`, color }}
                        >
                          {formatTypeName(g.class_type)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-white/60">
                        <span className="inline-flex items-center gap-1">
                          <IconClock />
                          {formatTimeDisplay(startHour, startMin, endHour, endMin)}
                        </span>
                        {g.location && (
                          <span className="inline-flex items-center gap-1">
                            <IconMapPin />
                            {g.location}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-1.5 text-xs text-white/50">
                        <IconUsers />
                        <span>{g.enrolledCount} / {capacity}</span>
                      </div>
                      {g.coachName && (
                        <div className="flex items-center gap-1 text-xs text-white/50">
                          <IconUser />
                          <span>{g.coachName}</span>
                        </div>
                      )}
                      {g.isMyChild && (
                        <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-[#4ecde6]/15 text-[#4ecde6]">
                          Enrolled
                        </span>
                      )}
                    </div>
                    {/* Capacity bar */}
                    {height > 60 && (
                      <div className="mt-1.5">
                        <div className="w-full h-1 rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${fillPct}%`,
                              backgroundColor: fillPct >= 90 ? '#f97316' : color,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </button>
              )
            })}

            {/* Empty state for no classes */}
            {groups.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center p-6">
                  <div className="text-white/20 mb-2">
                    <IconCalendar />
                  </div>
                  <p className="text-sm text-white/30">No classes on {day}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════
   CLASS DETAIL MODAL
   ═══════════════════════════════════════════════ */

function ClassDetailModal({
  group,
  role,
  onClose,
}: {
  group: CalendarGroup
  role: 'admin' | 'coach' | 'parent'
  onClose: () => void
}) {
  const color = getTypeColor(group.class_type)
  const capacity = group.max_capacity || 20
  const fillPct = Math.min((group.enrolledCount / capacity) * 100, 100)
  const parsed = parseTime(group.time_slot || '')

  // Close on escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-md bg-[#141414] border border-[#1e1e1e] rounded-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Color top bar */}
        <div className="h-1" style={{ backgroundColor: color }} />

        <div className="p-6 space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-white">{group.name}</h2>
              <span
                className="inline-block px-2.5 py-0.5 text-xs font-semibold rounded-full"
                style={{ backgroundColor: `${color}25`, color }}
              >
                {formatTypeName(group.class_type)}
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
            >
              <IconX />
            </button>
          </div>

          {/* Details */}
          <div className="space-y-3">
            {/* Day + Time */}
            <div className="flex items-center gap-2 text-sm text-white/70">
              <IconCalendar />
              <span>
                {group.day_of_week || 'Unscheduled'}
                {parsed && (
                  <> &middot; {formatTimeDisplay(parsed.startHour, parsed.startMin, parsed.endHour, parsed.endMin)}</>
                )}
              </span>
            </div>

            {/* Location */}
            {group.location && (
              <div className="flex items-center gap-2 text-sm text-white/70">
                <IconMapPin />
                <span>{group.location}</span>
              </div>
            )}

            {/* Coach */}
            {group.coachName && (
              <div className="flex items-center gap-2 text-sm text-white/70">
                <IconUser />
                <span>Coach: {group.coachName}</span>
              </div>
            )}
          </div>

          {/* Capacity */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/60">Enrolled</span>
              <span className="font-semibold text-white">
                {group.enrolledCount} / {capacity}
                {capacity - group.enrolledCount <= 3 && capacity - group.enrolledCount > 0 && (
                  <span className="ml-2 text-xs text-orange-400">
                    {capacity - group.enrolledCount} spot{capacity - group.enrolledCount !== 1 ? 's' : ''} left
                  </span>
                )}
                {group.enrolledCount >= capacity && (
                  <span className="ml-2 text-xs text-red-400">Full</span>
                )}
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-white/10">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${fillPct}%`,
                  backgroundColor: fillPct >= 90 ? '#f97316' : fillPct >= 70 ? '#eab308' : color,
                }}
              />
            </div>
          </div>

          {/* Role-specific sections */}
          {role === 'parent' && (
            <div className="pt-1">
              {group.isMyChild ? (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[#4ecde6]/10 border border-[#4ecde6]/20">
                  <IconStar />
                  <span className="text-sm font-medium text-[#4ecde6]">Your child is enrolled in this class</span>
                </div>
              ) : (
                <a
                  href="/dashboard/schedule"
                  className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl bg-[#4ecde6] text-[#0a0a0a] font-semibold text-sm hover:bg-[#3dbcd5] transition-colors"
                >
                  Book a Trial
                </a>
              )}
            </div>
          )}

          {(role === 'admin' || role === 'coach') && (
            <div className="space-y-3">
              {/* Action links */}
              {role === 'admin' && (
                <div className="flex gap-2">
                  <a
                    href="/dashboard/groups"
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.05] border border-[#1e1e1e] text-sm text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <IconEdit />
                    Edit Class
                  </a>
                  <a
                    href="/dashboard/attendance"
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.05] border border-[#1e1e1e] text-sm text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <IconClipboard />
                    Attendance
                  </a>
                </div>
              )}

              {/* Enrolled players */}
              {group.enrolledPlayers.length > 0 && (
                <div>
                  <div className="text-xs text-white/40 font-medium uppercase tracking-wider mb-2">
                    Enrolled Players ({group.enrolledPlayers.length})
                  </div>
                  <div className="max-h-[180px] overflow-y-auto space-y-1 pr-1">
                    {group.enrolledPlayers.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-[#1e1e1e]/50"
                      >
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                          style={{ backgroundColor: `${color}30` }}
                        >
                          {p.name.charAt(0)}
                        </div>
                        <span className="text-sm text-white/80">{p.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {group.enrolledPlayers.length === 0 && (
                <div className="text-center py-3">
                  <p className="text-xs text-white/40">No players enrolled yet</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
