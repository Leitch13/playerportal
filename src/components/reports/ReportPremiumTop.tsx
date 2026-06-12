import type { Verdict, SkillDelta } from '@/lib/report-premium'

// Phase 1A — Premium Top. Pure presentational (server component). Renders the
// parent's 30-second answer ABOVE the radar/charts: verdict + trend headline,
// the coach's words (hero), and what changed since last review. Light theme to
// match the printable report card. No client JS, no interactivity.

const TONE: Record<Verdict['tone'], { box: string; chip: string; arrow: string; label: string }> = {
  up:   { box: 'bg-emerald-50 border-emerald-200', chip: 'text-emerald-700', arrow: '▲', label: 'text-emerald-700' },
  flat: { box: 'bg-slate-50 border-slate-200',     chip: 'text-slate-600',  arrow: '→', label: 'text-slate-600' },
  down: { box: 'bg-amber-50 border-amber-200',     chip: 'text-amber-700',  arrow: '▼', label: 'text-amber-700' },
  new:  { box: 'bg-accent/5 border-accent/20',     chip: 'text-accent',     arrow: '✦', label: 'text-accent' },
}

function deltaColour(d: number) {
  if (d > 0) return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (d < 0) return 'bg-amber-50 text-amber-700 border-amber-200'
  return 'bg-slate-50 text-slate-500 border-slate-200'
}
function fmt(n: number) { return Number.isInteger(n) ? String(n) : n.toFixed(1) }

export default function ReportPremiumTop({
  firstName, verdict, headline, rating, coachQuote, coachName, deltas, hasPrevReview,
}: {
  firstName: string
  verdict: Verdict
  headline: string
  rating: number
  coachQuote?: string | null
  coachName?: string | null
  deltas: SkillDelta[]
  hasPrevReview: boolean
}) {
  const tone = TONE[verdict.tone]

  return (
    <div className="px-8 py-6 border-b border-border space-y-5">
      {/* Verdict hero + trend headline */}
      <div className={`rounded-2xl border ${tone.box} px-5 py-4 flex items-start gap-4`} role="status"
           aria-label={`Progress verdict: ${verdict.label}. ${headline}`}>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span aria-hidden className={`text-xl leading-none ${tone.label}`}>{tone.arrow}</span>
            <span className={`text-lg font-extrabold tracking-tight ${tone.label}`}>{verdict.label}</span>
          </div>
          <p className="text-sm text-text mt-1">{headline}</p>
        </div>
        {rating > 0 && (
          <div className="text-right shrink-0">
            <div className="text-3xl font-extrabold text-accent leading-none">{fmt(rating)}<span className="text-base text-text-light">/5</span></div>
            <div className="text-[10px] uppercase tracking-wide text-text-light mt-1">Overall</div>
          </div>
        )}
      </div>

      {/* Coach quote — the most visually important block */}
      {coachQuote && coachQuote.trim() ? (
        <figure className="rounded-2xl bg-surface border border-border px-6 py-5">
          <p className="text-[11px] uppercase tracking-wide text-text-light font-semibold mb-2">What your coach said</p>
          <blockquote className="text-lg leading-relaxed text-text font-medium">&ldquo;{coachQuote.trim()}&rdquo;</blockquote>
          {coachName && <figcaption className="text-sm text-text-light mt-3">— {coachName}</figcaption>}
        </figure>
      ) : (
        <div className="rounded-2xl bg-surface border border-border px-6 py-5">
          <p className="text-sm text-text-light">Your coach hasn&rsquo;t added written feedback on this report yet — the scores and skills below show {firstName}&rsquo;s latest progress.</p>
        </div>
      )}

      {/* What's changed */}
      <div>
        <p className="text-[11px] uppercase tracking-wide text-text-light font-semibold mb-2">What&rsquo;s changed since last review</p>
        {hasPrevReview && deltas.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {deltas.map((d) => (
              <span key={d.label} className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${deltaColour(d.delta)}`}>
                {d.label}
                <span aria-hidden>{d.delta > 0 ? '▲' : d.delta < 0 ? '▼' : '→'}</span>
                <span className="sr-only">{d.delta > 0 ? 'up' : d.delta < 0 ? 'down' : 'no change'}</span>
                {d.delta !== 0 ? `${d.delta > 0 ? '+' : ''}${fmt(d.delta)}` : 'same'}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-light">
            This is {firstName}&rsquo;s first report — we&rsquo;ve set the baseline today. From the next review you&rsquo;ll see exactly what improved. 🎯
          </p>
        )}
      </div>
    </div>
  )
}
