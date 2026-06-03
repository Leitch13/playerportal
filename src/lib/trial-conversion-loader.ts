/**
 * Trial conversion loader — Phase 2.7.
 *
 * READ-ONLY. Pulls counts + day-deltas from `trial_bookings`. Does NOT
 * touch enrolment-source trials (no signal — see audit §8).
 *
 * Pairs with `trial-conversion-derive.ts` to produce conversion %, sample
 * sizes, and days-to-convert math. The loader holds the I/O; the derive
 * layer holds the math.
 *
 * Failure-tolerant: a Postgrest error returns zeroed counts so the page
 * never crashes. Same pattern as trial-followups-loader (Phase 2.4).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ConversionCounts } from '@/lib/trial-conversion-derive'

export interface ConversionLoaderResult {
  counts: ConversionCounts
  /** Day deltas for every converted row with both created_at + updated_at. */
  daysToConvertSamples: number[]
}

export async function loadTrialConversionData(
  supabase: SupabaseClient,
  orgId: string,
): Promise<ConversionLoaderResult> {
  const empty: ConversionLoaderResult = {
    counts: { booked: 0, attended: 0, converted: 0, lost: 0, pending: 0 },
    daysToConvertSamples: [],
  }

  const { data, error } = await supabase
    .from('trial_bookings')
    .select('status, converted, created_at, updated_at')
    .eq('organisation_id', orgId)
  if (error || !data) return empty

  const counts: ConversionCounts = { booked: 0, attended: 0, converted: 0, lost: 0, pending: 0 }
  const samples: number[] = []

  for (const row of data) {
    counts.booked++

    const s = (row.status || '').toLowerCase()
    if (s === 'attended') counts.attended++
    if (s === 'cancelled' || s === 'no_show') counts.lost++
    if (s === 'pending' || s === 'confirmed') counts.pending++

    if (row.converted === true) {
      counts.converted++
      if (row.created_at && row.updated_at) {
        const created = Date.parse(row.created_at)
        const updated = Date.parse(row.updated_at)
        if (!isNaN(created) && !isNaN(updated) && updated > created) {
          samples.push((updated - created) / 86_400_000)
        }
      }
    }
  }
  return { counts, daysToConvertSamples: samples }
}
