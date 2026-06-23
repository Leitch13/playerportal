/**
 * Trial Conversion 1A — Phase 5.
 *
 * Read-only widget that surfaces the existing trial_source data — captured
 * at booking time since Sprint 2 but never displayed in admin UI. Groups
 * the academy's trials by their declared / inferred source and reports:
 *
 *   • Trial count per source
 *   • Converted count per source
 *   • Conversion % per source (converted / total)
 *
 * No new data collection. No schema changes. No new fetches — this
 * component takes the same `trials` list that FunnelDashboard already
 * fetches on the page above and pivots it.
 *
 * Sources we expect to see (per src/lib/trial-source.ts):
 *   - 'google'
 *   - 'facebook'
 *   - 'instagram'
 *   - 'referral'
 *   - 'whatsapp'
 *   - 'word_of_mouth'
 *   - 'other'  (+ free-text source_detail)
 *   - 'unknown' / null (fallback when none of the above resolved)
 */

interface TrialMinimal {
  status: string
  converted: boolean
  trial_source: string | null
  source_detail?: string | null
}

const SOURCE_LABELS: Record<string, string> = {
  google: 'Google',
  facebook: 'Facebook',
  instagram: 'Instagram',
  referral: 'Referral',
  whatsapp: 'WhatsApp',
  word_of_mouth: 'Word of mouth',
  flyer: 'Flyer',
  search: 'Search',
  other: 'Other',
  unknown: 'Unknown',
}

function prettySource(raw: string | null | undefined): { key: string; label: string } {
  const k = (raw || 'unknown').toLowerCase()
  return { key: k, label: SOURCE_LABELS[k] ?? raw ?? 'Unknown' }
}

export default function ConversionBySource({ trials }: { trials: TrialMinimal[] }) {
  // Pivot
  const tally = new Map<string, { label: string; total: number; converted: number }>()
  for (const t of trials) {
    const { key, label } = prettySource(t.trial_source)
    const entry = tally.get(key) ?? { label, total: 0, converted: 0 }
    entry.total += 1
    if (t.converted) entry.converted += 1
    tally.set(key, entry)
  }

  // Sort: highest-conversion-count first, then highest total
  const rows = [...tally.entries()]
    .map(([key, v]) => ({
      key,
      ...v,
      pct: v.total > 0 ? Math.round((v.converted / v.total) * 100) : 0,
    }))
    .sort((a, b) => b.converted - a.converted || b.total - a.total)

  const grandTotal = rows.reduce((s, r) => s + r.total, 0)
  const grandConverted = rows.reduce((s, r) => s + r.converted, 0)
  const grandPct = grandTotal > 0 ? Math.round((grandConverted / grandTotal) * 100) : 0

  if (rows.length === 0) {
    return (
      <div className="rounded-xl bg-white/[0.02] border border-white/10 p-6">
        <h3 className="text-base font-semibold text-white mb-1">Conversion by source</h3>
        <p className="text-sm text-white/40">No trial data yet.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl bg-white/[0.02] border border-white/10 p-6">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="text-base font-semibold text-white">Conversion by source</h3>
        <div className="text-xs text-white/40">
          Overall: <span className="text-white font-medium">{grandPct}%</span>
          {' '}
          ({grandConverted}/{grandTotal})
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-white/40 uppercase tracking-wider">
              <th className="text-left py-2 font-medium">Source</th>
              <th className="text-right py-2 font-medium">Trials</th>
              <th className="text-right py-2 font-medium">Converted</th>
              <th className="text-right py-2 font-medium">Conversion %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-t border-white/[0.04]">
                <td className="py-2.5 text-white">{r.label}</td>
                <td className="py-2.5 text-right text-white/80">{r.total}</td>
                <td className="py-2.5 text-right text-emerald-300">{r.converted}</td>
                <td className="py-2.5 text-right">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    r.pct >= 30
                      ? 'bg-emerald-500/10 text-emerald-300'
                      : r.pct >= 15
                        ? 'bg-amber-500/10 text-amber-300'
                        : 'bg-white/5 text-white/40'
                  }`}>
                    {r.total === 0 ? '—' : `${r.pct}%`}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {grandTotal < 20 && (
        <p className="text-xs text-white/30 mt-3">
          Small sample size — rates will stabilise as more trials are booked.
        </p>
      )}
    </div>
  )
}
