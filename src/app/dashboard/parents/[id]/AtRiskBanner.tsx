/**
 * At-Risk banner — Parent Detail page, Phase 2.6.
 *
 * Renders a small top-of-page banner when the family has at least one
 * risk reason. Tone follows the assessed level (rose for high, amber for
 * medium). DISPLAY ONLY — no inline actions, no buttons. The existing
 * communication action cluster (Email / WhatsApp / Open conversation)
 * stays in the CommunicationPanel below.
 *
 * Returns null for healthy families so the page chrome doesn't shift
 * when there's nothing to surface.
 */
import type { RiskAssessment, RiskReason } from '@/lib/at-risk-derive'
import { RISK_LEVEL_DISPLAY } from '@/lib/at-risk-derive'

const TONE_BANNER: Record<'rose' | 'amber', string> = {
  rose:  'bg-rose-500/[0.06]  border-rose-500/30  text-rose-200',
  amber: 'bg-amber-500/[0.06] border-amber-500/30 text-amber-200',
}
const TONE_CHIP: Record<RiskReason['tone'], string> = {
  rose:  'bg-rose-500/15  text-rose-300  border-rose-500/30',
  amber: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
}

export default function AtRiskBanner({ assessment }: { assessment: RiskAssessment | null }) {
  if (!assessment || assessment.riskLevel === 'healthy') return null
  const meta = RISK_LEVEL_DISPLAY[assessment.riskLevel]
  // High → rose; medium → amber.
  const bannerCls = TONE_BANNER[meta.tone === 'rose' ? 'rose' : 'amber']

  return (
    <section
      className={`border rounded-2xl p-4 ${bannerCls}`}
      role="status"
      aria-label={`${meta.label}: family requires attention`}
    >
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex-1 min-w-[180px]">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <span aria-hidden>⚠</span>
            Needs attention
            <span className="text-[10px] uppercase tracking-wider font-bold opacity-80">{meta.label}</span>
          </h2>
          <p className="text-[11px] opacity-70 mt-0.5">
            Reasons (display only — use existing actions below)
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {assessment.riskReasons.map(r => (
            <span
              key={r.key}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${TONE_CHIP[r.tone]}`}
            >
              <span aria-hidden>{r.emoji}</span>{r.label}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
