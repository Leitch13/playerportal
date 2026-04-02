import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import Card from '@/components/Card'
import ScoreBadge from '@/components/ScoreBadge'
import StatusBadge from '@/components/StatusBadge'
import { SCORE_CATEGORIES } from '@/lib/types'
import { normalizeCategories, type ScoringCategory } from '@/lib/scoring-categories'
import PlayerProfileEditor from './PlayerProfileEditor'
import QuickLinkCanva from './QuickLinkCanva'
import PlayerAvatar from '@/components/PlayerAvatar'
import PhotoUpload from '@/components/PhotoUpload'
import RadarChart from '@/components/RadarChart'
import PlayerTimeline from '@/components/PlayerTimeline'
import type { TimelineItem } from '@/components/PlayerTimeline'
import AttendanceStreak from '@/components/AttendanceStreak'

export default async function PlayerDetailPage({
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

  // Fetch custom scoring categories for this org
  const { data: dbScoringCategories } = await supabase
    .from('scoring_categories')
    .select('*')
    .eq('organisation_id', orgId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
  const scoringCategories = normalizeCategories(dbScoringCategories as ScoringCategory[] | null)

  // Fetch player with parent info
  const { data: player } = await supabase
    .from('players')
    .select('*, parent:profiles!players_parent_id_fkey(full_name, email, phone, address, secondary_contact_name, secondary_contact_phone)')
    .eq('id', id)
    .single()

  if (!player) redirect('/dashboard/players')

  // If parent, ensure they own this player
  if (role === 'parent' && player.parent_id !== user.id) {
    redirect('/dashboard/children')
  }

  // Fetch reviews
  const { data: reviews } = await supabase
    .from('progress_reviews')
    .select('*, coach:profiles!progress_reviews_coach_id_fkey(full_name)')
    .eq('player_id', id)
    .order('review_date', { ascending: false })
    .limit(5)

  // Fetch attendance
  const { data: attendance } = await supabase
    .from('attendance')
    .select('id, present, session_date, group:training_groups(name)')
    .eq('player_id', id)
    .order('session_date', { ascending: false })
    .limit(20)

  const totalSessions = (attendance || []).length
  const presentCount = (attendance || []).filter((a) => a.present).length
  const attendanceRate = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 0

  // Fetch enrolments
  const { data: enrolments } = await supabase
    .from('enrolments')
    .select('id, status, group:training_groups(name, day_of_week, time_slot, location)')
    .eq('player_id', id)

  // Fetch documents
  const { data: documents } = await supabase
    .from('documents')
    .select('*')
    .eq('player_id', id)
    .order('created_at', { ascending: false })

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
    .limit(10)

  const parent = player.parent as unknown as {
    full_name: string
    email: string
    phone: string | null
    address: string | null
    secondary_contact_name: string | null
    secondary_contact_phone: string | null
  }

  const isStaff = role === 'admin' || role === 'coach'

  // Calculate attendance streaks
  const sortedAttendance = [...(attendance || [])].sort(
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

  // Build radar chart scores from latest review using custom categories
  const latestReview = (reviews || [])[0]
  const radarScores = latestReview
    ? scoringCategories.map((cat) => ({
        label: cat.label,
        value: (latestReview[cat.key as keyof typeof latestReview] as number) || 0,
      }))
    : []

  // Build timeline items
  const timelineItems: TimelineItem[] = []

  // Add reviews to timeline
  for (const r of reviews || []) {
    timelineItems.push({
      type: 'review',
      date: r.review_date,
      title: `Progress Review by ${(r.coach as unknown as { full_name: string })?.full_name || 'Coach'}`,
      subtitle: r.strengths ? `Strengths: ${r.strengths}` : undefined,
      icon: '\u{1F4CB}',
      color: 'rgba(78, 205, 230, 0.3)',
    })
  }

  // Add absences to timeline (absences only, to keep it interesting)
  for (const a of attendance || []) {
    if (!a.present) {
      timelineItems.push({
        type: 'attendance',
        date: a.session_date,
        title: `Missed session`,
        subtitle: (a.group as unknown as { name: string })?.name || undefined,
        icon: '\u{274C}',
        color: 'rgba(239, 68, 68, 0.2)',
      })
    }
  }

  // Add achievements to timeline
  for (const ach of achievements || []) {
    const achievement = ach.achievement as unknown as { name: string; emoji: string; description: string } | null
    if (achievement) {
      timelineItems.push({
        type: 'achievement',
        date: ach.awarded_at,
        title: `${achievement.emoji} ${achievement.name}`,
        subtitle: achievement.description || undefined,
        icon: '\u{1F3C6}',
        color: 'rgba(245, 158, 11, 0.3)',
      })
    }
  }

  // Add session notes to timeline
  for (const note of sessionNotes || []) {
    timelineItems.push({
      type: 'note',
      date: note.session_date,
      title: note.title || 'Session Note',
      subtitle: (note.group as unknown as { name: string })?.name
        ? `${(note.group as unknown as { name: string }).name} — mentioned in coach notes`
        : 'Mentioned in coach notes',
      icon: '\u{1F4DD}',
      color: 'rgba(99, 102, 241, 0.2)',
    })
  }

  // Sort timeline by date desc
  timelineItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          {isStaff ? (
            <PhotoUpload
              playerId={player.id}
              currentPhotoUrl={player.photo_url}
              firstName={player.first_name}
              lastName={player.last_name}
              size="xl"
            />
          ) : (
            <PlayerAvatar
              photoUrl={player.photo_url}
              firstName={player.first_name}
              lastName={player.last_name}
              size="xl"
            />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <Link href={isStaff ? '/dashboard/players' : '/dashboard/children'} className="text-sm text-white/60 hover:text-white hover:underline mb-1 inline-block">
            &larr; Back
          </Link>
          <h1 className="text-2xl font-bold">{player.first_name} {player.last_name}</h1>
          <div className="flex flex-wrap gap-2 mt-1">
            {player.playing_level && (() => {
              const levelColors: Record<string, string> = { beginner: 'bg-green-500/15 text-green-400', development: 'bg-blue-500/15 text-blue-400', intermediate: 'bg-amber-500/15 text-amber-400', advanced: 'bg-purple-500/15 text-purple-400', elite: 'bg-red-500/15 text-red-400' }
              const levelLabels: Record<string, string> = { beginner: 'Beginner', development: 'Development', intermediate: 'Intermediate', advanced: 'Advanced', elite: 'Elite' }
              return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${levelColors[player.playing_level] || 'bg-white/10 text-white'}`}>{levelLabels[player.playing_level] || player.playing_level}</span>
            })()}
            {player.league_level && (() => {
              const leagueColors: Record<string, string> = { recreational: 'bg-gray-500/15 text-gray-400', grassroots: 'bg-lime-500/15 text-lime-400', b_league: 'bg-sky-500/15 text-sky-400', a_league: 'bg-orange-500/15 text-orange-400', academy: 'bg-violet-500/15 text-violet-400', professional: 'bg-rose-500/15 text-rose-400' }
              const leagueLabels: Record<string, string> = { recreational: 'Recreational', grassroots: 'Grassroots', b_league: 'B League', a_league: 'A League', academy: 'Academy', professional: 'Pro Development' }
              return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${leagueColors[player.league_level] || 'bg-white/10 text-white'}`}>{leagueLabels[player.league_level] || player.league_level}</span>
            })()}
            {player.age_group && <span className="px-2 py-0.5 rounded-full text-xs bg-white/10 text-white font-medium">{player.age_group}</span>}
            {player.position && <span className="px-2 py-0.5 rounded-full text-xs bg-accent/10 text-accent font-medium">{player.position}</span>}
            {player.kit_size && <span className="px-2 py-0.5 rounded-full text-xs bg-white/[0.05] text-white/60 font-medium">Kit: {player.kit_size}</span>}
          </div>
        </div>
        <div className="text-right flex-shrink-0 flex flex-col items-end gap-2">
          <div>
            <div className="text-3xl font-bold text-accent">{attendanceRate}%</div>
            <div className="text-xs text-white/60">Attendance</div>
          </div>
          <Link
            href={`/dashboard/players/${id}/passport`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 transition-colors"
          >
            <span>{'\u{1F3AE}'}</span> Passport
          </Link>
          <Link
            href={`/dashboard/players/${id}/report`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
          >
            <span>{'\u{1F4C4}'}</span> Progress Report
          </Link>
          <Link
            href={`/dashboard/players/${id}/report/print`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Download PDF
          </Link>
          <Link
            href={`/dashboard/players/${id}/highlights`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-purple-500/15 to-pink-500/15 text-purple-400 hover:from-purple-500/25 hover:to-pink-500/25 transition-colors border border-purple-500/10"
          >
            <span>{'\u{2728}'}</span> Monthly Highlights
          </Link>
        </div>
      </div>

      {/* Radar Chart + Attendance Streak */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {radarScores.length > 0 ? (
          <Card title="Skills Overview">
            <RadarChart scores={radarScores} />
            <p className="text-xs text-white/60 text-center mt-2">
              Based on latest review ({new Date(latestReview.review_date).toLocaleDateString()})
            </p>
          </Card>
        ) : (
          <Card>
            <div className="text-center py-8">
              <div className="text-4xl mb-2">{'\u{26BD}'}</div>
              <p className="text-sm text-white/60">No reviews yet</p>
              <p className="text-xs text-white/60 mt-1">Skills chart will appear after the first progress review</p>
            </div>
          </Card>
        )}
        <AttendanceStreak
          currentStreak={currentStreak}
          bestStreak={bestStreak}
          rate={attendanceRate}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Player Info */}
        <Card title="Player Information">
          {isStaff ? (
            <PlayerProfileEditor player={player} />
          ) : (
            <div className="space-y-2 text-sm">
              {player.date_of_birth && <p><span className="text-white/60">DOB:</span> {new Date(player.date_of_birth).toLocaleDateString()}</p>}
              {player.position && <p><span className="text-white/60">Position:</span> {player.position}</p>}
              {player.school && <p><span className="text-white/60">School:</span> {player.school}</p>}
              {player.kit_size && <p><span className="text-white/60">Kit Size:</span> {player.kit_size}</p>}
              {player.notes && <p><span className="text-white/60">Notes:</span> {player.notes}</p>}
            </div>
          )}
        </Card>

        {/* Parent / Emergency Contact */}
        <Card title="Contact Details">
          <div className="space-y-3 text-sm">
            <div>
              <p className="font-medium">{parent?.full_name}</p>
              <p className="text-white/60">{parent?.email}</p>
              {parent?.phone && <p className="text-white/60">{parent.phone}</p>}
              {parent?.address && <p className="text-white/60">{parent.address}</p>}
            </div>
            {(player.emergency_contact_name || parent?.secondary_contact_name) && (
              <div className="pt-2 border-t border-white/[0.08]">
                <p className="text-xs text-white/60 font-medium mb-1">Emergency / Secondary Contact</p>
                {player.emergency_contact_name && (
                  <p>{player.emergency_contact_name} {player.emergency_contact_phone && `— ${player.emergency_contact_phone}`}</p>
                )}
                {parent?.secondary_contact_name && (
                  <p>{parent.secondary_contact_name} {parent?.secondary_contact_phone && `— ${parent.secondary_contact_phone}`}</p>
                )}
              </div>
            )}
            {player.medical_info && (
              <div className="pt-2 border-t border-white/[0.08]">
                <p className="text-xs text-white/60 font-medium mb-1">Medical Info</p>
                <p className="text-danger">{player.medical_info}</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Groups */}
      {(enrolments || []).length > 0 && (
        <Card title="Sessions">
          <div className="divide-y divide-border">
            {(enrolments || []).map((e) => {
              const enr = e as unknown as { id: string; status: string; group: { name: string; day_of_week: string; time_slot: string; location: string } | null }
              return (
                <div key={enr.id} className="py-2 flex items-center justify-between">
                  <div>
                    <span className="font-medium text-sm">{enr.group?.name}</span>
                    <span className="text-xs text-white/60 ml-2">
                      {enr.group?.day_of_week && `${enr.group.day_of_week}`}
                      {enr.group?.time_slot && ` ${enr.group.time_slot}`}
                      {enr.group?.location && ` · ${enr.group.location}`}
                    </span>
                  </div>
                  <StatusBadge status={enr.status} />
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Achievements */}
      {(achievements || []).length > 0 && (
        <Card title="Achievements">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {(achievements || []).map((ach) => {
              const achievement = ach.achievement as unknown as { name: string; emoji: string; description: string } | null
              if (!achievement) return null
              return (
                <div
                  key={ach.id}
                  className="flex flex-col items-center text-center p-3 rounded-lg bg-white/[0.05] border border-white/[0.08] hover:border-accent/30 transition-colors"
                >
                  <span className="text-3xl mb-1">{achievement.emoji}</span>
                  <span className="text-xs font-medium text-text">{achievement.name}</span>
                  <span className="text-[10px] text-white/60 mt-0.5">
                    {new Date(ach.awarded_at).toLocaleDateString()}
                  </span>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Progress Reviews */}
      {(reviews || []).length > 0 && (
        <Card title="Progress Reviews" action={<Link href="/dashboard/feedback" className="text-sm text-primary hover:underline">View all</Link>}>
          <div className="space-y-4">
            {(reviews || []).map((r) => (
              <div key={r.id} className="border-b border-white/[0.08] pb-4 last:border-0 last:pb-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-white/60">
                    {new Date(r.review_date).toLocaleDateString()}
                    {' · '}{(r.coach as unknown as { full_name: string })?.full_name}
                  </span>
                </div>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-2">
                  {scoringCategories.map((cat) => (
                    <div key={cat.key} className="flex flex-col items-center gap-0.5">
                      <ScoreBadge score={(r as Record<string, unknown>)[cat.key] as number} />
                      <span className="text-[10px] text-white/60">{cat.label}</span>
                    </div>
                  ))}
                </div>
                {r.strengths && <p className="text-sm"><span className="text-accent font-medium">Strengths:</span> {r.strengths}</p>}
                {r.focus_next && <p className="text-sm"><span className="text-warning font-medium">Focus:</span> {r.focus_next}</p>}
                {r.parent_summary && <p className="text-sm bg-white/[0.05] rounded-lg p-3 mt-2">{r.parent_summary}</p>}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Activity Timeline */}
      {timelineItems.length > 0 && (
        <Card title="Activity Timeline">
          <PlayerTimeline items={timelineItems} />
        </Card>
      )}

      {/* Canva Documents — featured with embeds */}
      {(() => {
        const canvaDocs = (documents || []).filter((d) => d.doc_type === 'canva')
        const otherDocs = (documents || []).filter((d) => d.doc_type !== 'canva')

        // Convert Canva URL to embed URL
        function getCanvaEmbedUrl(url: string): string | null {
          // Canva share URLs: https://www.canva.com/design/XXXXX/YYYYY/view
          // Embed: add ?embed at the end
          if (url.includes('canva.com/design/')) {
            const cleanUrl = url.split('?')[0]
            return `${cleanUrl}?embed`
          }
          return null
        }

        return (
          <>
            {/* Canva docs with embeds */}
            {canvaDocs.length > 0 && (
              <Card title="Canva Player Notes" action={isStaff ? <Link href={`/dashboard/documents?player=${id}`} className="text-sm text-primary hover:underline">Manage</Link> : undefined}>
                <div className="space-y-4">
                  {canvaDocs.map((d) => {
                    const embedUrl = getCanvaEmbedUrl(d.url as string)
                    return (
                      <div key={d.id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <a href={d.url as string} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-purple-700 hover:underline flex items-center gap-1.5">
                            <span>🎨</span> {d.title}
                          </a>
                          <span className="text-xs text-white/60">{new Date(d.created_at).toLocaleDateString()}</span>
                        </div>
                        {embedUrl && (
                          <div className="rounded-lg overflow-hidden border border-purple-200">
                            <iframe
                              src={embedUrl}
                              className="w-full"
                              style={{ height: '450px', border: 'none' }}
                              allowFullScreen
                              title={d.title as string}
                            />
                          </div>
                        )}
                        {!embedUrl && (
                          <a
                            href={d.url as string}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block bg-purple-50 border border-purple-200 rounded-lg p-6 text-center hover:bg-purple-100 transition-colors"
                          >
                            <span className="text-3xl block mb-2">🎨</span>
                            <span className="text-sm font-medium text-purple-700">Open in Canva</span>
                          </a>
                        )}
                      </div>
                    )
                  })}
                </div>
              </Card>
            )}

            {/* Quick link Canva button (staff only) */}
            {isStaff && (
              <QuickLinkCanva playerId={id} parentId={player.parent_id as string} userId={user.id} orgId={orgId} />
            )}

            {/* Other documents */}
            {otherDocs.length > 0 && (
              <Card title="Documents" action={isStaff ? <Link href={`/dashboard/documents?player=${id}`} className="text-sm text-primary hover:underline">Manage</Link> : undefined}>
                <div className="divide-y divide-border">
                  {otherDocs.map((d) => {
                    const icons: Record<string, string> = { pdf: '📄', image: '🖼️', video: '🎥', link: '🔗' }
                    return (
                      <div key={d.id} className="py-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span>{icons[d.doc_type as string] || '📁'}</span>
                          <div>
                            <a href={d.url as string} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary hover:underline">
                              {d.title}
                            </a>
                            {d.description && <p className="text-xs text-white/60">{d.description as string}</p>}
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-xs bg-white/[0.05] text-white/60">{d.folder as string}</span>
                      </div>
                    )
                  })}
                </div>
              </Card>
            )}
          </>
        )
      })()}

      {/* Recent Attendance */}
      {(attendance || []).length > 0 && (
        <Card title="Recent Attendance">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.08]">
                  <th className="text-left py-2 font-medium">Date</th>
                  <th className="text-left py-2 font-medium">Group</th>
                  <th className="text-left py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {(attendance || []).map((a) => (
                  <tr key={a.id} className="border-b border-white/[0.08] last:border-0">
                    <td className="py-2">{new Date(a.session_date).toLocaleDateString()}</td>
                    <td className="py-2">{(a.group as unknown as { name: string })?.name || '—'}</td>
                    <td className="py-2">
                      <span className={`inline-block w-2 h-2 rounded-full mr-1 ${a.present ? 'bg-accent' : 'bg-danger'}`} />
                      {a.present ? 'Present' : 'Absent'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
