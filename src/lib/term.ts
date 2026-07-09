/**
 * Term display helpers — Phase 1B parent surfaces.
 *
 * Pure, server-safe utilities for rendering term information on parent
 * surfaces (public booking, class detail, dashboard, Membership Hub,
 * coach register header, emails). No DB access lives here — callers
 * pass in the already-fetched term row.
 *
 * Phase 1B contract: render term info if a class has term_id set.
 * is_active is intentionally NOT consulted; the class→term link is the
 * source of truth.
 */

export interface TermInfoData {
  id: string
  name: string
  start_date: string
  end_date: string
  parent_message: string | null
}

/**
 * Formats a term date range for parent display.
 *
 *   "1 Jan – 19 Dec 2026"   when start + end are in the same year
 *   "15 Dec 2025 – 12 Jan 2026"  when start + end span years
 */
export function formatTermDateRange(start_date: string, end_date: string): string {
  const start = new Date(start_date + 'T00:00:00')
  const end = new Date(end_date + 'T00:00:00')
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear()

  const startFmt = start.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
  const endFmt = end.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  return `${startFmt} – ${endFmt}`
}

/**
 * Plain-text version for emails — no en-dash (some clients break it).
 */
export function formatTermDateRangeForEmail(start_date: string, end_date: string): string {
  const start = new Date(start_date + 'T00:00:00')
  const end = new Date(end_date + 'T00:00:00')
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear()

  const startFmt = start.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
  const endFmt = end.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  return `${startFmt} to ${endFmt}`
}
