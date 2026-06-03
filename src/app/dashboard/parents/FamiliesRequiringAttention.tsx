/**
 * Families Requiring Attention — Phase 2.6.
 *
 * Server-rendered section that surfaces the at-risk cohort, grouped by
 * tier (High → Medium). Each row shows:
 *   • Family name + quick stats (child count, monthly value)
 *   • The list of risk reasons as small pill chips (from at-risk-derive)
 *   • EXISTING quick actions only — view / message / call / WhatsApp / email
 *
 * Read-only. NO new actions. NO new mutations. The actions row is
 * intentionally identical to the per-row actions on ParentsTable.
 *
 * Renders only when:
 *   • the current filter is "all" (otherwise the chips already isolate
 *     the cohort — repeating it would be visual noise)
 *   • there's at least 1 high-or-medium risk family to surface
 *
 * Replaces the prior AtRiskSection.tsx (flat list, single tone).
 */
import Link from 'next/link'
import type { ParentRowFacts } from '@/lib/parents-derive'
import { RISK_LEVEL_DISPLAY, type RiskReason } from '@/lib/at-risk-derive'

const REASON_TONE: Record<RiskReason['tone'], string> = {
  rose:  'bg-rose-500/15  text-rose-300  border-rose-500/30',
  amber: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
}

// Top-N caps per tier — keep the page render snappy and the user focused.
// "Show all" deep-links into the matching filter chip.
const TIER_CAP_HIGH = 5
const TIER_CAP_MEDIUM = 5

export default function FamiliesRequiringAttention({
  families,
}: {
  families: ParentRowFacts[]
}) {
  const high = families.filter(f => f.riskAssessment?.riskLevel === 'high')
  const medium = families.filter(f => f.riskAssessment?.riskLevel === 'medium')

  if (high.length === 0 && medium.length === 0) return null

  return (
    <section className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-5 space-y-5">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-sm font-bold text-white">⚠ Families requiring attention</h2>
        <div className="text-[11px] text-white/40 tabular-nums">
          <span className="text-rose-300 font-semibold">{high.length} high</span>
          <span className="mx-1.5 text-white/30">·</span>
          <span className="text-amber-300 font-semibold">{medium.length} medium</span>
        </div>
      </header>

      {high.length > 0 && (
        <TierBlock title="High priority" tier="high" rows={high} cap={TIER_CAP_HIGH} filterKey="high_risk" />
      )}
      {medium.length > 0 && (
        <TierBlock title="Medium priority" tier="medium" rows={medium} cap={TIER_CAP_MEDIUM} filterKey="needs_attention" />
      )}
    </section>
  )
}

// ─── Tier block ────────────────────────────────────────────────────────

function TierBlock({
  title,
  tier,
  rows,
  cap,
  filterKey,
}: {
  title: string
  tier: 'high' | 'medium'
  rows: ParentRowFacts[]
  cap: number
  /** Routes the "Show all N →" link into the matching chip. */
  filterKey: 'high_risk' | 'needs_attention'
}) {
  const top = rows.slice(0, cap)
  const meta = RISK_LEVEL_DISPLAY[tier]
  // High block is louder (rose underline) so the eye lands there first.
  const accentLine = tier === 'high' ? 'border-rose-500/30' : 'border-amber-500/30'
  const accentText = tier === 'high' ? 'text-rose-300' : 'text-amber-300'

  return (
    <div className={`space-y-2 pt-3 border-t ${accentLine}`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className={`text-[11px] uppercase tracking-wider font-bold ${accentText}`}>
          <span className="mr-1.5" aria-hidden>{meta.emoji}</span>{title}
        </h3>
        <span className="text-[11px] text-white/40 tabular-nums">{rows.length} {rows.length === 1 ? 'family' : 'families'}</span>
      </div>

      <div className="divide-y divide-white/[0.04]">
        {top.map(f => <FamilyRow key={f.id} f={f} />)}
      </div>

      {rows.length > top.length && (
        <div className="pt-2">
          <Link
            href={`/dashboard/parents?filter=${filterKey}`}
            className={`text-xs font-semibold ${accentText} hover:opacity-80 transition-opacity`}
          >
            Show all {rows.length} →
          </Link>
        </div>
      )}
    </div>
  )
}

// ─── Single-family row ────────────────────────────────────────────────

function FamilyRow({ f }: { f: ParentRowFacts }) {
  const waNumber = (f.parentPhone || '').replace(/[\s\-()+]+/g, '').replace(/^0/, '44')
  const reasons = f.riskAssessment?.riskReasons ?? []

  return (
    <div className="py-2.5 first:pt-0 last:pb-0 flex items-start sm:items-center justify-between gap-3 flex-wrap">
      <div className="flex-1 min-w-0">
        <Link
          href={`/dashboard/parents/${f.id}`}
          className="text-sm font-medium text-white hover:text-[#4ecde6] transition-colors"
        >
          {f.parentName}
        </Link>
        <div className="text-[11px] text-white/40 mt-0.5">
          {f.childCount} {f.childCount === 1 ? 'child' : 'children'}
          {f.familyValue > 0 && <> · £{f.familyValue.toFixed(0)}/mo</>}
        </div>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {reasons.map(r => (
            <span
              key={r.key}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${REASON_TONE[r.tone]}`}
            >
              <span aria-hidden>{r.emoji}</span>{r.label}
            </span>
          ))}
        </div>
      </div>
      {/* Action cluster — IDENTICAL to ParentsTable per-row actions. No new actions. */}
      <div className="flex items-center gap-1 shrink-0">
        <Link
          href={`/dashboard/parents/${f.id}`}
          title="View family"
          aria-label="View family"
          className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[12px] bg-white/[0.04] hover:bg-white/[0.08] text-white/70 hover:text-white transition-colors"
        >
          👨‍👩‍👧
        </Link>
        <Link
          href={`/dashboard/messages?to=${f.id}`}
          title="Message"
          aria-label="Message"
          className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[12px] bg-white/[0.04] hover:bg-white/[0.08] text-white/70 hover:text-white transition-colors"
        >
          ✉️
        </Link>
        {f.parentPhone && (
          <>
            <a
              href={`tel:${f.parentPhone}`}
              title="Call"
              aria-label="Call"
              className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[12px] bg-white/[0.04] hover:bg-white/[0.08] text-white/70 hover:text-white transition-colors"
            >📞</a>
            <a
              href={`https://wa.me/${waNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              title="WhatsApp"
              aria-label="WhatsApp"
              className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[12px] bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 transition-colors"
            >💬</a>
          </>
        )}
        {f.parentEmail && (
          <a
            href={`mailto:${f.parentEmail}`}
            title="Email"
            aria-label="Email"
            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[12px] bg-white/[0.04] hover:bg-white/[0.08] text-white/70 hover:text-white transition-colors"
          >📧</a>
        )}
      </div>
    </div>
  )
}
