/**
 * Phase 2.7 derive layer unit tests.
 *
 *   node scripts/_unit_tests_trial_conversion_derive.mjs
 *
 * Covers:
 *   • deriveConversionRates: both funnel + gross
 *   • Zero-denominator handling
 *   • smallSampleCaption: thresholds + singular/plural
 *   • deriveDaysToConvert: hide-when-N<3 gate + mean/median/range math
 *   • Negative or non-finite samples are filtered
 */

const SMALL_SAMPLE_THRESHOLD = 10
const MIN_DAYS_SAMPLES = 3
const round1 = (n) => Math.round(n * 10) / 10

function deriveConversionRates(counts) {
  return {
    funnelPct: counts.attended > 0 ? round1(counts.converted / counts.attended * 100) : null,
    funnelSampleN: counts.attended,
    grossPct: counts.booked > 0 ? round1(counts.converted / counts.booked * 100) : null,
    grossSampleN: counts.booked,
  }
}
function smallSampleCaption(n) {
  if (n >= SMALL_SAMPLE_THRESHOLD) return null
  if (n === 0) return 'no samples yet'
  if (n === 1) return 'based on 1 sample'
  return `based on ${n} samples`
}
function deriveDaysToConvert(samples) {
  const valid = samples.filter(s => Number.isFinite(s) && s >= 0)
  if (valid.length < MIN_DAYS_SAMPLES) {
    return { hidden: true, reason: 'insufficient_samples', sampleCount: valid.length }
  }
  const sorted = [...valid].sort((a, b) => a - b)
  const mean = valid.reduce((a, b) => a + b, 0) / valid.length
  const median = sorted.length % 2 === 1 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
  return { hidden: false, sampleCount: valid.length, meanDays: round1(mean), medianDays: round1(median), minDays: round1(sorted[0]), maxDays: round1(sorted[sorted.length - 1]) }
}

const results = []
const eq = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want)
  results.push({ name, pass })
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`)
}
const c = (booked, attended, converted, lost = 0, pending = 0) => ({ booked, attended, converted, lost, pending })

console.log('\n──── PHASE 1 — deriveConversionRates ────')

eq('1 converted of 3 attended → funnel 33.3%, gross of 6 → 16.7%',
  deriveConversionRates(c(6, 3, 1)),
  { funnelPct: 33.3, funnelSampleN: 3, grossPct: 16.7, grossSampleN: 6 })
eq('100% funnel when conv === attended',
  deriveConversionRates(c(5, 2, 2)),
  { funnelPct: 100, funnelSampleN: 2, grossPct: 40, grossSampleN: 5 })
eq('Zero attended → funnelPct null',
  deriveConversionRates(c(0, 0, 0)),
  { funnelPct: null, funnelSampleN: 0, grossPct: null, grossSampleN: 0 })
eq('Booked but none attended → funnel null, gross 0',
  deriveConversionRates(c(5, 0, 0)),
  { funnelPct: null, funnelSampleN: 0, grossPct: 0, grossSampleN: 5 })
eq('0% gross — booked but no convert yet',
  deriveConversionRates(c(10, 3, 0)),
  { funnelPct: 0, funnelSampleN: 3, grossPct: 0, grossSampleN: 10 })

console.log('\n──── PHASE 2 — smallSampleCaption ────')

eq('0 samples → no samples yet',  smallSampleCaption(0), 'no samples yet')
eq('1 sample (singular)',          smallSampleCaption(1), 'based on 1 sample')
eq('2 samples (plural)',           smallSampleCaption(2), 'based on 2 samples')
eq('9 samples → still caveated',   smallSampleCaption(9), 'based on 9 samples')
eq('10 samples → no caveat',       smallSampleCaption(10), null)
eq('100 samples → no caveat',      smallSampleCaption(100), null)

console.log('\n──── PHASE 3 — deriveDaysToConvert (N gate + math) ────')

eq('0 samples → hidden',
  deriveDaysToConvert([]),
  { hidden: true, reason: 'insufficient_samples', sampleCount: 0 })
eq('1 sample → hidden (per audit decision)',
  deriveDaysToConvert([10]),
  { hidden: true, reason: 'insufficient_samples', sampleCount: 1 })
eq('2 samples → hidden',
  deriveDaysToConvert([10, 20]),
  { hidden: true, reason: 'insufficient_samples', sampleCount: 2 })

const r3 = deriveDaysToConvert([10, 20, 30])
eq('3 samples: mean 20',  r3.meanDays, 20)
eq('3 samples: median 20', r3.medianDays, 20)
eq('3 samples: range 10–30', { min: r3.minDays, max: r3.maxDays }, { min: 10, max: 30 })
eq('3 samples: hidden=false', r3.hidden, false)

const r4 = deriveDaysToConvert([5, 10, 15, 20])  // even N
eq('4 samples: median is midpoint of 2 inner',  r4.medianDays, 12.5)
eq('4 samples: mean 12.5', r4.meanDays, 12.5)

const r5 = deriveDaysToConvert([10, 50, 100, NaN, -3, Infinity])  // filter junk
eq('Junk samples filtered out; 3 valid remain',  r5.sampleCount, 3)
eq('Mean of valid samples',  r5.meanDays, round1((10 + 50 + 100) / 3))

eq('Decimal rounding: mean rounds to 1dp',
  deriveDaysToConvert([10.123, 20.456, 30.789]).meanDays, 20.5)

console.log('\n──── SUMMARY ────')
const pass = results.filter(r => r.pass).length
const fail = results.filter(r => !r.pass).length
console.log(`  ${pass} pass / ${fail} fail / ${results.length} total`)
process.exit(fail > 0 ? 1 : 0)
