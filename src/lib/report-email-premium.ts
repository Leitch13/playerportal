// ============================================================================
// report-email-premium.ts — Player Reports Premium Email, Phase 1B.
//
// Pure helpers + flag. The premium email LEADS with the coach's words and an
// honest verdict-driven headline/subject/preheader, all derived from data the
// send routes already have (parent_summary, scores, attendance) plus ONE
// read-only previous-review series (for the trend). No writes, no schema, no
// new tables. Flag OFF ⇒ routes call the existing progressReportEmail() ⇒
// byte-identical production.
// ============================================================================

import { computeVerdict, readScore, type Verdict } from './report-premium'

export const REPORTS_PREMIUM_EMAIL_ENABLED = process.env.REPORTS_PREMIUM_EMAIL_ENABLED === 'true'

type ReviewLike = Record<string, unknown>
type Category = { key: string; label: string }

// Average-per-review series (oldest→newest) from review rows the route reads,
// using the same score resolution as the report page. Reused to derive the
// verdict for the email trend headline/subject.
export function buildProgressSeries(reviews: ReviewLike[], categories: Category[]): { average: number }[] {
  const oldestFirst = [...reviews].reverse()
  const out: { average: number }[] = []
  for (const r of oldestFirst) {
    const valid: number[] = []
    for (const c of categories) {
      const v = readScore(r, c.key)
      if (typeof v === 'number' && v > 0) valid.push(v)
    }
    if (valid.length === 0) continue
    out.push({ average: valid.reduce((a, b) => a + b, 0) / valid.length })
  }
  return out
}

export function emailVerdict(reviews: ReviewLike[], categories: Category[]): Verdict {
  return computeVerdict(buildProgressSeries(reviews, categories))
}

// Honest, premium one-liner. Never claims improvement unless the trend is up.
export function emailProgressHeadline(verdict: Verdict, firstName: string): string {
  const n = firstName || 'Your child'
  switch (verdict.tone) {
    case 'up':   return `${n} is improving`
    case 'flat': return `${n} is maintaining strong progress`
    case 'down': return `A focus month for ${n}`
    default:     return `${n}'s development baseline is set`
  }
}

// Subject — verdict-driven, child-first, one emoji, honest.
export function premiumSubject(verdict: Verdict, childFirstName: string): string {
  const n = childFirstName || 'Your child'
  if (verdict.tone === 'up') return `${n} is improving — here's what changed ⚽`
  return `${n}'s progress report is ready ⚽`
}

// Preheader (inbox preview line). Leads with the coach's actual words when
// present — the "this academy knows my child" hook. Falls back to verdict copy.
export function premiumPreheader(coachQuote: string | null | undefined, childFirstName: string, coachName: string | null | undefined, verdict: Verdict): string {
  const n = childFirstName || 'your child'
  const q = (coachQuote || '').trim().replace(/\s+/g, ' ')
  if (q) {
    const snip = q.length > 90 ? q.slice(0, 90) + '…' : q
    return coachName ? `Coach ${coachName}: "${snip}"` : `Your coach: "${snip}"`
  }
  if (verdict.tone === 'up') return `${n} improved this month — see what changed.`
  return `See ${n}'s progress and what to work on next.`
}

// Label → parent-friendly sentence (works for any category, incl. custom ones).
export function strengthSentence(label: string, firstName: string): string {
  return `${firstName || 'Your child'}'s ${label.toLowerCase()} continues to be one of their strongest areas.`
}
export function focusSentence(label: string): string {
  return `The next focus is ${label.toLowerCase()}.`
}
