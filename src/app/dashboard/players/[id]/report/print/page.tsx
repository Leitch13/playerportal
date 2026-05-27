import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { normalizeCategories, type ScoringCategory } from '@/lib/scoring-categories'
import PlayerAvatar from '@/components/PlayerAvatar'
import PrintActions from './PrintActions'

/* ─── Pure SVG Radar Chart ─── */
function RadarChart({ scores, prevScores }: { scores: { label: string; value: number }[]; prevScores?: { label: string; value: number }[] }) {
  const size = 320
  const center = size / 2
  const maxRadius = 120
  const levels = [1, 2, 3, 4, 5]
  const angleStep = (2 * Math.PI) / scores.length
  const startAngle = -Math.PI / 2

  function polar(angle: number, radius: number) {
    return { x: center + radius * Math.cos(angle), y: center + radius * Math.sin(angle) }
  }

  function polygon(values: number[]) {
    return values.map((v, i) => {
      const { x, y } = polar(startAngle + i * angleStep, (v / 5) * maxRadius)
      return `${x},${y}`
    }).join(' ')
  }

  function grid(level: number) {
    return scores.map((_, i) => {
      const { x, y } = polar(startAngle + i * angleStep, (level / 5) * maxRadius)
      return `${x},${y}`
    }).join(' ')
  }

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ maxWidth: '100%', height: 'auto' }}>
      {/* Grid rings */}
      {levels.map((level) => (
        <polygon key={level} points={grid(level)} fill="none" stroke="#cbd5e1" strokeWidth={level === 5 ? 1.2 : 0.5} opacity={level === 5 ? 0.5 : 0.25} />
      ))}
      {/* Spokes */}
      {scores.map((_, i) => {
        const { x, y } = polar(startAngle + i * angleStep, maxRadius)
        return <line key={i} x1={center} y1={center} x2={x} y2={y} stroke="#cbd5e1" strokeWidth={0.5} opacity={0.3} />
      })}
      {/* Previous scores overlay */}
      {prevScores && prevScores.length === scores.length && (
        <polygon points={polygon(prevScores.map(s => s.value))} fill="rgba(148,163,184,0.08)" stroke="rgba(148,163,184,0.4)" strokeWidth={1.5} strokeDasharray="4 3" />
      )}
      {/* Current scores */}
      <polygon points={polygon(scores.map(s => s.value))} fill="rgba(78,205,230,0.15)" stroke="rgba(78,205,230,0.85)" strokeWidth={2} />
      {/* Data points */}
      {scores.map((s, i) => {
        const { x, y } = polar(startAngle + i * angleStep, (s.value / 5) * maxRadius)
        return <circle key={i} cx={x} cy={y} r={3.5} fill="#4ecde6" stroke="white" strokeWidth={1.5} />
      })}
      {/* Labels */}
      {scores.map((s, i) => {
        const angle = startAngle + i * angleStep
        const { x, y } = polar(angle, maxRadius + 24)
        let anchor: 'start' | 'middle' | 'end' = 'middle'
        if (Math.cos(angle) > 0.3) anchor = 'start'
        else if (Math.cos(angle) < -0.3) anchor = 'end'
        return (
          <text key={i} x={x} y={y} textAnchor={anchor} dominantBaseline="central" fill="#475569" style={{ fontSize: '10px', fontFamily: 'system-ui, sans-serif' }}>
            {s.label}
          </text>
        )
      })}
      {/* Level numbers */}
      {levels.map((level) => (
        <text key={level} x={center + 5} y={center - (level / 5) * maxRadius - 3} fill="#94a3b8" style={{ fontSize: '8px' }} opacity={0.5}>
          {level}
        </text>
      ))}
    </svg>
  )
}

/* ─── SVG Line Chart for Progress Over Time ─── */
function ProgressLineChart({ dataPoints }: { dataPoints: { date: string; avg: number }[] }) {
  if (dataPoints.length < 2) return null

  const w = 500
  const h = 180
  const padL = 40
  const padR = 20
  const padT = 20
  const padB = 40
  const chartW = w - padL - padR
  const chartH = h - padT - padB

  const minY = 0
  const maxY = 5
  const xStep = chartW / (dataPoints.length - 1)

  function toX(i: number) { return padL + i * xStep }
  function toY(v: number) { return padT + chartH - ((v - minY) / (maxY - minY)) * chartH }

  const linePath = dataPoints.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i)},${toY(d.avg)}`).join(' ')
  const areaPath = linePath + ` L${toX(dataPoints.length - 1)},${toY(0)} L${toX(0)},${toY(0)} Z`

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} style={{ maxWidth: '100%', height: 'auto' }}>
      {/* Grid lines */}
      {[1, 2, 3, 4, 5].map((v) => (
        <g key={v}>
          <line x1={padL} y1={toY(v)} x2={w - padR} y2={toY(v)} stroke="#e2e8f0" strokeWidth={0.5} />
          <text x={padL - 8} y={toY(v)} textAnchor="end" dominantBaseline="central" fill="#94a3b8" style={{ fontSize: '10px' }}>{v}</text>
        </g>
      ))}
      {/* Area fill */}
      <path d={areaPath} fill="rgba(78,205,230,0.1)" />
      {/* Line */}
      <path d={linePath} fill="none" stroke="#4ecde6" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {/* Data points */}
      {dataPoints.map((d, i) => (
        <g key={i}>
          <circle cx={toX(i)} cy={toY(d.avg)} r={4} fill="#4ecde6" stroke="white" strokeWidth={2} />
          <text x={toX(i)} y={toY(d.avg) - 12} textAnchor="middle" fill="#475569" style={{ fontSize: '9px', fontWeight: 600 }}>
            {d.avg.toFixed(1)}
          </text>
        </g>
      ))}
      {/* X-axis labels */}
      {dataPoints.map((d, i) => (
        <text key={i} x={toX(i)} y={h - 8} textAnchor="middle" fill="#94a3b8" style={{ fontSize: '9px' }}>
          {new Date(d.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
        </text>
      ))}
    </svg>
  )
}

/* ─── Attendance Grid (3 months) ─── */
function AttendanceGrid({ attendance }: { attendance: { session_date: string; present: boolean }[] }) {
  const now = new Date()
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1)

  // Build a map of date => present
  const dateMap = new Map<string, boolean>()
  for (const a of attendance) {
    const d = new Date(a.session_date)
    if (d >= threeMonthsAgo) {
      dateMap.set(a.session_date, a.present)
    }
  }

  // Build 3 months of weeks
  const months: { name: string; days: { date: string; status: 'present' | 'absent' | 'none' }[] }[] = []
  for (let m = 2; m >= 0; m--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - m, 1)
    const monthName = monthDate.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
    const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate()
    const days: { date: string; status: 'present' | 'absent' | 'none' }[] = []
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const hasSess = dateMap.has(dateStr)
      days.push({
        date: dateStr,
        status: hasSess ? (dateMap.get(dateStr) ? 'present' : 'absent') : 'none',
      })
    }
    months.push({ name: monthName, days })
  }

  return (
    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
      {months.map((month) => (
        <div key={month.name} style={{ flex: '1 1 0' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>{month.name}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
            {month.days.map((day) => (
              <div
                key={day.date}
                title={`${day.date}: ${day.status === 'present' ? 'Present' : day.status === 'absent' ? 'Absent' : 'No session'}`}
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '2px',
                  backgroundColor: day.status === 'present' ? '#22c55e' : day.status === 'absent' ? '#ef4444' : '#e2e8f0',
                }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ─── Score Dots (1-5) ─── */
function ScoreDots({ score }: { score: number }) {
  return (
    <div style={{ display: 'flex', gap: '3px' }}>
      {[1, 2, 3, 4, 5].map((v) => (
        <div
          key={v}
          style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            backgroundColor: v <= score ? '#4ecde6' : '#e2e8f0',
          }}
        />
      ))}
    </div>
  )
}

/* ─── Trend Arrow ─── */
function TrendArrow({ current, previous }: { current: number; previous: number }) {
  if (current > previous) return <span style={{ color: '#22c55e', fontWeight: 700 }}>&#8593;</span>
  if (current < previous) return <span style={{ color: '#ef4444', fontWeight: 700 }}>&#8595;</span>
  return <span style={{ color: '#94a3b8', fontWeight: 700 }}>&#8594;</span>
}

export default async function PrintableReportPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, organisation_id')
    .eq('id', user.id)
    .single()

  const role = profile?.role || 'parent'
  const orgId = profile?.organisation_id || ''

  // Fetch player
  const { data: player } = await supabase.from('players').select('*').eq('id', id).single()
  if (!player) redirect('/dashboard/players')

  // Access check
  if (role === 'parent' && player.parent_id !== user.id) redirect('/dashboard/children')
  if ((role === 'admin' || role === 'coach') && player.organisation_id !== orgId) redirect('/dashboard/players')

  // Fetch custom scoring categories
  const { data: dbScoringCategories } = await supabase
    .from('scoring_categories')
    .select('*')
    .eq('organisation_id', orgId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
  const scoringCategories = normalizeCategories(dbScoringCategories as ScoringCategory[] | null)

  // Fetch organisation
  const { data: organisation } = await supabase
    .from('organisations')
    .select('name, logo_url, slug')
    .eq('id', orgId)
    .single()

  // Fetch reviews (up to 10 for trend)
  const { data: reviews } = await supabase
    .from('progress_reviews')
    .select('*, coach:profiles!progress_reviews_coach_id_fkey(full_name)')
    .eq('player_id', id)
    .order('review_date', { ascending: false })
    .limit(10)

  // Fetch all attendance
  const { data: allAttendance } = await supabase
    .from('attendance')
    .select('id, present, session_date, group:training_groups(name)')
    .eq('player_id', id)
    .order('session_date', { ascending: false })

  // Fetch enrolments
  const { data: enrolments } = await supabase
    .from('enrolments')
    .select('id, status, enrolled_at, group:training_groups(name)')
    .eq('player_id', id)
    .eq('status', 'active')

  // Fetch achievements
  const { data: achievements } = await supabase
    .from('player_achievements')
    .select('id, awarded_at, achievement:achievements(name, emoji, description)')
    .eq('player_id', id)
    .order('awarded_at', { ascending: false })
    .limit(6)

  // Fetch session notes
  const { data: sessionNotes } = await supabase
    .from('session_notes')
    .select('id, session_date, title, notes, players_of_note, group:training_groups(name)')
    .ilike('players_of_note', '%' + player.first_name + '%')
    .order('session_date', { ascending: false })
    .limit(3)

  // === Compute stats ===
  const attendance = allAttendance || []
  const totalSessions = attendance.length
  const presentCount = attendance.filter((a) => a.present).length
  const attendanceRate = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 0

  // Enrolment date (earliest)
  const earliestEnrolment = (enrolments || []).reduce((earliest, e) => {
    const enr = e as unknown as { enrolled_at?: string }
    if (enr.enrolled_at && (!earliest || enr.enrolled_at < earliest)) return enr.enrolled_at
    return earliest
  }, '' as string)

  // Groups
  const groupNames = (enrolments || [])
    .map((e) => (e as unknown as { group: { name: string } | null }).group?.name)
    .filter(Boolean)

  // Latest and previous review
  const latestReview = (reviews || [])[0]
  const previousReview = (reviews || [])[1]

  // Per-class-type scoring: filter the org's full category list down to only
  // ones this player has actually been scored on (across their reviews).
  // Without this, players would see empty bars for categories from other class types.
  const LEGACY_KEYS = ['attitude', 'effort', 'technical_quality', 'game_understanding', 'confidence', 'physical_movement']
  const playerScoredKeys = new Set<string>()
  for (const review of reviews || []) {
    const r = review as Record<string, unknown>
    const rs = r.scores as Record<string, number> | null | undefined
    if (rs) Object.keys(rs).forEach((k) => playerScoredKeys.add(k))
    for (const k of LEGACY_KEYS) {
      if (r[k] != null) playerScoredKeys.add(k)
    }
  }
  const filtered = scoringCategories.filter((c) => playerScoredKeys.has(c.key))
  const displayCategories = filtered.length > 0 ? filtered : scoringCategories

  // Radar scores
  const radarScores = latestReview
    ? displayCategories.map((cat) => ({
        label: cat.label,
        value: (latestReview[cat.key as keyof typeof latestReview] as number) || 0,
      }))
    : []

  const prevRadarScores = previousReview
    ? displayCategories.map((cat) => ({
        label: cat.label,
        value: (previousReview[cat.key as keyof typeof previousReview] as number) || 0,
      }))
    : undefined

  // Overall average
  const overallAverage = latestReview && displayCategories.length > 0
    ? displayCategories.reduce((sum, cat) => sum + ((latestReview[cat.key as keyof typeof latestReview] as number) || 0), 0) / displayCategories.length
    : 0

  // Progress over time (last 5 reviews, ascending)
  const progressData = (reviews || [])
    .slice(0, 5)
    .reverse()
    .map((r) => {
      const avg = displayCategories.length > 0
        ? displayCategories.reduce((sum, cat) => sum + ((r[cat.key as keyof typeof r] as number) || 0), 0) / displayCategories.length
        : 0
      return { date: r.review_date, avg }
    })

  // Score breakdown with trends
  const scoreBreakdown = displayCategories.map((cat) => {
    const current = latestReview ? ((latestReview[cat.key as keyof typeof latestReview] as number) || 0) : 0
    const previous = previousReview ? ((previousReview[cat.key as keyof typeof previousReview] as number) || 0) : 0
    return { label: cat.label, key: cat.key, current, previous, icon: cat.icon }
  })

  // Strengths and areas to develop
  const strengths: string[] = []
  const areasToImprove: string[] = []
  if (latestReview) {
    for (const cat of displayCategories) {
      const score = (latestReview[cat.key as keyof typeof latestReview] as number) || 0
      if (score >= 4) strengths.push(cat.label)
      if (score <= 2) areasToImprove.push(cat.label)
    }
  }

  const reportDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="print-report-wrapper">
      <PrintActions playerId={id} />

      {/* === PRINT STYLES (scoped via class) === */}
      <style>{`
        @media print {
          @page {
            margin: 1.5cm;
            size: A4;
          }
          body {
            background: white !important;
            color: #0f172a !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-report-wrapper {
            background: white !important;
          }
          .print-report {
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
          }
          .no-print, nav, .mobile-bottom-nav {
            display: none !important;
          }
          .page-break {
            page-break-before: always;
          }
          .avoid-break {
            page-break-inside: avoid;
          }
        }

        @media screen {
          .print-report-wrapper {
            max-width: 800px;
            margin: -1.5rem auto;
            padding: 1.5rem;
            min-height: 100vh;
            background: #0a0a0a;
          }
          .print-report {
            box-shadow: 0 4px 24px rgba(0,0,0,0.4) !important;
          }
        }
        @media screen and (min-width: 1024px) {
          .print-report-wrapper {
            margin: -2rem auto;
            padding: 2rem;
          }
        }
      `}</style>

      <div className="print-report" style={{
        background: 'white',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: '#0f172a',
        lineHeight: 1.5,
      }}>

        {/* ─── HEADER ─── */}
        <div className="avoid-break" style={{
          padding: '32px',
          borderBottom: '2px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {organisation?.logo_url ? (
              <img src={organisation.logo_url} alt={organisation.name || ''} style={{ width: '48px', height: '48px', objectFit: 'contain', borderRadius: '8px' }} />
            ) : (
              <div style={{
                width: '48px', height: '48px', borderRadius: '8px',
                background: 'rgba(78,205,230,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="24" height="24" fill="none" stroke="#4ecde6" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
            )}
            <div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>{organisation?.name || 'Academy'}</div>
              <div style={{ fontSize: '14px', color: '#64748b', fontWeight: 500 }}>Player Progress Report</div>
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: '13px', color: '#64748b' }}>
            <div>{reportDate}</div>
          </div>
        </div>

        {/* ─── PLAYER SUMMARY CARD ─── */}
        <div className="avoid-break" style={{
          padding: '24px 32px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          gap: '20px',
        }}>
          <PlayerAvatar
            photoUrl={player.photo_url}
            firstName={player.first_name}
            lastName={player.last_name}
            size="lg"
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '22px', fontWeight: 700 }}>{player.first_name} {player.last_name}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginTop: '4px', fontSize: '13px', color: '#64748b' }}>
              {player.age_group && <span>Age Group: <strong style={{ color: '#0f172a' }}>{player.age_group}</strong></span>}
              {player.position && <span>Position: <strong style={{ color: '#0f172a' }}>{player.position}</strong></span>}
              {player.date_of_birth && <span>DOB: <strong style={{ color: '#0f172a' }}>{new Date(player.date_of_birth).toLocaleDateString('en-GB')}</strong></span>}
            </div>
            {groupNames.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                {groupNames.map((name, i) => (
                  <span key={i} style={{ padding: '2px 10px', borderRadius: '99px', fontSize: '11px', background: 'rgba(78,205,230,0.1)', color: '#0e7490', fontWeight: 600 }}>
                    {name}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div style={{ textAlign: 'center', flexShrink: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', textAlign: 'center' }}>
              <div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: '#4ecde6' }}>{totalSessions}</div>
                <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sessions</div>
              </div>
              <div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: attendanceRate >= 80 ? '#22c55e' : attendanceRate >= 60 ? '#f59e0b' : '#ef4444' }}>{attendanceRate}%</div>
                <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Attendance</div>
              </div>
            </div>
            {earliestEnrolment && (
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '8px' }}>
                Member since {new Date(earliestEnrolment).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
              </div>
            )}
          </div>
        </div>

        {/* ─── ATTENDANCE BAR ─── */}
        {totalSessions === 0 && (
          <div className="avoid-break" style={{ padding: '16px 32px', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, width: '100px' }}>Attendance</span>
              <span style={{ fontSize: '13px', color: '#94a3b8' }}>No sessions recorded yet</span>
            </div>
          </div>
        )}
        {totalSessions > 0 && (
          <div className="avoid-break" style={{ padding: '16px 32px', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, width: '100px' }}>Attendance</span>
              <div style={{ flex: 1, height: '10px', background: '#f1f5f9', borderRadius: '99px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${attendanceRate}%`,
                  borderRadius: '99px',
                  background: attendanceRate >= 80 ? '#22c55e' : attendanceRate >= 60 ? '#f59e0b' : '#ef4444',
                }} />
              </div>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', width: '40px', textAlign: 'right' }}>{attendanceRate}%</span>
            </div>
          </div>
        )}

        {/* ─── NO REVIEWS FALLBACK ─── */}
        {!latestReview && (
          <div className="avoid-break" style={{ padding: '32px', textAlign: 'center', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '4px' }}>No progress reviews have been recorded yet.</div>
            <div style={{ fontSize: '12px', color: '#cbd5e1' }}>Scores and feedback will appear here after the first coach review.</div>
          </div>
        )}

        {/* ─── SCORING OVERVIEW ─── */}
        {radarScores.length > 0 && (
          <div className="avoid-break" style={{ padding: '24px 32px', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>
              Skills Assessment
              {latestReview && (
                <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, marginLeft: '8px' }}>
                  (Review: {new Date(latestReview.review_date).toLocaleDateString('en-GB')})
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <span style={{ fontSize: '36px', fontWeight: 700, color: '#4ecde6' }}>{overallAverage.toFixed(1)}</span>
              <span style={{ fontSize: '14px', color: '#94a3b8' }}>/ 5.0 overall</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>
              <RadarChart scores={radarScores} prevScores={prevRadarScores} />
              <div>
                {/* Score bars */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {radarScores.map((s) => (
                    <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '12px', color: '#475569', width: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</span>
                      <div style={{ flex: 1, height: '8px', background: '#f1f5f9', borderRadius: '99px', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: '99px',
                          width: `${(s.value / 5) * 100}%`,
                          backgroundColor: s.value >= 4 ? '#4ecde6' : s.value >= 3 ? '#f59e0b' : '#ef4444',
                        }} />
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: 700, width: '20px', textAlign: 'right' }}>{s.value}</span>
                    </div>
                  ))}
                </div>
                {prevRadarScores && (
                  <div style={{ marginTop: '12px', fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ display: 'inline-block', width: '20px', borderTop: '2px dashed #94a3b8' }} />
                    Previous review
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── SCORE BREAKDOWN TABLE ─── */}
        {scoreBreakdown.length > 0 && latestReview && (
          <div className="avoid-break" style={{ padding: '24px 32px', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>
              Score Breakdown
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ textAlign: 'left', padding: '8px 0', color: '#64748b', fontWeight: 600, fontSize: '11px' }}>Category</th>
                  <th style={{ textAlign: 'center', padding: '8px 0', color: '#64748b', fontWeight: 600, fontSize: '11px' }}>Current</th>
                  <th style={{ textAlign: 'center', padding: '8px 0', color: '#64748b', fontWeight: 600, fontSize: '11px' }}>Previous</th>
                  <th style={{ textAlign: 'center', padding: '8px 0', color: '#64748b', fontWeight: 600, fontSize: '11px' }}>Trend</th>
                </tr>
              </thead>
              <tbody>
                {scoreBreakdown.map((row) => (
                  <tr key={row.key} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 0', fontWeight: 500 }}>{row.label}</td>
                    <td style={{ textAlign: 'center', padding: '10px 0' }}>
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <ScoreDots score={row.current} />
                      </div>
                    </td>
                    <td style={{ textAlign: 'center', padding: '10px 0', color: '#94a3b8' }}>
                      {row.previous > 0 ? (
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                          <ScoreDots score={row.previous} />
                        </div>
                      ) : (
                        <span style={{ fontSize: '12px' }}>--</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center', padding: '10px 0', fontSize: '16px' }}>
                      {row.previous > 0 ? <TrendArrow current={row.current} previous={row.previous} /> : <span style={{ color: '#94a3b8' }}>--</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ─── ATTENDANCE SUMMARY (calendar grid) ─── */}
        {totalSessions > 0 && (
          <div className="avoid-break" style={{ padding: '24px 32px', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>
              Attendance &mdash; Last 3 Months
            </div>
            <AttendanceGrid attendance={attendance.map(a => ({ session_date: a.session_date, present: a.present }))} />
            <div style={{ display: 'flex', gap: '16px', marginTop: '12px', fontSize: '11px', color: '#94a3b8' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#22c55e', display: 'inline-block' }} /> Present
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#ef4444', display: 'inline-block' }} /> Absent
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#e2e8f0', display: 'inline-block' }} /> No session
              </span>
              <span style={{ marginLeft: 'auto' }}>{presentCount} / {totalSessions} sessions attended</span>
            </div>
          </div>
        )}

        {/* ─── COACH COMMENTS ─── */}
        {latestReview && (
          <div className="avoid-break" style={{ padding: '24px 32px', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>
              Coach Feedback
            </div>
            {latestReview.parent_summary && (
              <div style={{
                background: '#f8fafc', borderRadius: '8px', padding: '16px', marginBottom: '16px',
                borderLeft: '4px solid #4ecde6', fontSize: '14px', color: '#334155', lineHeight: 1.6,
              }}>
                {latestReview.parent_summary}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {latestReview.strengths && (
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#22c55e', marginBottom: '4px' }}>Strengths</div>
                  <div style={{ fontSize: '13px', color: '#475569' }}>{latestReview.strengths}</div>
                </div>
              )}
              {latestReview.focus_next && (
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#f59e0b', marginBottom: '4px' }}>Focus Areas</div>
                  <div style={{ fontSize: '13px', color: '#475569' }}>{latestReview.focus_next}</div>
                </div>
              )}
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '12px' }}>
              Reviewed by {(latestReview.coach as unknown as { full_name: string })?.full_name || 'Coach'} on {new Date(latestReview.review_date).toLocaleDateString('en-GB')}
            </div>
          </div>
        )}

        {/* ─── SESSION NOTES ─── */}
        {(sessionNotes || []).length > 0 && (
          <div className="avoid-break" style={{ padding: '24px 32px', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>
              Recent Session Notes
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {(sessionNotes || []).map((note) => (
                <div key={note.id} style={{ display: 'flex', gap: '12px', fontSize: '13px' }}>
                  <div style={{ flexShrink: 0, fontSize: '11px', color: '#94a3b8', width: '70px', paddingTop: '2px' }}>
                    {new Date(note.session_date).toLocaleDateString('en-GB')}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: '#334155' }}>
                      {note.title || 'Session Note'}
                      {(note.group as unknown as { name: string })?.name && (
                        <span style={{ fontWeight: 400, color: '#94a3b8' }}> &mdash; {(note.group as unknown as { name: string }).name}</span>
                      )}
                    </div>
                    <div style={{ color: '#64748b', marginTop: '2px' }}>{note.notes}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── PROGRESS OVER TIME ─── */}
        {progressData.length >= 2 && (
          <div className="avoid-break" style={{ padding: '24px 32px', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>
              Progress Over Time
            </div>
            <ProgressLineChart dataPoints={progressData} />
          </div>
        )}

        {/* ─── AREAS OF STRENGTH & DEVELOPMENT ─── */}
        {(strengths.length > 0 || areasToImprove.length > 0) && (
          <div className="avoid-break" style={{ padding: '24px 32px', borderBottom: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#22c55e', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>
                Areas of Strength
              </div>
              {strengths.length > 0 ? (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {strengths.map((s) => (
                    <li key={s} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
                      {s}
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ fontSize: '13px', color: '#94a3b8' }}>Keep working hard!</p>
              )}
            </div>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>
                Areas to Develop
              </div>
              {areasToImprove.length > 0 ? (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {areasToImprove.map((s) => (
                    <li key={s} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b', flexShrink: 0 }} />
                      {s}
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ fontSize: '13px', color: '#94a3b8' }}>All areas performing well.</p>
              )}
            </div>
          </div>
        )}

        {/* ─── NEXT STEPS / GOALS ─── */}
        <div className="avoid-break" style={{ padding: '24px 32px', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>
            Next Steps &amp; Goals
          </div>
          {latestReview?.focus_next ? (
            <div style={{ background: '#fffbeb', borderRadius: '8px', padding: '16px', borderLeft: '4px solid #f59e0b' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#92400e', marginBottom: '4px' }}>Coach Recommendations</div>
              <div style={{ fontSize: '13px', color: '#78350f' }}>{latestReview.focus_next}</div>
            </div>
          ) : (
            <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '16px', border: '1px dashed #cbd5e1' }}>
              <div style={{ fontSize: '13px', color: '#94a3b8', textAlign: 'center' }}>
                Goals will be set by the coaching team in the next review.
              </div>
            </div>
          )}
        </div>

        {/* ─── ACHIEVEMENTS ─── */}
        {(achievements || []).length > 0 && (
          <div className="avoid-break" style={{ padding: '24px 32px', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>
              Achievements
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              {(achievements || []).map((ach) => {
                const achievement = ach.achievement as unknown as { name: string; emoji: string; description: string } | null
                if (!achievement) return null
                return (
                  <div key={ach.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '22px', flexShrink: 0 }}>{achievement.emoji}</span>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 600 }}>{achievement.name}</div>
                      <div style={{ fontSize: '10px', color: '#94a3b8' }}>{new Date(ach.awarded_at).toLocaleDateString('en-GB')}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ─── FOOTER ─── */}
        <div style={{ padding: '20px 32px', textAlign: 'center', fontSize: '11px', color: '#94a3b8', background: '#f8fafc' }}>
          <div>Report generated by <strong>{organisation?.name || 'Academy'}</strong> via Player Portal</div>
          <div style={{ marginTop: '2px' }}>{reportDate}</div>
        </div>
      </div>
    </div>
  )
}
