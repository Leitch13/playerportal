import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail, sendEmailBatch } from '@/lib/email'
import { progressReportEmail, progressReportEmailPremium, progressReportEmailPremiumV2 } from '@/lib/email-templates'
import { normalizeCategories, type ScoringCategory } from '@/lib/scoring-categories'
import { REPORT_EMAIL_IDEMPOTENCY_ENABLED } from '@/lib/report-visibility'
import { REPORTS_PREMIUM_EMAIL_ENABLED, REPORTS_PREMIUM_EMAIL_V2_ENABLED, emailVerdict, buildSnapshot } from '@/lib/report-email-premium'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

const FALLBACK_SCORE_CATEGORIES = [
  { key: 'attitude', label: 'Attitude' },
  { key: 'effort', label: 'Effort' },
  { key: 'technical_quality', label: 'Technical Quality' },
  { key: 'game_understanding', label: 'Game Understanding' },
  { key: 'confidence', label: 'Confidence' },
  { key: 'physical_movement', label: 'Physical Movement' },
]

// Runs daily — finds reviews from the last 24 hours and emails parents
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://playerportal.app'

  // Find reviews from the last 24 hours that haven't been emailed
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  let reviewsQuery = supabase
    .from('progress_reviews')
    .select(`
      id, attitude, effort, technical_quality, game_understanding, confidence, physical_movement,
      strengths, focus_next, parent_summary,
      player:players!progress_reviews_player_id_fkey(
        id, first_name, last_name, parent_id,
        parent:profiles!players_parent_id_fkey(full_name, email)
      ),
      coach:profiles!progress_reviews_coach_id_fkey(full_name),
      organisation:organisations!progress_reviews_organisation_id_fkey(name, logo_url)
    `)
    .gte('created_at', since)

  // Slice C — Email reliability: when ON, only email reviews that were NOT
  // already emailed (on-create stamps emailed_at on success) ⇒ no double-send.
  if (REPORT_EMAIL_IDEMPOTENCY_ENABLED) {
    reviewsQuery = reviewsQuery.is('emailed_at', null)
  }

  const { data: reviews, error: reviewsErr } = await reviewsQuery

  if (reviewsErr) {
    return NextResponse.json({ error: 'Failed to fetch reviews', detail: reviewsErr.message }, { status: 500 })
  }

  // Cache scoring categories per org to avoid repeated queries
  const orgCategoriesCache: Record<string, { key: string; label: string }[]> = {}

  async function getOrgCategories(orgIdVal: string) {
    if (orgCategoriesCache[orgIdVal]) return orgCategoriesCache[orgIdVal]
    const { data: dbCats } = await supabase
      .from('scoring_categories')
      .select('*')
      .eq('organisation_id', orgIdVal)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
    const cats = (dbCats as ScoringCategory[] | null)?.length
      ? normalizeCategories(dbCats as ScoringCategory[])
      : FALLBACK_SCORE_CATEGORIES.map((c) => ({ key: c.key, label: c.label }))
    orgCategoriesCache[orgIdVal] = cats
    return cats
  }

  const jobs: Parameters<typeof sendEmail>[0][] = []
  const jobReviewIds: string[] = []   // Slice C — parallel to `jobs`, for emailed_at stamping

  for (const review of reviews || []) {
    const player = review.player as unknown as {
      id: string; first_name: string; last_name: string; parent_id: string
      parent: { full_name: string; email: string } | null
    } | null
    const coach = review.coach as unknown as { full_name: string } | null
    const org = review.organisation as unknown as { name: string } | null

    if (!player?.parent?.email) continue

    // Get org-specific scoring categories
    const reviewOrgId = (review as Record<string, unknown>).organisation_id as string
    const reviewCategories = reviewOrgId ? await getOrgCategories(reviewOrgId) : FALLBACK_SCORE_CATEGORIES

    // Calculate scores
    const scores = reviewCategories.map(cat => ({
      category: cat.label,
      score: Number((review as Record<string, unknown>)[cat.key] || 0),
    }))
    const overallScore = scores.reduce((sum, s) => sum + s.score, 0) / scores.length

    // Get strengths and focus areas
    const strengths: string[] = (review.strengths as string || '').split(',').map((s: string) => s.trim()).filter(Boolean)
    const focusAreas: string[] = (review.focus_next as string || '').split(',').map((s: string) => s.trim()).filter(Boolean)

    // Auto-derive strengths/focus from scores if not manually set
    if (strengths.length === 0) {
      scores.filter(s => s.score >= 4).forEach(s => strengths.push(s.category))
    }
    if (focusAreas.length === 0) {
      scores.filter(s => s.score <= 2).forEach(s => focusAreas.push(s.category))
    }

    // Get attendance stats
    const { count: totalSessions } = await supabase
      .from('attendance')
      .select('id', { count: 'exact', head: true })
      .eq('player_id', player.id)

    const { count: presentCount } = await supabase
      .from('attendance')
      .select('id', { count: 'exact', head: true })
      .eq('player_id', player.id)
      .eq('present', true)

    const sessionsAttended = presentCount || 0
    const attendanceRate = (totalSessions || 0) > 0
      ? Math.round((sessionsAttended / (totalSessions || 1)) * 100)
      : 0

    const reportUrl = `${appUrl}/dashboard/players/${player.id}/report`

    // Premium email (flag-gated, three-way). OFF (both) ⇒ existing template.
    // 1B ⇒ coach-led premium. V2 ⇒ coach-FIRST + Progress Snapshot + academy
    // sender. The snapshot reuses the SAME series read used for the verdict.
    let template
    let fromName: string | undefined
    if (REPORTS_PREMIUM_EMAIL_V2_ENABLED || REPORTS_PREMIUM_EMAIL_ENABLED) {
      const { data: seriesRows } = await supabase
        .from('progress_reviews')
        .select('attitude, effort, technical_quality, game_understanding, confidence, physical_movement, scores, review_date')
        .eq('player_id', player.id)
        .order('review_date', { ascending: false })
      const series = (seriesRows || []) as Record<string, unknown>[]
      const verdict = emailVerdict(series, reviewCategories)
      const base = {
        parentName: player.parent.full_name?.split(' ')[0] || 'there',
        childName: `${player.first_name} ${player.last_name}`,
        firstName: player.first_name,
        academyName: org?.name || 'Your Academy',
        academyLogoUrl: (org as { logo_url?: string } | null)?.logo_url || null,
        coachName: (coach?.full_name || '').split(' ')[0] || null,
        verdict,
        overallScore,
        topStrength: strengths[0] || null,
        topFocus: focusAreas[0] || null,
        coachQuote: (review.parent_summary as string) || null,
        attendanceRate,
        sessionsAttended,
        reportUrl,
      }
      if (REPORTS_PREMIUM_EMAIL_V2_ENABLED) {
        const snap = buildSnapshot(series, reviewCategories)
        template = progressReportEmailPremiumV2({ ...base, snapshotDeltas: snap.deltas, overallDelta: verdict.delta, hasPrevReview: snap.hasPrev })
        fromName = org?.name || undefined
      } else {
        template = progressReportEmailPremium(base)
      }
    } else {
      template = progressReportEmail({
        parentName: player.parent.full_name?.split(' ')[0] || 'there',
        childName: `${player.first_name} ${player.last_name}`,
        academyName: org?.name || 'Your Academy',
        overallScore,
        scores,
        strengths,
        focusAreas,
        attendanceRate,
        sessionsAttended,
        coachComment: (review.parent_summary as string) || undefined,
        reportUrl,
      })
    }

    jobs.push({ to: player.parent.email, ...template, ...(fromName ? { fromName } : {}) })
    jobReviewIds.push(review.id as string)
  }

  let sent = 0
  if (REPORT_EMAIL_IDEMPOTENCY_ENABLED) {
    // Slice C — send sequentially so we can stamp emailed_at ONLY on the reviews
    // whose email actually succeeded (a failed send leaves emailed_at NULL ⇒
    // retried next run). Idempotent: .is('emailed_at', null) never overwrites.
    for (let i = 0; i < jobs.length; i++) {
      const r = await sendEmail(jobs[i])
      if (r.success) {
        sent++
        await supabase
          .from('progress_reviews')
          .update({ emailed_at: new Date().toISOString() })
          .eq('id', jobReviewIds[i])
          .is('emailed_at', null)
      }
    }
  } else {
    ;({ sent } = await sendEmailBatch(jobs))
  }

  return NextResponse.json({ checked: (reviews || []).length, sent })
}
