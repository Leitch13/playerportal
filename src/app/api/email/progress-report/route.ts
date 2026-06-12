import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email'
import { progressReportEmail, progressReportEmailPremium, progressReportEmailPremiumV2 } from '@/lib/email-templates'
import { normalizeCategories, type ScoringCategory } from '@/lib/scoring-categories'
import { REPORT_EMAIL_IDEMPOTENCY_ENABLED } from '@/lib/report-visibility'
import { REPORTS_PREMIUM_EMAIL_ENABLED, REPORTS_PREMIUM_EMAIL_V2_ENABLED, emailVerdict, buildSnapshot } from '@/lib/report-email-premium'

const FALLBACK_SCORE_CATEGORIES = [
  { key: 'attitude', label: 'Attitude' },
  { key: 'effort', label: 'Effort' },
  { key: 'technical_quality', label: 'Technical Quality' },
  { key: 'game_understanding', label: 'Game Understanding' },
  { key: 'confidence', label: 'Confidence' },
  { key: 'physical_movement', label: 'Physical Movement' },
]

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  // Verify caller is a coach/admin
  const { data: role } = await supabase.rpc('get_my_role')
  if (!role || !['admin', 'coach'].includes(role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { playerId, scores, strengths, focusAreas, coachComment } = await request.json()
  if (!playerId) {
    return NextResponse.json({ error: 'Missing playerId' }, { status: 400 })
  }

  // Get player + parent
  const { data: player } = await supabase
    .from('players')
    .select('id, first_name, last_name, parent_id, profiles!players_parent_id_fkey(full_name, email)')
    .eq('id', playerId)
    .single()

  if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 })

  const parent = player.profiles as unknown as { full_name: string; email: string } | null
  if (!parent?.email) return NextResponse.json({ error: 'No parent email' }, { status: 400 })

  // Get org name (+ logo for the premium email)
  const { data: orgId } = await supabase.rpc('get_my_org')
  const { data: org } = await supabase.from('organisations').select('name, logo_url').eq('id', orgId).single()

  // Fetch custom scoring categories for this org
  const { data: dbScoringCats } = await supabase
    .from('scoring_categories')
    .select('*')
    .eq('organisation_id', orgId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
  const scoringCategories = (dbScoringCats as ScoringCategory[] | null)?.length
    ? normalizeCategories(dbScoringCats as ScoringCategory[])
    : FALLBACK_SCORE_CATEGORIES.map((c) => ({ key: c.key, label: c.label }))

  // Build scores array
  const scoreList = scoringCategories.map(cat => ({
    category: cat.label,
    score: Number(scores?.[cat.key] || 0),
  }))
  const overallScore = scoreList.reduce((sum, s) => sum + s.score, 0) / scoreList.length

  // Parse strengths and focus areas
  const strengthsList: string[] = (strengths || '').split(',').map((s: string) => s.trim()).filter(Boolean)
  const focusList: string[] = (focusAreas || '').split(',').map((s: string) => s.trim()).filter(Boolean)

  // Auto-derive if empty
  if (strengthsList.length === 0) {
    scoreList.filter(s => s.score >= 4).forEach(s => strengthsList.push(s.category))
  }
  if (focusList.length === 0) {
    scoreList.filter(s => s.score <= 2).forEach(s => focusList.push(s.category))
  }

  // Get attendance stats
  const { count: totalSessions } = await supabase
    .from('attendance')
    .select('id', { count: 'exact', head: true })
    .eq('player_id', playerId)

  const { count: presentCount } = await supabase
    .from('attendance')
    .select('id', { count: 'exact', head: true })
    .eq('player_id', playerId)
    .eq('present', true)

  const sessionsAttended = presentCount || 0
  const attendanceRate = (totalSessions || 0) > 0
    ? Math.round((sessionsAttended / (totalSessions || 1)) * 100)
    : 0

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://theplayerportal.net'

  const reportUrl = `${appUrl}/dashboard/players/${playerId}/report`

  // Premium report email (flag-gated, three-way). Flag OFF (both) ⇒ the existing
  // template, byte-identical. 1B ⇒ coach-led premium. V2 ⇒ coach-FIRST + Progress
  // Snapshot + academy sender. The premium enrichment (coach name + the read-only
  // review series → verdict) is shared by 1B and V2; the snapshot reuses that
  // SAME series (no new read). FROM=academy is applied via sendEmail.fromName only
  // when V2 is on.
  let template
  if (REPORTS_PREMIUM_EMAIL_V2_ENABLED || REPORTS_PREMIUM_EMAIL_ENABLED) {
    // Coach name = the authoring coach/admin (the caller).
    const { data: { user } } = await supabase.auth.getUser()
    const { data: coachProfile } = user
      ? await supabase.from('profiles').select('full_name').eq('id', user.id).single()
      : { data: null }
    const coachName = (coachProfile?.full_name || '').split(' ')[0] || null

    // Read-only review series for this player → trend verdict (+ snapshot in V2).
    const { data: seriesRows } = await supabase
      .from('progress_reviews')
      .select('attitude, effort, technical_quality, game_understanding, confidence, physical_movement, scores, review_date')
      .eq('player_id', playerId)
      .order('review_date', { ascending: false })
    const series = (seriesRows || []) as Record<string, unknown>[]
    const verdict = emailVerdict(series, scoringCategories)

    const base = {
      parentName: parent.full_name?.split(' ')[0] || 'there',
      childName: `${player.first_name} ${player.last_name}`,
      firstName: player.first_name,
      academyName: org?.name || 'Your Academy',
      academyLogoUrl: org?.logo_url || null,
      coachName,
      verdict,
      overallScore,
      topStrength: strengthsList[0] || null,
      topFocus: focusList[0] || null,
      coachQuote: coachComment || null,
      attendanceRate,
      sessionsAttended,
      reportUrl,
    }

    if (REPORTS_PREMIUM_EMAIL_V2_ENABLED) {
      const snap = buildSnapshot(series, scoringCategories)
      template = progressReportEmailPremiumV2({
        ...base,
        snapshotDeltas: snap.deltas,
        overallDelta: verdict.delta,
        hasPrevReview: snap.hasPrev,
      })
    } else {
      template = progressReportEmailPremium(base)
    }
  } else {
    template = progressReportEmail({
      parentName: parent.full_name?.split(' ')[0] || 'there',
      childName: `${player.first_name} ${player.last_name}`,
      academyName: org?.name || 'Your Academy',
      overallScore,
      scores: scoreList,
      strengths: strengthsList,
      focusAreas: focusList,
      attendanceRate,
      sessionsAttended,
      coachComment: coachComment || undefined,
      reportUrl,
    })
  }

  // V2: send FROM the academy display name (sendEmail.fromName — verified address
  // unchanged). OFF ⇒ no fromName ⇒ identical sender to today.
  const fromName = REPORTS_PREMIUM_EMAIL_V2_ENABLED ? (org?.name || undefined) : undefined
  const result = await sendEmail({ to: parent.email, ...template, ...(fromName ? { fromName } : {}) })

  // Slice C — Email reliability: on a SUCCESSFUL send, stamp emailed_at on the
  // just-created review (the latest for this player) so the daily cron skips
  // it. Failure ⇒ emailed_at stays NULL ⇒ cron retries. Uses the coach's
  // session (existing coach/admin UPDATE policy) — no RLS change, idempotent.
  if (REPORT_EMAIL_IDEMPOTENCY_ENABLED && result?.success) {
    const { data: latest } = await supabase
      .from('progress_reviews')
      .select('id')
      .eq('player_id', playerId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    if (latest) {
      await supabase
        .from('progress_reviews')
        .update({ emailed_at: new Date().toISOString() })
        .eq('id', latest.id)
        .is('emailed_at', null)
    }
  }

  // Also create a notification
  await supabase.from('notifications').insert({
    user_id: player.parent_id,
    organisation_id: orgId,
    type: 'progress',
    title: `New progress report for ${player.first_name}`,
    body: `Coach has submitted a new review. Overall score: ${overallScore.toFixed(1)}/5`,
    link: `/dashboard/players/${playerId}/report`,
  })

  return NextResponse.json({ ...result, success: true })
}
