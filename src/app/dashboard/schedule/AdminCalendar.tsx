'use client'

import { useState } from 'react'

interface AdminSession {
  id: string
  groupName: string
  groupId: string
  day: string
  timeSlot: string
  location: string
  coachName: string
  playerCount: number
  players: { id: string; name: string; parentName: string }[]
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const SHORT_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function getWeekDates(): Date[] {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

export default function AdminCalendar({
  sessions,
}: {
  sessions: AdminSession[]
}) {
  const [selectedDay, setSelectedDay] = useState<string>(
    new Date().toLocaleDateString('en-GB', { weekday: 'long' })
  )
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null)

  const weekDates = getWeekDates()
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long' })

  // Group sessions by day
  const sessionsByDay: Record<string, AdminSession[]> = {}
  for (const day of DAYS) {
    sessionsByDay[day] = sessions
      .filter((s) => s.day === day)
      .sort((a, b) => {
        // Sort by time slot
        if (!a.timeSlot && !b.timeSlot) return 0
        if (!a.timeSlot) return 1
        if (!b.timeSlot) return -1
        return a.timeSlot.localeCompare(b.timeSlot)
      })
  }

  const selectedSessions = sessionsByDay[selectedDay] || []

  // Calculate totals for the week
  const totalSessionsThisWeek = sessions.length
  const totalPlayersThisWeek = sessions.reduce((sum, s) => sum + s.playerCount, 0)

  return (
    <div className="space-y-4">
      {/* Week strip */}
      <div className="grid grid-cols-7 gap-1">
        {DAYS.map((day, i) => {
          const date = weekDates[i]
          const isToday = day === today
          const isSelected = day === selectedDay
          const daySessions = sessionsByDay[day] || []
          const dayPlayerCount = daySessions.reduce((sum, s) => sum + s.playerCount, 0)

          return (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className={`relative flex flex-col items-center py-2 px-1 rounded-xl text-center transition-all ${
                isSelected
                  ? 'bg-primary text-white shadow-md'
                  : isToday
                    ? 'bg-accent/10 text-accent border border-accent/30'
                    : 'bg-white border border-border hover:bg-surface-dark'
              }`}
            >
              <span className="text-xs font-medium">{SHORT_DAYS[i]}</span>
              <span className={`text-lg font-bold ${isSelected ? 'text-white' : ''}`}>
                {date.getDate()}
              </span>
              {daySessions.length > 0 && (
                <div className="flex flex-col items-center mt-0.5">
                  <span className={`text-[10px] font-medium ${isSelected ? 'text-white/80' : 'text-text-light'}`}>
                    {daySessions.length} class{daySessions.length !== 1 ? 'es' : ''}
                  </span>
                  {dayPlayerCount > 0 && (
                    <div className="flex gap-0.5 mt-0.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-accent' : 'bg-accent'}`} />
                      <span className={`text-[10px] ${isSelected ? 'text-white/70' : 'text-text-light'}`}>
                        {dayPlayerCount}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Selected day header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold">
          {selectedDay}
          {selectedDay === today && (
            <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-accent/10 text-accent font-medium">
              Today
            </span>
          )}
        </h3>
        <span className="text-xs text-text-light">
          {selectedSessions.length} class{selectedSessions.length !== 1 ? 'es' : ''} ·{' '}
          {selectedSessions.reduce((s, ss) => s + ss.playerCount, 0)} players
        </span>
      </div>

      {/* Selected day's sessions */}
      {selectedSessions.length === 0 ? (
        <div className="bg-surface rounded-xl p-8 text-center">
          <p className="text-sm text-text-light">No classes scheduled on {selectedDay}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {selectedSessions.map((session) => {
            const isExpanded = expandedGroup === session.id

            return (
              <div
                key={session.id}
                className="rounded-xl border border-border bg-white overflow-hidden transition-all"
              >
                {/* Session header — clickable to expand */}
                <button
                  onClick={() => setExpandedGroup(isExpanded ? null : session.id)}
                  className="w-full p-4 text-left hover:bg-surface/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{session.groupName}</span>
                        <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                          session.playerCount > 0
                            ? 'bg-accent/10 text-accent'
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          {session.playerCount} player{session.playerCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-text-light">
                        {session.location && <span>📍 {session.location}</span>}
                        {session.coachName && <span>👤 {session.coachName}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {session.timeSlot && (
                        <span className="text-lg font-bold text-primary">{session.timeSlot}</span>
                      )}
                      <svg
                        className={`w-4 h-4 text-text-light transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </button>

                {/* Expanded player list */}
                {isExpanded && (
                  <div className="border-t border-border px-4 py-3 bg-surface/30">
                    {session.players.length === 0 ? (
                      <p className="text-xs text-text-light text-center py-2">No players enrolled yet</p>
                    ) : (
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-text-light uppercase tracking-wider mb-2">
                          Enrolled Players
                        </div>
                        {session.players.map((player) => (
                          <div
                            key={player.id}
                            className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/50"
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                                {player.name.charAt(0)}
                              </div>
                              <div>
                                <div className="text-sm font-medium">{player.name}</div>
                                <div className="text-xs text-text-light">{player.parentName}</div>
                              </div>
                            </div>
                            <span className="w-2 h-2 rounded-full bg-accent" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Week summary */}
      <div className="flex items-center justify-between text-xs text-text-light border-t border-border pt-3">
        <span>This week: {totalSessionsThisWeek} classes · {totalPlayersThisWeek} total enrolments</span>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-accent" />
            Has players
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-gray-300" />
            Empty class
          </div>
        </div>
      </div>
    </div>
  )
}
