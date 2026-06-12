// ============================================================================
// report-premium.ts — Player Reports Premium Refresh, Phase 1A (Premium Top).
//
// Display-only. Pure helpers that DERIVE a verdict / trend / per-skill deltas
// from review history the report page ALREADY fetches. No queries, no writes,
// no schema. Flag OFF ⇒ nothing renders ⇒ report page byte-identical to today.
// ============================================================================

export const REPORTS_PREMIUM_ENABLED = process.env.REPORTS_PREMIUM_ENABLED === 'true'

// A review row as the report page already loads it (jsonb `scores` + legacy cols).
type ReviewLike = Record<string, unknown>
type Category = { key: string; label: string }

// Read a single category score from a review (jsonb `scores` first, then legacy
// column), matching exactly how the report page resolves scores elsewhere.
export function readScore(review: ReviewLike | undefined, key: string): number | null {
  if (!review) return null
  const js = review.scores as Record<string, number> | null | undefined
  const v = js?.[key] ?? (review[key] as number | undefined)
  return typeof v === 'number' ? v : null
}

export type VerdictTone = 'up' | 'flat' | 'down' | 'new'
export type Verdict = { label: string; tone: VerdictTone; delta: number | null }

// Verdict from the average-per-review series (oldest→newest) the page computes.
// Threshold ±0.3 avoids flagging noise as a real move.
export function computeVerdict(progress: { average: number }[]): Verdict {
  if (progress.length < 2) return { label: 'First Report', tone: 'new', delta: null }
  const curr = progress[progress.length - 1].average
  const prev = progress[progress.length - 2].average
  const delta = curr - prev
  if (delta >= 0.3) return { label: 'Improving', tone: 'up', delta }
  if (delta <= -0.3) return { label: 'Needs Focus', tone: 'down', delta }
  return { label: 'Steady', tone: 'flat', delta }
}

// One-line, parent-facing trend headline. Arrow glyph is decorative; the words
// carry the meaning (accessibility — never colour/arrow alone).
export function trendHeadline(progress: { average: number }[], firstName: string): string {
  const v = computeVerdict(progress)
  const name = firstName || 'Your child'
  if (v.tone === 'new') return `${name}'s first report — baseline set. The journey starts here.`
  const d = Math.abs(v.delta as number).toFixed(1)
  if (v.tone === 'up') return `Up ${d} since the last report — ${name} is improving.`
  if (v.tone === 'down') return `Down ${d} since the last report — a focus area this month.`
  return `Holding steady since the last report.`
}

export type SkillDelta = { label: string; prev: number; curr: number; delta: number }

// Per-skill change vs the previous review, over the categories the player was
// actually scored on in BOTH reviews. Empty when there is no previous review.
export function skillDeltas(
  latest: ReviewLike | undefined,
  prev: ReviewLike | undefined,
  categories: Category[],
): SkillDelta[] {
  if (!latest || !prev) return []
  const out: SkillDelta[] = []
  for (const c of categories) {
    const curr = readScore(latest, c.key)
    const prevV = readScore(prev, c.key)
    if (curr == null || prevV == null) continue
    out.push({ label: c.label, prev: prevV, curr, delta: curr - prevV })
  }
  // Biggest movers first (improvements and regressions both surface).
  return out.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
}
