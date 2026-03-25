'use client'

import { useState } from 'react'

interface CalendarSession {
  id: string
  groupName: string
  playerName: string | null // null = available to book
  timeSlot: string
  location: string
  coachName: string
  day: string
  isBooked: boolean
  enrolmentId?: string
  groupId: string
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const SHORT_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function getWeekDates(): Date[] {
  const now = new Date()
  const dayOfWeek = now.getDay() // 0=Sun, 1=Mon...
  const monday = new Date(now)
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

export default function WeeklyCalendar({
  sessions,
}: {
  sessions: CalendarSession[]
}) {
  const [selectedDay, setSelectedDay] = useState<string>(
    new Date().toLocaleDateString('en-GB', { weekday: 'long' })
  )

  const weekDates = getWeekDates()
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long' })

  // Group sessions by day
  const sessionsByDay: Record<string, CalendarSession[]> = {}
  for (const day of DAYS) {
    sessionsByDay[day] = sessions.filter((s) => s.day === day)
  }

  const selectedSessions = sessionsByDay[selectedDay] || []

  return (
    <div className="space-y-4">
      {/* Week strip */}
      <div className="grid grid-cols-7 gap-1">
        {DAYS.map((day, i) => {
          const date = weekDates[i]
          const isToday = day === today
          const isSelected = day === selectedDay
          const hasClasses = (sessionsByDay[day] || []).length > 0
          const bookedCount = (sessionsByDay[day] || []).filter((s) => s.isBooked).length

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
              {hasClasses && (
                <div className="flex gap-0.5 mt-0.5">
                  {bookedCount > 0 && (
                    <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-accent' : 'bg-accent'}`} />
                  )}
                  {(sessionsByDay[day] || []).length - bookedCount > 0 && (
                    <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white/50' : 'bg-border'}`} />
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Selected day's sessions */}
      <div>
        <h3 className="text-sm font-bold mb-2">
          {selectedDay}
          {selectedDay === today && (
            <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-accent/10 text-accent font-medium">
              Today
            </span>
          )}
          <span className="text-text-light font-normal ml-2">
            {selectedSessions.length} class{selectedSessions.length !== 1 ? 'es' : ''}
          </span>
        </h3>

        {selectedSessions.length === 0 ? (
          <div className="bg-surface rounded-xl p-6 text-center">
            <p className="text-sm text-text-light">No classes on {selectedDay}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {selectedSessions.map((session, i) => (
              <div
                key={`${session.groupId}-${session.playerName}-${i}`}
                className={`rounded-xl border p-4 ${
                  session.isBooked
                    ? 'border-accent/30 bg-accent/5'
                    : 'border-border bg-white'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{session.groupName}</span>
                      {session.isBooked && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-accent/10 text-accent font-medium">
                          Booked
                        </span>
                      )}
                    </div>
                    {session.playerName && (
                      <p className="text-xs text-accent font-medium mt-0.5">
                        {session.playerName}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-text-light">
                      {session.location && <span>📍 {session.location}</span>}
                      {session.coachName && <span>👤 {session.coachName}</span>}
                    </div>
                  </div>
                  {session.timeSlot && (
                    <div className="text-right">
                      <span className="text-lg font-bold text-primary">{session.timeSlot}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-text-light">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-accent" />
          Booked
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-border" />
          Available
        </div>
      </div>
    </div>
  )
}
