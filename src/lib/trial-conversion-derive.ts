/**
 * Trial conversion math — Phase 2.7.
 *
 * Pure derivation. No I/O. Operates on COUNTS already collected by
 * `trial-conversion-loader.ts` plus the converted-row time samples.
 *
 * The "honesty principles" agreed in the audit:
 *   • Every percentage carries a sample size N so the academy owner can
 *     contextualise it ("100%" of 1 conversion is not 100% of 100).
 *   • Days-to-convert is HIDDEN when N<3 because a single sample is
 *     misleading and 2 samples produce wild ranges.
 *   • No enrolment-source counts here — they're invisible by schema
 *     (Phase 2.7 audit §8). Loader returns booking-side only.
 */

// ─── Public types ──────────────────────────────────────────────────────

export interface ConversionCounts {
  booked: number
  attended: number
  converted: number
  lost: number
  pending: number   // pending OR confirmed — unresolved bookings
}

export interface ConversionRates {
  /** converted / attended × 100, or null if attended=0. */
  funnelPct: number | null
  funnelSampleN: number
  /** converted / booked × 100, or null if booked=0. */
  grossPct: number | null
  grossSampleN: number
}

export interface DaysToConvertSummary {
  /**
   * null when fewer than `MIN_DAYS_SAMPLES` samples exist. The audit
   * established N<3 as too few to be useful — a single sample is point-
   * estimate, two samples produce wild ranges, three is the minimum
   * threshold for a meaningful median.
   */
  hidden: boolean
  reason?: 'insufficient_samples'
  sampleCount: number
  meanDays?: number
  medianDays?: number
  minDays?: number
  maxDays?: number
}

// ─── Thresholds ────────────────────────────────────────────────────────

/** Below this sample size, conversion percentages get a "(based on N)" caption. */
export const SMALL_SAMPLE_THRESHOLD = 10
/** Below this sample size, days-to-convert is HIDDEN entirely. */
export const MIN_DAYS_SAMPLES = 3

// ─── Core derivation ──────────────────────────────────────────────────

export function deriveConversionRates(counts: ConversionCounts): ConversionRates {
  return {
    funnelPct: counts.attended > 0
      ? round1(counts.converted / counts.attended * 100)
      : null,
    funnelSampleN: counts.attended,
    grossPct: counts.booked > 0
      ? round1(counts.converted / counts.booked * 100)
      : null,
    grossSampleN: counts.booked,
  }
}

/**
 * Caption shown next to a percentage. Returns null when the sample is
 * large enough that no caveat is needed.
 */
export function smallSampleCaption(sampleN: number): string | null {
  if (sampleN >= SMALL_SAMPLE_THRESHOLD) return null
  if (sampleN === 0) return 'no samples yet'
  if (sampleN === 1) return 'based on 1 sample'
  return `based on ${sampleN} samples`
}

/**
 * Mean/median/range of conversion delays, computed from already-collected
 * day deltas. Returns `hidden: true` when too few samples exist.
 */
export function deriveDaysToConvert(samples: number[]): DaysToConvertSummary {
  const valid = samples.filter(s => Number.isFinite(s) && s >= 0)
  if (valid.length < MIN_DAYS_SAMPLES) {
    return { hidden: true, reason: 'insufficient_samples', sampleCount: valid.length }
  }
  const sorted = [...valid].sort((a, b) => a - b)
  const mean = valid.reduce((a, b) => a + b, 0) / valid.length
  const median = sorted.length % 2 === 1
    ? sorted[(sorted.length - 1) / 2]
    : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
  return {
    hidden: false,
    sampleCount: valid.length,
    meanDays: round1(mean),
    medianDays: round1(median),
    minDays: round1(sorted[0]),
    maxDays: round1(sorted[sorted.length - 1]),
  }
}

// ─── Internals ────────────────────────────────────────────────────────

function round1(n: number): number {
  return Math.round(n * 10) / 10
}
