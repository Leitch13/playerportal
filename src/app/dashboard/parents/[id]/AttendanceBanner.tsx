/**
 * Attendance Risk banner — Parent Detail page, Phase 2.8.
 *
 * Display-only. Surfaces ONE reason line per family:
 *   ⚠ Attendance Risk
 *     Never attended (34 days enrolled)
 *
 *   or
 *
 *   ⚠ Attendance Risk
 *     Drifted away (41 days since last attendance)
 *
 * NO inline actions. NO buttons. NO messaging. NO links into other
 * pages — the family-level "View family" navigation already exists in
 * the page chrome above this component.
 *
 * Renders null for healthy / new_player / not_applicable so the page
 * chrome doesn't shift when there's nothing operationally actionable.
 *
 * Tone follows the assessed level (rose for high, amber for medium).
 * The label string comes from the derive layer so wording stays
 * identical across every surface (Players table, this banner).
 */
import type { AttendanceRiskAssessment } from '@/lib/attendance-risk-derive'

const TONE_BANNER: Record<'rose' | 'amber', string> = {
  rose:  'bg-rose-500/[0.06]  border-rose-500/30  text-rose-200',
  amber: 'bg-amber-500/[0.06] border-amber-500/30 text-amber-200',
}

export default function AttendanceBanner({ assessment }: { assessment: AttendanceRiskAssessment | null }) {
  if (!assessment) return null
  if (assessment.riskLevel !== 'high' && assessment.riskLevel !== 'medium') return null

  const tone = assessment.riskLevel === 'high' ? 'rose' : 'amber'
  const bannerCls = TONE_BANNER[tone]
  const label = assessment.riskReason.label
  // Reason kind drives the display word ("Drifted away" / "Never attended")
  // — but the derive layer already emits the full sentence in `label`. We
  // include the level word ("High" / "Medium") quietly in the corner so
  // the family banner can be tonally consistent with the Phase 2.6 risk
  // banner directly above it.
  const levelWord = assessment.riskLevel === 'high' ? 'High priority' : 'Medium priority'

  return (
    <section
      className={`border rounded-2xl p-4 ${bannerCls}`}
      role="status"
      aria-label={`Attendance risk: ${label}`}
    >
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex-1 min-w-[180px]">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <span aria-hidden>⚠</span>
            Attendance Risk
            <span className="text-[10px] uppercase tracking-wider font-bold opacity-80">{levelWord}</span>
          </h2>
          <p className="text-[11px] opacity-70 mt-0.5">
            Reason (display only — open the player profile to see history)
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${
              tone === 'rose'
                ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
            }`}
          >
            <span aria-hidden>⏱️</span>{label}
          </span>
        </div>
      </div>
    </section>
  )
}
