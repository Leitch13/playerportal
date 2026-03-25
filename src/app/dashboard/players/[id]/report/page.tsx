import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SCORE_CATEGORIES } from '@/lib/types'
import PlayerAvatar from '@/components/PlayerAvatar'
import ReportActions from './ReportActions'

// Inline SVG radar chart for print-friendliness (no client JS needed)
function PrintRadarChart({ scores }: { scores: { label: string; value: number }[] }) {
  const size = 280
  const center = size / 2
  const maxRadius = 110
  const levels = [1, 2, 3, 4, 5]
  const angleStep = (2 * Math.PI) / scores.length
  const startAngle = -Math.PI / 2

  function polarToXY(angle: number, radius: number) {
    return {
      x: center + radius * Math.cos(angle),
      y: center + radius * Math.sin(angle),
    }
  }

  function getPolygonPoints(values: number[]) {
    return values
      .map((v, i) => {
        const angle = startAngle + i * angleStep
        const r = (v / 5) * maxRadius
        const { x, y } = polarToXY(angle, r)
        return `${x},${y}`
      })
      .join(' ')
  }

  function getGridPoints(level: number) {
    const r = (level / 5) * maxRadius
    return scores
      .map((_, i) => {
        const angle = startAngle + i * angleStep
        const { x, y } = polarToXY(angle, r)
        return `${x},${y}`
      })
      .join(' ')
  }

  const dataPoints = getPolygonPoints(scores.map((s) => s.value))

  return (
    <div className="flex items-center justify-center">
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="max-w-full h-auto">
        {levels.map((level) => (
          <polygon
            key={level}
            points={getGridPoints(level)}
            fill="none"
            stroke="#94a3b8"
            strokeWidth={level === 5 ? 1.5 : 0.5}
            opacity={level === 5 ? 0.6 : 0.3}
          />
        ))}
        {scores.map((_, i) => {
          const angle = startAngle + i * angleStep
          const { x, y } = polarToXY(angle, maxRadius)
          return (
            <line
              key={i}
              x1={center}
              y1={center}
              x2={x}
              y2={y}
              stroke="#94a3b8"
              strokeWidth={0.5}
              opacity={0.4}
            />
          )
        })}
        <polygon
          points={dataPoints}
          fill="rgba(78, 205, 230, 0.2)"
          stroke="rgba(78, 205, 230, 0.8)"
          strokeWidth={2}
        />
        {scores.map((s, i) => {
          const angle = startAngle + i * angleStep
          const r = (s.value / 5) * maxRadius
          const { x, y } = polarToXY(angle, r)
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={4}
              fill="rgba(78, 205, 230, 1)"
              stroke="white"
              strokeWidth={1.5}
            />
          )
        })}
        {scores.map((s, i) => {
          const angle = startAngle + i * angleStep
          const labelR = maxRadius + 22
          const { x, y } = polarToXY(angle, labelR)
          let textAnchor: 'start' | 'middle' | 'end' = 'middle'
          if (Math.cos(angle) > 0.3) textAnchor = 'start'
          else if (Math.cos(angle) < -0.3) textAnchor = 'end'
          return (
            <text
              key={i}
              x={x}
              y={y}
              textAnchor={textAnchor}
              dominantBaseline="central"
              fill="#64748b"
              style={{ fontSize: '10px' }}
            >
              {s.label}
            </text>
          )
        })}
        {levels.map((level) => {
          const r = (level / 5) * maxRadius
          return (
            <text
              key={level}
              x={center + 6}
              y={center - r - 2}
              fill="#94a3b8"
              style={{ fontSize: '8px' }}
              opacity={0.5}
            >
              {level}
            </text>
          )
        })}
      </svg>
    </div>
  )
}

function OverallRating({ average }: { average: number }) {
  const fullStars = Math.floor(average)
  const hasHalf = average - fullStars >= 0.25 && average - fullStars < 0.75
  const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0)

  return (
    <div className="flex items-center gap-3">
      <span className="text-4xl font-bold text-accent">{average.toFixed(1)}</span>
      <div className="flex items-center gap-0.5">
        {Array.from({ length: fullStars }).map((_, i) => (
          <svg key={`full-${i}`} className="w-6 h-6 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
        {hasHalf && (
          <svg className="w-6 h-6 text-amber-400" viewBox="0 0 20 20">
            <defs>
              <linearGradient id="half-star">
                <stop offset="50%" stopColor="currentColor" />
                <stop offset="50%" stopColor="#e2e8f0" />
              </linearGradient>
            </defs>
            <path fill="url(#half-star)" d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        )}
        {Array.from({ length: emptyStars }).map((_, i) => (
          <svg key={`empty-${i}`} className="w-6 h-6 text-gray-200" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>
      <span className="text-sm text-text-light">/ 5.0</span>
    </div>
  )
}

export default async function PlayerReportPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, organisation_id')
    .eq('id', user.id)
    .single()

  const role = profile?.role || 'parent'
  const orgId = profile?.organisation_id || ''

  // Fetch player
  const { data: player } = await supabase
    .from('players')
    .select('*')
    .eq('id', id)
    .single()

  if (!player) redirect('/dashboard/players')

  // Access check: parent must own the player OR user must be admin/coach in same org
  if (role === 'parent' && player.parent_id !== user.id) {
    redirect('/dashboard/children')
  }
  if ((role === 'admin' || role === 'coach') && player.organisation_id !== orgId) {
    redirect('/dashboard/players')
  }

  // Fetch organisation for header
  const { data: organisation } = await supabase
    .from('organisations')
    .select('name, logo_url')
    .eq('id', orgId)
    .single()

  // Fetch reviews (all for the report, not just 5)
  const { data: reviews } = await supabase
    .from('progress_reviews')
    .select('*, coach:profiles!progress_reviews_coach_id_fkey(full_name)')
    .eq('player_id', id)
    .order('review_date', { ascending: false })
    .limit(10)

  // Fetch all attendance for stats
  const { data: allAttendance } = await supabase
    .from('attendance')
    .select('id, present, session_date, group:training_groups(name)')
    .eq('player_id', id)
    .order('session_date', { ascending: false })

  // Fetch enrolments
  const { data: enrolments } = await supabase
    .from('enrolments')
    .select('id, status, group:training_groups(name)')
    .eq('player_id', id)
    .eq('status', 'active')

  // Fetch achievements
  const { data: achievements } = await supabase
    .from('player_achievements')
    .select('id, awarded_at, achievement:achievements(name, emoji, description)')
    .eq('player_id', id)
    .order('awarded_at', { ascending: false })
    .limit(10)

  // Fetch session notes that mention this player
  const { data: sessionNotes } = await supabase
    .from('session_notes')
    .select('id, session_date, title, notes, players_of_note, group:training_groups(name)')
    .ilike('players_of_note', '%' + player.first_name + '%')
    .order('session_date', { ascending: false })
    .limit(5)

  // === Compute stats ===
  const attendance = allAttendance || []
  const totalSessions = attendance.length
  const presentCount = attendance.filter((a) => a.present).length
  const attendanceRate = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 0

  // Attendance streak
  const sortedAttendance = [...attendance].sort(
    (a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime()
  )
  let currentStreak = 0
  for (const a of sortedAttendance) {
    if (a.present) currentStreak++
    else break
  }
  let bestStreak = 0
  let tempStreak = 0
  for (const a of sortedAttendance) {
    if (a.present) {
      tempStreak++
      if (tempStreak > bestStreak) bestStreak = tempStreak
    } else {
      tempStreak = 0
    }
  }

  // Latest review + radar scores
  const latestReview = (reviews || [])[0]
  const radarScores = latestReview
    ? SCORE_CATEGORIES.map((cat) => ({
        label: cat.label,
        value: (latestReview[cat.key] as number) || 0,
      }))
    : []

  // Overall average from latest review
  const overallAverage = latestReview
    ? SCORE_CATEGORIES.reduce((sum, cat) => sum + ((latestReview[cat.key] as number) || 0), 0) /
      SCORE_CATEGORIES.length
    : 0

  // Areas of strength (score >= 4) and areas to develop (score <= 2) from latest review
  const strengths: string[] = []
  const areasToImprove: string[] = []
  if (latestReview) {
    for (const cat of SCORE_CATEGORIES) {
      const score = (latestReview[cat.key] as number) || 0
      if (score >= 4) strengths.push(cat.label)
      if (score <= 2) areasToImprove.push(cat.label)
    }
  }

  // Groups list
  const groupNames = (enrolments || [])
    .map((e) => {
      const enr = e as unknown as { group: { name: string } | null }
      return enr.group?.name
    })
    .filter(Boolean)

  const reportDate = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="max-w-3xl mx-auto">
      <ReportActions playerId={id} />

      {/* === PRINTABLE REPORT === */}
      <div className="bg-white rounded-xl border border-border print:border-0 print:rounded-none print:shadow-none">
        {/* Report Header */}
        <div className="border-b border-border px-8 py-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {organisation?.logo_url ? (
              <img
                src={organisation.logo_url}
                alt={organisation.name || 'Academy'}
                className="w-12 h-12 object-contain rounded"
              />
            ) : (
              <div className="w-12 h-12 rounded bg-accent/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold text-text">{organisation?.name || 'Academy'}</h1>
              <p className="text-sm text-text-light">Player Progress Report</p>
            </div>
          </div>
          <div className="text-right text-sm text-text-light">
            <p>{reportDate}</p>
          </div>
        </div>

        {/* Player Info */}
        <div className="px-8 py-6 border-b border-border flex items-center gap-5">
          <PlayerAvatar
            photoUrl={player.photo_url}
            firstName={player.first_name}
            lastName={player.last_name}
            size="lg"
          />
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-text">
              {player.first_name} {player.last_name}
            </h2>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-text-light">
              {player.age_group && <span>Age Group: <strong className="text-text">{player.age_group}</strong></span>}
              {player.position && <span>Position: <strong className="text-text">{player.position}</strong></span>}
              {player.date_of_birth && (
                <span>DOB: <strong className="text-text">{new Date(player.date_of_birth).toLocaleDateString('en-GB')}</strong></span>
              )}
            </div>
            {groupNames.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {groupNames.map((name, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-full text-xs bg-accent/10 text-accent font-medium">
                    {name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Overall Rating */}
        {latestReview && (
          <div className="px-8 py-6 border-b border-border">
            <h3 className="text-sm font-semibold text-text-light uppercase tracking-wide mb-3">Overall Rating</h3>
            <OverallRating average={overallAverage} />
            <p className="text-xs text-text-light mt-2">
              Based on latest review ({new Date(latestReview.review_date).toLocaleDateString('en-GB')})
            </p>
          </div>
        )}

        {/* Skills Radar + Score Breakdown */}
        {radarScores.length > 0 && (
          <div className="px-8 py-6 border-b border-border">
            <h3 className="text-sm font-semibold text-text-light uppercase tracking-wide mb-4">Skills Assessment</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
              <PrintRadarChart scores={radarScores} />
              <div className="space-y-3">
                {radarScores.map((s) => (
                  <div key={s.label} className="flex items-center gap-3">
                    <span className="text-sm text-text w-36 truncate">{s.label}</span>
                    <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(s.value / 5) * 100}%`,
                          backgroundColor: s.value >= 4 ? '#4ecde6' : s.value >= 3 ? '#f59e0b' : '#ef4444',
                        }}
                      />
                    </div>
                    <span className="text-sm font-semibold w-6 text-right text-text">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Attendance Summary */}
        <div className="px-8 py-6 border-b border-border">
          <h3 className="text-sm font-semibold text-text-light uppercase tracking-wide mb-4">Attendance Summary</h3>
          {totalSessions > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center p-3 rounded-lg bg-surface">
                <div className="text-2xl font-bold text-text">{totalSessions}</div>
                <div className="text-xs text-text-light mt-0.5">Total Sessions</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-surface">
                <div className="text-2xl font-bold text-accent">{presentCount}</div>
                <div className="text-xs text-text-light mt-0.5">Present</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-surface">
                <div className="text-2xl font-bold" style={{ color: attendanceRate >= 80 ? '#4ecde6' : attendanceRate >= 60 ? '#f59e0b' : '#ef4444' }}>
                  {attendanceRate}%
                </div>
                <div className="text-xs text-text-light mt-0.5">Attendance Rate</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-surface">
                <div className="text-2xl font-bold text-text">{currentStreak}</div>
                <div className="text-xs text-text-light mt-0.5">Current Streak</div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-text-light">No attendance records yet.</p>
          )}
        </div>

        {/* Areas of Strength & Development */}
        {latestReview && (strengths.length > 0 || areasToImprove.length > 0) && (
          <div className="px-8 py-6 border-b border-border grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-text-light uppercase tracking-wide mb-3">Areas of Strength</h3>
              {strengths.length > 0 ? (
                <ul className="space-y-2">
                  {strengths.map((s) => (
                    <li key={s} className="flex items-center gap-2 text-sm">
                      <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs flex-shrink-0">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      </span>
                      {s}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-text-light">Keep working hard!</p>
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text-light uppercase tracking-wide mb-3">Areas to Develop</h3>
              {areasToImprove.length > 0 ? (
                <ul className="space-y-2">
                  {areasToImprove.map((s) => (
                    <li key={s} className="flex items-center gap-2 text-sm">
                      <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-xs flex-shrink-0">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                      </span>
                      {s}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-text-light">All areas performing well.</p>
              )}
            </div>
          </div>
        )}

        {/* Achievements */}
        {(achievements || []).length > 0 && (
          <div className="px-8 py-6 border-b border-border">
            <h3 className="text-sm font-semibold text-text-light uppercase tracking-wide mb-4">Achievements</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {(achievements || []).map((ach) => {
                const achievement = ach.achievement as unknown as { name: string; emoji: string; description: string } | null
                if (!achievement) return null
                return (
                  <div
                    key={ach.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border"
                  >
                    <span className="text-2xl flex-shrink-0">{achievement.emoji}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text truncate">{achievement.name}</p>
                      <p className="text-xs text-text-light">
                        {new Date(ach.awarded_at).toLocaleDateString('en-GB')}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Coach Notes / Reviews */}
        {(reviews || []).length > 0 && (
          <div className="px-8 py-6 border-b border-border">
            <h3 className="text-sm font-semibold text-text-light uppercase tracking-wide mb-4">Coach Feedback</h3>
            <div className="space-y-4">
              {(reviews || []).slice(0, 3).map((r) => (
                <div key={r.id} className="border border-border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-text">
                      {(r.coach as unknown as { full_name: string })?.full_name || 'Coach'}
                    </span>
                    <span className="text-xs text-text-light">
                      {new Date(r.review_date).toLocaleDateString('en-GB')}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {SCORE_CATEGORIES.map((cat) => {
                      const score = r[cat.key] as number
                      return (
                        <span
                          key={cat.key}
                          className={`score-${score} inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium`}
                        >
                          {cat.label}: {score}
                        </span>
                      )
                    })}
                  </div>
                  {r.strengths && (
                    <p className="text-sm mb-1">
                      <span className="font-medium text-emerald-600">Strengths:</span> {r.strengths}
                    </p>
                  )}
                  {r.focus_next && (
                    <p className="text-sm mb-1">
                      <span className="font-medium text-amber-600">Focus Areas:</span> {r.focus_next}
                    </p>
                  )}
                  {r.parent_summary && (
                    <p className="text-sm bg-surface rounded-lg p-3 mt-2 text-text-light italic">
                      {r.parent_summary}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Session Notes */}
        {(sessionNotes || []).length > 0 && (
          <div className="px-8 py-6 border-b border-border">
            <h3 className="text-sm font-semibold text-text-light uppercase tracking-wide mb-4">Session Notes</h3>
            <div className="space-y-3">
              {(sessionNotes || []).map((note) => (
                <div key={note.id} className="flex gap-3 text-sm">
                  <div className="flex-shrink-0 text-xs text-text-light w-20 pt-0.5">
                    {new Date(note.session_date).toLocaleDateString('en-GB')}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-text">
                      {note.title || 'Session Note'}
                      {(note.group as unknown as { name: string })?.name && (
                        <span className="font-normal text-text-light"> &mdash; {(note.group as unknown as { name: string }).name}</span>
                      )}
                    </p>
                    <p className="text-text-light mt-0.5 line-clamp-2">{note.notes}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-8 py-4 text-center text-xs text-text-light">
          <p>Generated by Player Portal &middot; {reportDate}</p>
          <p className="mt-0.5">This report is based on data available at the time of generation.</p>
        </div>
      </div>
    </div>
  )
}
