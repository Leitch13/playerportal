// ============================================================================
// parent-progress-v2.ts — Parent Progress 2.0, Phase 1A (Recomposition MVP).
//
// Pure helpers + flag. Turns the review history the Progress page (/dashboard/
// feedback) ALREADY loads into a per-child "development journey" — verdict,
// trend headline, coach quote, what-changed deltas, a progress series, and a
// compact history — reusing the shipped report-premium helpers verbatim.
//
// No queries, no writes, no schema. Flag OFF ⇒ the journey is never built and
// the current Progress page renders byte-identical.
//
// Category/score resolution MIRRORS the premium report page exactly: filter the
// org's categories down to the keys the player was actually scored on, falling
// back to the full list, so football-keyed scores resolve correctly.
// ============================================================================

import {
  computeVerdict,
  trendHeadline,
  skillDeltas,
  readScore,
  type Verdict,
  type SkillDelta,
} from '@/lib/report-premium'

export const PARENT_PROGRESS_V2_ENABLED = process.env.PARENT_PROGRESS_V2_ENABLED === 'true'

type Category = { key: string; label: string }
type ReviewLike = Record<string, unknown> & { review_date?: string | null }

// Legacy flat score columns (pre-jsonb), mirrored from the report page.
const LEGACY_KEYS = ['attitude', 'effort', 'technical_quality', 'game_understanding', 'confidence', 'physical_movement']

export type HistoryEntry = { id: string; date: string | null; coachName: string | null; rating: number | null }

export type ChildJourney = {
  playerId: string
  firstName: string
  reviewCount: number
  displayCategories: Category[]
  // Premium hero inputs (null when the child has no reviews):
  hero: {
    firstName: string
    verdict: Verdict
    headline: string
    rating: number
    coachQuote: string | null
    coachName: string | null
    deltas: SkillDelta[]
    hasPrevReview: boolean
  } | null
  strengths: string | null
  focusNext: string | null
  // Rows for the existing <ProgressTrend/> (newest-first, as today). Each carries
  // review_date + the resolved per-category score keys.
  trendReviews: (Record<string, unknown> & { review_date: string })[]
  hasTrend: boolean
  history: HistoryEntry[]
}

// Average of a review over the given categories, counting only real (>0) scores.
// Matches the report page's overallAverage / progressOverTime resolution.
function reviewAverage(review: ReviewLike | undefined, categories: Category[]): number | null {
  if (!review || categories.length === 0) return null
  let sum = 0
  let n = 0
  for (const cat of categories) {
    const v = readScore(review, cat.key)
    if (typeof v === 'number' && v > 0) {
      sum += v
      n++
    }
  }
  return n > 0 ? sum / n : null
}

function coachNameOf(review: ReviewLike | undefined): string | null {
  const c = (review as { coach?: { full_name?: string | null } } | undefined)?.coach
  return c?.full_name ?? null
}

// Build one child's journey from the reviews the loader already returned
// (NEWEST-FIRST, as `progress_reviews` is ordered by review_date DESC). Safe on
// null/empty/malformed input — degenerate data yields an empty (hero: null) journey.
export function buildChildJourney(
  playerId: string,
  firstName: string,
  reviewsNewestFirst: ReviewLike[] | null | undefined,
  scoringCategories: Category[],
): ChildJourney {
  const name = firstName || 'Your child'
  const reviews = (reviewsNewestFirst || []).filter((r): r is ReviewLike => !!r)
  const cats = scoringCategories || []

  if (reviews.length === 0) {
    return {
      playerId, firstName: name, reviewCount: 0, displayCategories: cats,
      hero: null, strengths: null, focusNext: null, trendReviews: [], hasTrend: false, history: [],
    }
  }

  // displayCategories — categories this player was actually scored on.
  const playerScoredKeys = new Set<string>()
  for (const r of reviews) {
    const rs = (r as Record<string, unknown>).scores as Record<string, number> | null | undefined
    if (rs) Object.keys(rs).forEach((k) => playerScoredKeys.add(k))
    for (const k of LEGACY_KEYS) if ((r as Record<string, unknown>)[k] != null) playerScoredKeys.add(k)
  }
  const filtered = cats.length === 0 ? cats : cats.filter((c) => playerScoredKeys.has(c.key))
  const displayCategories = filtered.length > 0 ? filtered : cats

  const latest = reviews[0]
  const prev = reviews[1]

  // Progress series oldest→newest (mirror report page), valid points only.
  const series = [...reviews]
    .reverse()
    .map((r) => {
      const avg = reviewAverage(r, displayCategories)
      return avg == null ? null : { average: avg }
    })
    .filter((p): p is { average: number } => p !== null)

  const verdict = computeVerdict(series)
  const headline = trendHeadline(series, name)
  const deltas = skillDeltas(latest, prev, displayCategories)
  const rating = reviewAverage(latest, displayCategories) ?? 0
  const coachQuote = (latest.parent_summary as string | null | undefined) ?? null

  // Rows for <ProgressTrend/> — only reviews with a parseable date.
  const trendReviews = reviews
    .filter((r): r is ReviewLike & { review_date: string } => typeof r.review_date === 'string')
    .map((r) => {
      const row: Record<string, unknown> & { review_date: string } = { review_date: r.review_date }
      const js = (r as Record<string, unknown>).scores as Record<string, number> | null | undefined
      for (const cat of displayCategories) row[cat.key] = js?.[cat.key] ?? (r as Record<string, unknown>)[cat.key]
      // carry jsonb through too (ProgressTrend reads r.scores as a fallback)
      if (js) row.scores = js
      return row
    })

  const history: HistoryEntry[] = reviews.map((r) => ({
    id: String((r as Record<string, unknown>).id ?? ''),
    date: typeof r.review_date === 'string' ? r.review_date : null,
    coachName: coachNameOf(r),
    rating: reviewAverage(r, displayCategories),
  }))

  return {
    playerId,
    firstName: name,
    reviewCount: reviews.length,
    displayCategories,
    hero: {
      firstName: name,
      verdict,
      headline,
      rating,
      coachQuote,
      coachName: coachNameOf(latest),
      deltas,
      hasPrevReview: !!prev,
    },
    strengths: (latest.strengths as string | null | undefined) ?? null,
    focusNext: (latest.focus_next as string | null | undefined) ?? null,
    trendReviews,
    hasTrend: trendReviews.length >= 2,
    history,
  }
}
