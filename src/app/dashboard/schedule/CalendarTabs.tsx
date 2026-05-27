'use client'

import { useState } from 'react'

export interface CalendarSession {
  id: string
  groupName: string
  groupId: string
  day: string
  timeSlot: string
  location: string
  coachName: string
  coachId: string | null
  playerCount: number
  maxCapacity: number
  players: { id: string; name: string; parentName: string }[]
}

export interface CalendarEvent {
  id: string
  name: string
  event_type: string
  start_date: string
  end_date: string
  start_time: string | null
  end_time: string | null
  location: string | null
  max_capacity: number
  price: number
  description: string | null
  bookingCount: number
}

interface Props {
  sessions: CalendarSession[]
  events: CalendarEvent[]
  role: 'admin' | 'coach' | 'parent'
  brandColor?: string
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const SHORT_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function getWeekDates(weekOffset: number = 0): Date[] {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) + weekOffset * 7)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

function formatDate(d: Date) {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default function CalendarTabs({ sessions, events, role, brandColor = '#4ecde6' }: Props) {
  const tabs = role === 'parent'
    ? ['Week', 'My Classes', 'Available', 'Events']
    : ['Week', 'By Group', 'By Coach', 'By Location', 'Events']

  const [activeTab, setActiveTab] = useState('Week')
  const [selectedDay, setSelectedDay] = useState(
    new Date().toLocaleDateString('en-GB', { weekday: 'long' })
  )
  const [weekOffset, setWeekOffset] = useState(0)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long' })
  const weekDates = getWeekDates(weekOffset)

  // Sessions grouped by day
  const byDay: Record<string, CalendarSession[]> = {}
  for (const day of DAYS) {
    byDay[day] = sessions
      .filter(s => s.day === day)
      .sort((a, b) => (a.timeSlot || '').localeCompare(b.timeSlot || ''))
  }

  // By coach
  const coaches = [...new Set(sessions.map(s => s.coachName).filter(Boolean))].sort()
  const byCoach: Record<string, CalendarSession[]> = {}
  for (const c of coaches) {
    byCoach[c] = sessions.filter(s => s.coachName === c).sort((a, b) => {
      const da = DAYS.indexOf(a.day), db = DAYS.indexOf(b.day)
      if (da !== db) return da - db
      return (a.timeSlot || '').localeCompare(b.timeSlot || '')
    })
  }

  // By location
  const locations = [...new Set(sessions.map(s => s.location).filter(Boolean))].sort()
  const byLocation: Record<string, CalendarSession[]> = {}
  for (const l of locations) {
    byLocation[l] = sessions.filter(s => s.location === l).sort((a, b) => {
      const da = DAYS.indexOf(a.day), db = DAYS.indexOf(b.day)
      if (da !== db) return da - db
      return (a.timeSlot || '').localeCompare(b.timeSlot || '')
    })
  }

  // By group
  const groupNames = [...new Set(sessions.map(s => s.groupName))].sort()
  const byGroup: Record<string, CalendarSession[]> = {}
  for (const g of groupNames) {
    byGroup[g] = sessions.filter(s => s.groupName === g)
  }

  // Stats
  const totalPlayers = sessions.reduce((sum, s) => sum + s.playerCount, 0)
  const todaySessions = byDay[today] || []
  const todayPlayers = todaySessions.reduce((sum, s) => sum + s.playerCount, 0)

  return (
    <div className="space-y-4">
      {/* Tab bar — segmented control with brand color active state */}
      <div className="inline-flex p-1 rounded-2xl bg-[#0a0a0a] border border-[#1e1e1e] overflow-x-auto -mx-1 px-1">
        {tabs.map(tab => {
          const isActive = activeTab === tab
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
                isActive ? 'text-[#0a0a0a]' : 'text-white/50 hover:text-white hover:bg-white/[0.04]'
              }`}
              style={isActive ? { backgroundColor: brandColor, boxShadow: `0 4px 16px ${brandColor}50` } : undefined}
            >
              {tab}
            </button>
          )
        })}
      </div>

      {/* Quick stats bar — icon + number pills */}
      <div className="flex items-center gap-2 flex-wrap text-xs">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white/80">
          <svg className="w-3 h-3 text-white/40" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
          <strong className="text-white tabular-nums">{sessions.length}</strong>
          <span className="text-white/50">classes</span>
        </span>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white/80">
          <svg className="w-3 h-3 text-white/40" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
          <strong className="text-white tabular-nums">{totalPlayers}</strong>
          <span className="text-white/50">enrolments</span>
        </span>
        {todaySessions.length > 0 && (
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
            style={{ backgroundColor: `${brandColor}15`, border: `1px solid ${brandColor}40`, color: brandColor }}
          >
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: brandColor }} />
            <strong className="tabular-nums">{todaySessions.length}</strong>
            <span style={{ color: `${brandColor}b3` }}>today</span>
          </span>
        )}
        {todayPlayers > 0 && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
            <strong className="tabular-nums">{todayPlayers}</strong>
            <span className="text-emerald-300/70">players today</span>
          </span>
        )}
        {events.length > 0 && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-300 ml-auto">
            <strong className="tabular-nums">{events.length}</strong>
            <span className="text-purple-300/70">events</span>
          </span>
        )}
      </div>

      {/* ═══ WEEK VIEW ═══ */}
      {activeTab === 'Week' && (
        <div className="space-y-4">
          {/* Week navigation */}
          <div className="flex items-center justify-between">
            <button onClick={() => setWeekOffset(o => o - 1)} className="px-3 py-1.5 rounded-lg border border-[#1e1e1e] text-sm hover:bg-white/5 transition-colors">
              ← Prev
            </button>
            <div className="text-center">
              <span className="text-sm font-semibold">
                {formatDate(weekDates[0])} — {formatDate(weekDates[6])}
              </span>
              {weekOffset === 0 && <span className="ml-2 text-xs text-accent font-medium">(This week)</span>}
            </div>
            <div className="flex gap-2">
              {weekOffset !== 0 && (
                <button onClick={() => setWeekOffset(0)} className="px-3 py-1.5 rounded-lg border border-accent text-accent text-sm hover:bg-accent/5 transition-colors">
                  Today
                </button>
              )}
              <button onClick={() => setWeekOffset(o => o + 1)} className="px-3 py-1.5 rounded-lg border border-[#1e1e1e] text-sm hover:bg-white/5 transition-colors">
                Next →
              </button>
            </div>
          </div>

          {/* Day strip */}
          <div className="grid grid-cols-7 gap-1.5">
            {DAYS.map((day, i) => {
              const date = weekDates[i]
              const isToday = day === today && weekOffset === 0
              const isSelected = day === selectedDay
              const daySessions = byDay[day] || []
              const dayPlayers = daySessions.reduce((s, ss) => s + ss.playerCount, 0)

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className={`relative flex flex-col items-center py-2.5 px-1 rounded-xl text-center transition-all ${
                    isSelected
                      ? 'text-[#0a0a0a] shadow-lg'
                      : isToday
                        ? ''
                        : 'bg-[#141414] border border-[#1e1e1e] hover:bg-white/5 hover:shadow-sm'
                  }`}
                  style={
                    isSelected
                      ? { backgroundColor: brandColor, boxShadow: `0 8px 20px ${brandColor}40` }
                      : isToday
                        ? { backgroundColor: `${brandColor}15`, color: brandColor, border: `2px solid ${brandColor}40` }
                        : undefined
                  }
                >
                  <span className="text-[11px] font-medium uppercase tracking-wide">{SHORT_DAYS[i]}</span>
                  <span className={`text-xl font-bold my-0.5 ${isSelected ? 'text-[#0a0a0a]' : ''}`}>
                    {date.getDate()}
                  </span>
                  {daySessions.length > 0 ? (
                    <div className="flex flex-col items-center gap-0.5">
                      <span
                        className="text-[10px] font-semibold"
                        style={isSelected ? { color: 'rgba(10,10,10,0.7)' } : { color: brandColor }}
                      >
                        {daySessions.length} class{daySessions.length !== 1 ? 'es' : ''}
                      </span>
                      <span className={`text-[10px] ${isSelected ? 'text-[#0a0a0a]/60' : 'text-white/60'}`}>
                        {dayPlayers} player{dayPlayers !== 1 ? 's' : ''}
                      </span>
                    </div>
                  ) : (
                    <span className={`text-[10px] ${isSelected ? 'text-[#0a0a0a]/50' : 'text-white/60'}`}>Rest day</span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Day detail */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-lg font-bold">{selectedDay}</h3>
              {selectedDay === today && weekOffset === 0 && (
                <span className="px-2.5 py-0.5 text-xs rounded-full bg-accent/10 text-accent font-semibold">Today</span>
              )}
              <span className="text-sm text-white/60">
                {(byDay[selectedDay] || []).length} class{(byDay[selectedDay] || []).length !== 1 ? 'es' : ''}
              </span>
            </div>

            {(byDay[selectedDay] || []).length === 0 ? (
              <div className="bg-[#0a0a0a]/50 rounded-2xl p-10 text-center">
                <div className="text-3xl mb-2">😴</div>
                <p className="text-sm text-white/60">No classes on {selectedDay}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {(byDay[selectedDay] || []).map(session => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    expanded={expandedId === session.id}
                    onToggle={() => setExpandedId(expandedId === session.id ? null : session.id)}
                    brandColor={brandColor}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ BY GROUP ═══ */}
      {activeTab === 'By Group' && (
        <div className="space-y-4">
          {groupNames.length === 0 ? (
            <EmptyBox message="No groups set up yet" />
          ) : (
            groupNames.map(name => {
              const groupSessions = byGroup[name]
              const first = groupSessions[0]
              const total = groupSessions.reduce((s, ss) => s + ss.playerCount, 0)

              return (
                <div key={name} className="rounded-2xl border border-[#1e1e1e] overflow-hidden">
                  <button
                    onClick={() => setExpandedId(expandedId === `group-${name}` ? null : `group-${name}`)}
                    className="w-full p-4 text-left bg-[#141414] hover:bg-white/[0.03] transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-bold">{name}</h3>
                        <div className="flex items-center gap-3 text-xs text-white/60 mt-1">
                          {first?.location && <span>📍 {first.location}</span>}
                          {first?.coachName && <span>👤 {first.coachName}</span>}
                          <span>📅 {groupSessions.map(s => s.day).join(', ')}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-xl font-bold text-accent">{total}</div>
                          <div className="text-[10px] text-white/60">players</div>
                        </div>
                        <Chevron open={expandedId === `group-${name}`} />
                      </div>
                    </div>
                    {/* Capacity bar */}
                    <div className="mt-3 flex items-center gap-2">
                      <div className="flex-1 bg-[#0a0a0a] rounded-full h-2">
                        <div
                          className="h-2 rounded-full transition-all bg-accent"
                          style={{ width: `${Math.min(100, (total / (first?.maxCapacity || 20)) * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-white/60">{total}/{first?.maxCapacity || 20}</span>
                    </div>
                  </button>

                  {expandedId === `group-${name}` && (
                    <div className="border-t border-[#1e1e1e] bg-[#0a0a0a]/40 p-4 space-y-3">
                      {groupSessions.map(session => (
                        <div key={session.id} className="space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="font-semibold text-primary">{session.day}</span>
                            {session.timeSlot && <span className="font-bold">{session.timeSlot}</span>}
                            <span className="text-xs text-white/60">· {session.playerCount} players</span>
                          </div>
                          <PlayerChips players={session.players} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ═══ BY COACH ═══ */}
      {activeTab === 'By Coach' && (
        <div className="space-y-4">
          {coaches.length === 0 ? (
            <EmptyBox message="No coaches assigned yet" />
          ) : (
            coaches.map(coach => {
              const coachSessions = byCoach[coach]
              const totalPlayers = coachSessions.reduce((s, ss) => s + ss.playerCount, 0)
              const uniqueGroups = new Set(coachSessions.map(s => s.groupName)).size
              const days = [...new Set(coachSessions.map(s => s.day))]

              return (
                <div key={coach} className="rounded-2xl border border-[#1e1e1e] overflow-hidden">
                  <button
                    onClick={() => setExpandedId(expandedId === `coach-${coach}` ? null : `coach-${coach}`)}
                    className="w-full p-4 text-left bg-[#141414] hover:bg-white/[0.03] transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center text-lg font-bold">
                          {coach.charAt(0)}
                        </div>
                        <div>
                          <h3 className="font-bold">{coach}</h3>
                          <div className="flex items-center gap-3 text-xs text-white/60 mt-0.5">
                            <span>{uniqueGroups} group{uniqueGroups !== 1 ? 's' : ''}</span>
                            <span>{totalPlayers} player{totalPlayers !== 1 ? 's' : ''}</span>
                            <span>{days.length} day{days.length !== 1 ? 's' : ''}/week</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex flex-wrap gap-1 max-w-[120px] justify-end">
                          {days.map(d => (
                            <span key={d} className="px-1.5 py-0.5 text-[10px] rounded bg-accent/10 text-accent font-medium">
                              {d.slice(0, 3)}
                            </span>
                          ))}
                        </div>
                        <Chevron open={expandedId === `coach-${coach}`} />
                      </div>
                    </div>
                  </button>

                  {expandedId === `coach-${coach}` && (
                    <div className="border-t border-[#1e1e1e] bg-[#0a0a0a]/40 divide-y divide-[#1e1e1e]">
                      {coachSessions.map(session => (
                        <div key={session.id} className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <span className="font-semibold text-sm">{session.groupName}</span>
                              <span className="text-xs text-white/60 ml-2">{session.day} {session.timeSlot}</span>
                            </div>
                            <span className="px-2 py-0.5 text-xs rounded-full bg-accent/10 text-accent font-medium">
                              {session.playerCount} player{session.playerCount !== 1 ? 's' : ''}
                            </span>
                          </div>
                          {session.location && <div className="text-xs text-white/60 mb-2">📍 {session.location}</div>}
                          <PlayerChips players={session.players} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ═══ BY LOCATION ═══ */}
      {activeTab === 'By Location' && (
        <div className="space-y-4">
          {locations.length === 0 ? (
            <EmptyBox message="No locations set yet" />
          ) : (
            locations.map(loc => {
              const locSessions = byLocation[loc]
              const totalPlayers = locSessions.reduce((s, ss) => s + ss.playerCount, 0)
              const uniqueGroups = new Set(locSessions.map(s => s.groupName)).size

              return (
                <div key={loc} className="rounded-2xl border border-[#1e1e1e] overflow-hidden">
                  <button
                    onClick={() => setExpandedId(expandedId === `loc-${loc}` ? null : `loc-${loc}`)}
                    className="w-full p-4 text-left bg-[#141414] hover:bg-white/[0.03] transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center text-lg">
                          📍
                        </div>
                        <div>
                          <h3 className="font-bold">{loc}</h3>
                          <div className="text-xs text-white/60 mt-0.5">
                            {uniqueGroups} group{uniqueGroups !== 1 ? 's' : ''} · {totalPlayers} player{totalPlayers !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>
                      <Chevron open={expandedId === `loc-${loc}`} />
                    </div>
                  </button>

                  {expandedId === `loc-${loc}` && (
                    <div className="border-t border-[#1e1e1e] bg-[#0a0a0a]/40 divide-y divide-[#1e1e1e]">
                      {locSessions.map(session => (
                        <div key={session.id} className="p-4">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-sm">{session.groupName}</span>
                            <span className="text-sm font-bold text-primary">{session.timeSlot || 'TBA'}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-white/60 mb-2">
                            <span>{session.day}</span>
                            {session.coachName && <span>👤 {session.coachName}</span>}
                            <span>{session.playerCount} players</span>
                          </div>
                          <PlayerChips players={session.players} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ═══ MY CLASSES (Parent) ═══ */}
      {activeTab === 'My Classes' && (
        <div className="space-y-4">
          {sessions.filter(s => s.playerCount > 0).length === 0 ? (
            <EmptyBox message="No classes booked yet. Check the Available tab!" />
          ) : (
            DAYS.filter(day => (byDay[day] || []).some(s => s.playerCount > 0)).map(day => (
              <div key={day}>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className={`text-sm font-bold ${day === today ? 'text-accent' : ''}`}>{day}</h3>
                  {day === today && <span className="px-2 py-0.5 text-xs rounded-full bg-accent/10 text-accent font-semibold">Today</span>}
                </div>
                <div className="space-y-2">
                  {(byDay[day] || []).filter(s => s.playerCount > 0).map(session => (
                    <SessionCard
                      key={session.id}
                      session={session}
                      expanded={expandedId === session.id}
                      onToggle={() => setExpandedId(expandedId === session.id ? null : session.id)}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ═══ AVAILABLE (Parent) ═══ */}
      {activeTab === 'Available' && (
        <div className="space-y-4">
          {sessions.length === 0 ? (
            <EmptyBox message="No classes available right now" />
          ) : (
            DAYS.filter(day => (byDay[day] || []).length > 0).map(day => (
              <div key={day}>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className={`text-sm font-bold ${day === today ? 'text-accent' : ''}`}>{day}</h3>
                  {day === today && <span className="px-2 py-0.5 text-xs rounded-full bg-accent/10 text-accent font-semibold">Today</span>}
                  <span className="text-xs text-white/60">{(byDay[day] || []).length} classes</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(byDay[day] || []).map(session => (
                    <div key={session.id} className="rounded-xl border border-[#1e1e1e] p-4 bg-[#141414] hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="font-semibold text-sm">{session.groupName}</div>
                          {session.timeSlot && <div className="text-sm font-bold text-primary mt-0.5">{session.timeSlot}</div>}
                        </div>
                        <div className="text-right">
                          <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                            session.playerCount >= session.maxCapacity
                              ? 'bg-red-50 text-red-500'
                              : session.maxCapacity - session.playerCount <= 3
                                ? 'bg-orange-50 text-orange-500'
                                : 'bg-accent/10 text-accent'
                          }`}>
                            {session.maxCapacity - session.playerCount} spots left
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-white/60">
                        {session.location && <span>📍 {session.location}</span>}
                        {session.coachName && <span>👤 {session.coachName}</span>}
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 bg-[#0a0a0a] rounded-full h-1.5">
                          <div
                            className="h-1.5 rounded-full bg-accent transition-all"
                            style={{ width: `${Math.min(100, (session.playerCount / session.maxCapacity) * 100)}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-white/60">{session.playerCount}/{session.maxCapacity}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ═══ EVENTS ═══ */}
      {activeTab === 'Events' && (
        <div className="space-y-4">
          {events.length === 0 ? (
            <EmptyBox message="No upcoming events" />
          ) : (
            events.map(event => {
              const startDate = new Date(event.start_date)
              const endDate = new Date(event.end_date)
              const isMultiDay = event.start_date !== event.end_date
              const spotsLeft = event.max_capacity - event.bookingCount

              return (
                <div key={event.id} className="rounded-2xl border border-[#1e1e1e] bg-[#141414] overflow-hidden hover:shadow-md transition-shadow">
                  <div className="flex">
                    {/* Date badge */}
                    <div className="w-20 flex-shrink-0 bg-[#4ecde6]/10 flex flex-col items-center justify-center p-3 border-r border-[#1e1e1e]">
                      <span className="text-xs font-medium text-primary uppercase">
                        {startDate.toLocaleDateString('en-GB', { month: 'short' })}
                      </span>
                      <span className="text-2xl font-bold text-primary">{startDate.getDate()}</span>
                      {isMultiDay && (
                        <>
                          <span className="text-[10px] text-white/60">to</span>
                          <span className="text-sm font-bold text-primary">{endDate.getDate()}</span>
                        </>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 p-4">
                      <div className="flex items-start justify-between mb-1">
                        <div>
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 capitalize">
                            {event.event_type.replace('_', ' ')}
                          </span>
                          <h3 className="font-bold mt-1.5">{event.name}</h3>
                        </div>
                        {event.price > 0 && (
                          <span className="text-xl font-bold text-accent">£{event.price.toFixed(0)}</span>
                        )}
                      </div>
                      {event.description && <p className="text-sm text-white/60 mt-1">{event.description}</p>}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-white/60 mt-2">
                        {event.start_time && (
                          <span>🕐 {event.start_time}{event.end_time && ` – ${event.end_time}`}</span>
                        )}
                        {event.location && <span>📍 {event.location}</span>}
                        <span className={`font-medium ${spotsLeft <= 3 ? 'text-orange-500' : 'text-accent'}`}>
                          {spotsLeft > 0 ? `${spotsLeft} spots left` : 'Full'}
                        </span>
                      </div>
                      {/* Capacity bar */}
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 bg-[#0a0a0a] rounded-full h-1.5">
                          <div
                            className="h-1.5 rounded-full transition-all"
                            style={{
                              width: `${Math.min(100, (event.bookingCount / event.max_capacity) * 100)}%`,
                              backgroundColor: spotsLeft <= 3 ? '#f97316' : '#4ecde6',
                            }}
                          />
                        </div>
                        <span className="text-[10px] text-white/60">{event.bookingCount}/{event.max_capacity}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

/* ═══ Shared sub-components ═══ */

function SessionCard({
  session,
  expanded,
  onToggle,
  brandColor = '#4ecde6',
}: {
  session: CalendarSession
  expanded: boolean
  onToggle: () => void
  brandColor?: string
}) {
  const fillPct = session.maxCapacity > 0
    ? Math.min(100, Math.round((session.playerCount / session.maxCapacity) * 100))
    : 0
  const isFull = session.playerCount >= session.maxCapacity && session.maxCapacity > 0
  const isAlmostFull = !isFull && session.maxCapacity > 0 && session.maxCapacity - session.playerCount <= 3

  return (
    <div
      className="rounded-2xl border border-[#1e1e1e] bg-gradient-to-br from-[#141414] via-[#0f1416] to-[#0a0a0a] overflow-hidden transition-all"
      style={{ ['--brand' as string]: brandColor }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${brandColor}50`; e.currentTarget.style.boxShadow = `0 0 20px ${brandColor}15` }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#1e1e1e'; e.currentTarget.style.boxShadow = '' }}
    >
      <button onClick={onToggle} className="w-full p-4 text-left transition-colors">
        <div className="flex items-center gap-4">
          {/* Time column — prominent on the left */}
          {session.timeSlot && (
            <div
              className="shrink-0 flex flex-col items-center justify-center min-w-[64px] rounded-xl px-2 py-2.5"
              style={{ background: `${brandColor}15`, border: `1px solid ${brandColor}30` }}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: `${brandColor}b3` }}>Time</span>
              <span className="text-sm font-extrabold mt-0.5 leading-tight whitespace-nowrap" style={{ color: brandColor }}>{session.timeSlot}</span>
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-bold text-sm text-white">{session.groupName}</h4>
              {isFull && (
                <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded-md bg-rose-500/15 text-rose-300 border border-rose-500/30">
                  Full
                </span>
              )}
              {isAlmostFull && (
                <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 animate-pulse">
                  Almost full
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-[11px] text-white/50">
              {session.location && (
                <span className="inline-flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" /><circle cx="12" cy="11" r="3" /></svg>
                  {session.location}
                </span>
              )}
              {session.coachName && (
                <span className="inline-flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path strokeLinecap="round" strokeLinejoin="round" d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /></svg>
                  {session.coachName}
                </span>
              )}
            </div>

            {/* Capacity progress bar */}
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${fillPct}%`,
                    background: isFull
                      ? 'linear-gradient(90deg, #f43f5e, #be123c)'
                      : isAlmostFull
                      ? 'linear-gradient(90deg, #f59e0b, #d97706)'
                      : `linear-gradient(90deg, ${brandColor}, ${brandColor}99)`,
                  }}
                />
              </div>
              <span className="text-[10px] font-bold tabular-nums text-white/60 whitespace-nowrap">
                {session.playerCount}/{session.maxCapacity}
              </span>
            </div>
          </div>

          <div className="shrink-0">
            <Chevron open={expanded} />
          </div>
        </div>
      </button>

      {expanded && session.players.length > 0 && (
        <div className="border-t border-[#1e1e1e] px-4 py-3 bg-[#0a0a0a]/40">
          <div className="text-[10px] font-medium text-white/60 uppercase tracking-wider mb-2">Enrolled Players</div>
          <div className="space-y-1.5">
            {session.players.map(p => (
              <div key={p.id} className="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-white/60">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                    {p.name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-sm font-medium">{p.name}</div>
                    <div className="text-[10px] text-white/60">{p.parentName}</div>
                  </div>
                </div>
                <span className="w-2 h-2 rounded-full bg-accent" />
              </div>
            ))}
          </div>
        </div>
      )}

      {expanded && session.players.length === 0 && (
        <div className="border-t border-[#1e1e1e] px-4 py-4 bg-[#0a0a0a]/40 text-center">
          <p className="text-xs text-white/60">No players enrolled yet</p>
        </div>
      )}
    </div>
  )
}

function PlayerChips({ players }: { players: { id: string; name: string; parentName: string }[] }) {
  if (players.length === 0) return <p className="text-xs text-white/60">No players enrolled</p>
  return (
    <div className="flex flex-wrap gap-1.5">
      {players.map(p => (
        <span key={p.id} className="inline-flex items-center gap-1 px-2 py-1 bg-[#141414] border border-[#1e1e1e] rounded-full text-xs" title={p.parentName}>
          <span className="w-1.5 h-1.5 rounded-full bg-accent" />
          {p.name}
        </span>
      ))}
    </div>
  )
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg className={`w-4 h-4 text-white/60 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  )
}

function EmptyBox({ message }: { message: string }) {
  return (
    <div className="bg-[#0a0a0a]/50 rounded-2xl p-10 text-center">
      <div className="text-3xl mb-2">📭</div>
      <p className="text-sm text-white/60">{message}</p>
    </div>
  )
}
