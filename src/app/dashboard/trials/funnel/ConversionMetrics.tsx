/**
 * Conversion metrics — Phase 2.7 section on /dashboard/trials/funnel.
 *
 * Server-rendered. Display-only. Pure presentation from already-loaded
 * counts. Sample-size caveats live in `trial-conversion-derive.ts` so
 * this component only knows how to render.
 *
 * Renders:
 *   • 4 count tiles: Booked / Attended / Converted / Lost
 *   • 2 rate tiles: Funnel rate + Gross rate, each with sample caption
 *   • Days-to-convert tile (HIDDEN when N<3 per audit decision)
 *   • Pending Follow-Up tile linking to the existing Phase 2.4 surface
 *
 * NO trends. NO graphs. NO forecasting. Same scope the user approved.
 */
import Link from 'next/link'
import type { ConversionCounts } from '@/lib/trial-conversion-derive'
import {
  deriveConversionRates,
  smallSampleCaption,
  deriveDaysToConvert,
} from '@/lib/trial-conversion-derive'

interface Props {
  counts: ConversionCounts
  daysToConvertSamples: number[]
  pendingFollowUpCount: number
}

export default function ConversionMetrics({
  counts,
  daysToConvertSamples,
  pendingFollowUpCount,
}: Props) {
  const rates = deriveConversionRates(counts)
  const days = deriveDaysToConvert(daysToConvertSamples)
  const funnelCaption = smallSampleCaption(rates.funnelSampleN)
  const grossCaption = smallSampleCaption(rates.grossSampleN)

  return (
    <section className="bg-[#141414] rounded-2xl border border-[#1e1e1e] p-5 space-y-5">
      <header>
        <h2 className="text-sm font-bold text-white">Conversion metrics</h2>
        <p className="text-[11px] text-white/40 mt-0.5">
          Booking-side only. Enrolment-source conversions are not tracked yet — see audit gap.
        </p>
      </header>

      {/* ── Count tiles ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <CountTile label="Booked"    value={counts.booked} />
        <CountTile label="Attended"  value={counts.attended} />
        <CountTile label="Converted" value={counts.converted} tone="emerald" />
        <CountTile label="Lost"      value={counts.lost}      tone="rose" />
      </div>

      {/* ── Rate tiles ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-white/[0.06]">
        <RateTile
          label="Funnel rate"
          subtitle="Attended → Converted"
          pct={rates.funnelPct}
          caption={funnelCaption}
          sampleN={rates.funnelSampleN}
        />
        <RateTile
          label="Gross rate"
          subtitle="Booked → Converted"
          pct={rates.grossPct}
          caption={grossCaption}
          sampleN={rates.grossSampleN}
        />
      </div>

      {/* ── Days to convert (hidden when N<3) ── */}
      <div className="pt-3 border-t border-white/[0.06]">
        {days.hidden ? (
          <div className="text-[11px] text-white/40">
            <strong className="text-white/60">Days to convert:</strong>{' '}
            Not shown — needs ≥3 conversions before a meaningful average ({days.sampleCount} so far).
          </div>
        ) : (
          <div className="flex flex-wrap items-baseline gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-white/40">Days to convert (median)</div>
              <div className="text-2xl font-bold text-white tabular-nums">{days.medianDays}d</div>
              <div className="text-[10px] text-white/40">mean {days.meanDays}d · range {days.minDays}–{days.maxDays}d · n={days.sampleCount}</div>
            </div>
          </div>
        )}
      </div>

      {/* ── Pending Follow-Up — links to existing Phase 2.4 surface ── */}
      <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-white/40">Pending follow-up</div>
          <div className="text-2xl font-bold tabular-nums text-amber-300">{pendingFollowUpCount}</div>
          <div className="text-[10px] text-white/40">Awaiting or stale follow-up across both trial systems</div>
        </div>
        <Link
          href="/dashboard/enrolments#trial-followup"
          className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition-colors"
        >
          Open follow-up queue →
        </Link>
      </div>
    </section>
  )
}

// ─── Internals ────────────────────────────────────────────────────────

function CountTile({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone?: 'emerald' | 'rose'
}) {
  const valueCls =
    tone === 'emerald' ? 'text-emerald-300'
    : tone === 'rose' ? 'text-rose-300'
    : 'text-white'
  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3">
      <div className="text-[10px] uppercase tracking-wider text-white/40">{label}</div>
      <div className={`text-2xl font-bold leading-none tabular-nums mt-1 ${valueCls}`}>{value}</div>
    </div>
  )
}

function RateTile({
  label,
  subtitle,
  pct,
  caption,
  sampleN,
}: {
  label: string
  subtitle: string
  pct: number | null
  caption: string | null
  sampleN: number
}) {
  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3">
      <div className="text-[10px] uppercase tracking-wider text-white/40">{label}</div>
      <div className="text-[10px] text-white/40">{subtitle}</div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <div className="text-2xl font-bold tabular-nums text-[#4ecde6]">
          {pct === null ? '—' : `${pct}%`}
        </div>
        {/* Caveat: only render when sample size is small AND we have a percentage. */}
        {caption && pct !== null && (
          <div className="text-[10px] text-amber-300/80 italic">({caption})</div>
        )}
      </div>
      {pct === null && sampleN === 0 && (
        <div className="text-[10px] text-white/40 mt-0.5">No samples yet</div>
      )}
    </div>
  )
}
