/**
 * Cancellation Intelligence — admin Analytics tab section.
 *
 * Pure presentation. All numbers come from the derive layer
 * (`@/lib/cancellation-derive`). Zero DB access. Zero business logic.
 *
 * Layout matches the brief exactly:
 *   A. Lost MRR        (This Month / Last 30 / Last 90)
 *   B. Saved MRR       (Retained count + Saved MRR)
 *   C. Offer ROI       (Shown / Accepted / % / Cost / Saved MRR / Net)
 *   D. Reason          (Breakdown + counts + %)
 *   E. Trend           (30 / 60 / 90 day day-by-day count)
 *   F. Data integrity  (only when captured < detected)
 *
 * Empty-state rule: when rows.length < MIN_ROWS_FOR_INSIGHTS (= 5) the
 * whole section renders a single explanatory empty card. Percentages
 * are never shown below the sample threshold (separate per-panel
 * suppression in the derive layer too).
 */
import {
  deriveLostMRR,
  deriveSavedMRR,
  deriveOfferROI,
  deriveReasonBreakdown,
  deriveTrend,
  deriveDataIntegrity,
  isUnderMinSample,
  MIN_OFFERED_FOR_ACCEPTANCE_PCT,
  type CancellationRow,
} from '@/lib/cancellation-derive'

interface Props {
  rows: CancellationRow[]
  detectedSubscriptionCancellations: number
}

function fmtGBP(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '£0'
  return '£' + n.toFixed(n < 100 ? 2 : 0)
}

export default function CancellationIntelligence({ rows, detectedSubscriptionCancellations }: Props) {
  // Derive everything up front; section components just render.
  const lost = deriveLostMRR(rows)
  const saved = deriveSavedMRR(rows)
  const offer = deriveOfferROI(rows)
  const reasons90 = deriveReasonBreakdown(rows, 90)
  const trend30 = deriveTrend(rows, 30)
  const trend60 = deriveTrend(rows, 60)
  const trend90 = deriveTrend(rows, 90)
  const integrity = deriveDataIntegrity(
    rows.filter(r => r.cancellation_type === 'subscription' && r.final_status === 'cancelled').length,
    detectedSubscriptionCancellations,
  )

  const under = isUnderMinSample(rows)

  return (
    <section className="space-y-5" data-testid="cancellation-intelligence">
      <header className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-white">Cancellation Intelligence</h2>
          <p className="text-xs text-white/50 mt-0.5">
            Based on cancellations captured by the in-app cancel flow. Click-through cancellations only —
            Stripe-side admin cancellations are not included.
          </p>
        </div>
        <span className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">
          {rows.length} {rows.length === 1 ? 'cancellation' : 'cancellations'} on record
        </span>
      </header>

      {/* Empty state below sample threshold — section short-circuits here. */}
      {under ? (
        <div
          data-testid="cancellation-empty"
          className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-8 text-center"
        >
          <div className="text-3xl mb-2">🪶</div>
          <p className="text-sm font-semibold text-white">Not enough cancellation data yet.</p>
          <p className="text-xs text-white/50 mt-1">
            Charts and percentages need at least 5 captured cancellations to be meaningful.
            {' '}You currently have <strong className="text-white/80">{rows.length}</strong>.
          </p>
          {integrity.showNotice && <IntegrityNotice integrity={integrity} />}
        </div>
      ) : (
        <>
          {/* ─── A · Lost MRR ─── */}
          <div className="bg-[#141414] border border-[#1e1e1e] rounded-2xl p-5 space-y-3" data-testid="lost-mrr-panel">
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-bold text-white">Lost MRR</h3>
              <span className="text-[10px] text-white/40">Monthly value of cancelled subscriptions</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <MetricTile
                label="This month"
                value={fmtGBP(lost.thisMonth)}
                sub={lost.thisMonthCount + ' ' + (lost.thisMonthCount === 1 ? 'sub' : 'subs')}
                tone="rose"
              />
              <MetricTile
                label="Last 30 days"
                value={fmtGBP(lost.last30Days)}
                sub={lost.last30DaysCount + ' ' + (lost.last30DaysCount === 1 ? 'sub' : 'subs')}
                tone="rose"
              />
              <MetricTile
                label="Last 90 days"
                value={fmtGBP(lost.last90Days)}
                sub={lost.last90DaysCount + ' ' + (lost.last90DaysCount === 1 ? 'sub' : 'subs')}
                tone="rose"
              />
            </div>
          </div>

          {/* ─── B · Saved MRR ─── */}
          <div className="bg-[#141414] border border-[#1e1e1e] rounded-2xl p-5 space-y-3" data-testid="saved-mrr-panel">
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-bold text-white">Saved MRR</h3>
              <span className="text-[10px] text-white/40">Retained via accepted offers</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <MetricTile
                label="Retained subscriptions"
                value={String(saved.retainedCount)}
                tone="emerald"
              />
              <MetricTile
                label="Saved monthly revenue"
                value={fmtGBP(saved.savedMonthlyMRR)}
                tone="emerald"
              />
            </div>
          </div>

          {/* ─── C · Retention Offer ROI ─── */}
          <div className="bg-[#141414] border border-[#1e1e1e] rounded-2xl p-5 space-y-4" data-testid="offer-roi-panel">
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-bold text-white">Retention Offer ROI</h3>
              <span className="text-[10px] text-white/40">Programme effectiveness</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <MetricTile label="Offers shown" value={String(offer.offered)} />
              <MetricTile label="Offers accepted" value={String(offer.accepted)} />
              <MetricTile
                label="Acceptance"
                value={offer.acceptancePct == null ? '—' : offer.acceptancePct.toFixed(1) + '%'}
                caption={offer.acceptancePct == null
                  ? `Suppressed (need ≥${MIN_OFFERED_FOR_ACCEPTANCE_PCT} offered)`
                  : undefined}
              />
              <MetricTile
                label="Discount cost / mo"
                value={fmtGBP(offer.discountCostMonthly)}
                tone="rose"
              />
              <MetricTile
                label="Saved MRR / mo"
                value={fmtGBP(offer.savedMonthlyMRR)}
                tone="emerald"
              />
              <MetricTile
                label="Net retention value / mo"
                value={fmtGBP(offer.netMonthlyValue)}
                tone={offer.netMonthlyValue > 0 ? 'emerald' : offer.netMonthlyValue < 0 ? 'rose' : undefined}
              />
            </div>
          </div>

          {/* ─── D · Cancellation Reasons ─── */}
          <div className="bg-[#141414] border border-[#1e1e1e] rounded-2xl p-5 space-y-3" data-testid="reason-breakdown-panel">
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-bold text-white">Cancellation reasons</h3>
              <span className="text-[10px] text-white/40">Last 90 days</span>
            </div>
            {reasons90.length === 0 ? (
              <p className="text-xs text-white/40 text-center py-4">No cancellations in the last 90 days.</p>
            ) : (
              <div className="space-y-2">
                {reasons90.map(r => (
                  <ReasonBar key={r.reason} reason={r.label} count={r.count} percentage={r.percentage} />
                ))}
              </div>
            )}
          </div>

          {/* ─── E · Trend ─── */}
          <div className="bg-[#141414] border border-[#1e1e1e] rounded-2xl p-5 space-y-4" data-testid="trend-panel">
            <h3 className="text-sm font-bold text-white">Cancellation trend</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <TrendBlock label="Last 30 days" buckets={trend30} />
              <TrendBlock label="Last 60 days" buckets={trend60} />
              <TrendBlock label="Last 90 days" buckets={trend90} />
            </div>
          </div>

          {/* ─── F · Data Integrity ─── */}
          {integrity.showNotice && <IntegrityNotice integrity={integrity} />}
        </>
      )}
    </section>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────

function MetricTile({
  label,
  value,
  sub,
  caption,
  tone,
}: {
  label: string
  value: string
  sub?: string
  caption?: string
  tone?: 'emerald' | 'rose'
}) {
  const valueClass =
    tone === 'emerald' ? 'text-emerald-400' :
    tone === 'rose'    ? 'text-rose-400' :
    'text-white'
  return (
    <div className="bg-[#0a0a0a] border border-[#1e1e1e] rounded-xl p-4">
      <div className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">{label}</div>
      <div className={'text-2xl font-extrabold tabular-nums mt-1 ' + valueClass}>{value}</div>
      {sub && <div className="text-[10px] text-white/40 mt-0.5">{sub}</div>}
      {caption && <div className="text-[10px] text-white/40 mt-0.5 italic">{caption}</div>}
    </div>
  )
}

function ReasonBar({ reason, count, percentage }: { reason: string; count: number; percentage: number }) {
  return (
    <div data-testid="reason-row">
      <div className="flex items-center justify-between text-xs text-white/80 mb-1">
        <span className="font-medium">{reason}</span>
        <span className="text-white/50 tabular-nums">
          {count} <span className="text-white/40">·</span> {percentage.toFixed(1)}%
        </span>
      </div>
      <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
        <div
          className="h-full bg-[#4ecde6] rounded-full"
          style={{ width: Math.min(100, percentage) + '%' }}
        />
      </div>
    </div>
  )
}

function TrendBlock({ label, buckets }: { label: string; buckets: { date: string; count: number }[] }) {
  const total = buckets.reduce((s, b) => s + b.count, 0)
  const peak = buckets.reduce((m, b) => Math.max(m, b.count), 0)
  return (
    <div className="bg-[#0a0a0a] border border-[#1e1e1e] rounded-xl p-3">
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">{label}</span>
        <span className="text-xs font-semibold text-white tabular-nums">{total}</span>
      </div>
      <div className="flex items-end gap-px h-12">
        {buckets.map(b => {
          const height = peak === 0 ? 0 : Math.max(2, Math.round((b.count / peak) * 48))
          return (
            <div
              key={b.date}
              title={`${b.date}: ${b.count}`}
              className="flex-1 bg-rose-500/40 rounded-sm"
              style={{ height: height + 'px' }}
            />
          )
        })}
      </div>
      <div className="flex items-center justify-between text-[10px] text-white/30 mt-1">
        <span>{buckets[0]?.date.slice(5)}</span>
        <span>today</span>
      </div>
    </div>
  )
}

function IntegrityNotice({
  integrity,
}: {
  integrity: { uncapturedCount: number; capturedSubscriptionCancellations: number; detectedSubscriptionCancellations: number }
}) {
  return (
    <div
      data-testid="data-integrity-notice"
      className="bg-amber-500/[0.06] border border-amber-500/30 rounded-xl p-4 flex items-start gap-3"
    >
      <span className="text-amber-400 text-lg leading-none">⚠</span>
      <div className="space-y-1">
        <p className="text-xs text-amber-200 font-semibold">
          Some historical subscription cancellations were not captured through the cancellation flow.
        </p>
        <p className="text-[11px] text-amber-200/70">
          {integrity.capturedSubscriptionCancellations} captured ·{' '}
          {integrity.detectedSubscriptionCancellations} detected ·{' '}
          <strong>{integrity.uncapturedCount}</strong> uncaptured.
          Metrics above are based on captured cancellation records only.
        </p>
      </div>
    </div>
  )
}
