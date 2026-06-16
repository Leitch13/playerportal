/**
 * Player Reports Glow-Up — Phase 1A (presentation + derivation only).
 *
 * Re-presents the SAME loaded reviews as a player-first experience: a rich card
 * per player built from their latest report (hero + overall score + progress
 * since last + top strength + focus area + coach summary), with a compact
 * "previous reports" timeline. Everything is DERIVED client-side from the data
 * already fetched by the page — no new queries, no writes, no schema, no
 * scoring / publishing / parent / email / business-logic changes.
 *
 * Flag-gated at the page level (REPORTS_REDESIGN_ENABLED); when off, the page
 * renders the original list unchanged.
 */
import ScoreBadge from '@/components/ScoreBadge'
import type { NormalizedCategory } from '@/lib/scoring-categories'

type Review = Record<string, unknown> & {
  id: string
  review_date: string
  strengths?: string | null
  focus_next?: string | null
  parent_summary?: string | null
  scores?: Record<string, number> | null
  player?: { first_name: string; last_name: string; age_group?: string | null } | null
  coach?: { full_name: string } | null
}

/* ── pure derivations (no I/O) ── */

function scoreFor(review: Review, cat: NormalizedCategory): number | null {
  const v = review.scores?.[cat.key] ?? (review as Record<string, unknown>)[cat.key]
  return typeof v === 'number' ? v : null
}

function avgOf(review: Review, cats: NormalizedCategory[]): number | null {
  const vals = cats.map((c) => scoreFor(review, c)).filter((v): v is number => v != null)
  if (!vals.length) return null
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

function topAndFocus(review: Review, cats: NormalizedCategory[]) {
  const scored = cats
    .map((c) => ({ label: c.label, score: scoreFor(review, c) }))
    .filter((x): x is { label: string; score: number } => x.score != null)
  if (!scored.length) return { top: null, focus: null }
  const top = scored.reduce((a, b) => (b.score > a.score ? b : a))
  const focus = scored.reduce((a, b) => (b.score < a.score ? b : a))
  return { top, focus }
}

function Stars({ avg }: { avg: number }) {
  const full = Math.floor(avg)
  const half = avg - full >= 0.5
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${avg.toFixed(1)} out of 5`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const filled = i < full
        const isHalf = i === full && half
        return (
          <svg key={i} className="w-4 h-4" viewBox="0 0 20 20" aria-hidden>
            <defs>
              <linearGradient id={`half-${i}`}>
                <stop offset="50%" stopColor="#f5c518" />
                <stop offset="50%" stopColor="rgba(255,255,255,0.15)" />
              </linearGradient>
            </defs>
            <path
              d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 15.9 4.8 17.6l1-5.8L1.5 7.7l5.9-.9z"
              fill={filled ? '#f5c518' : isHalf ? `url(#half-${i})` : 'rgba(255,255,255,0.15)'}
            />
          </svg>
        )
      })}
    </span>
  )
}

function Delta({ curr, prev }: { curr: number; prev: number | null }) {
  if (prev == null) return <span className="text-[11px] text-white/40">First report</span>
  const d = Math.round((curr - prev) * 10) / 10
  if (d > 0) return <span className="text-[11px] font-semibold text-emerald-400">↑ +{d.toFixed(1)} since last report</span>
  if (d < 0) return <span className="text-[11px] font-semibold text-rose-400">↓ {d.toFixed(1)} since last report</span>
  return <span className="text-[11px] font-semibold text-white/40">— no change since last report</span>
}

function initials(name: string) {
  return (name || '').split(' ').filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase() || '').join('') || '—'
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

/* ── component ── */

export default function PlayerFirstReports({
  reviews,
  categories,
}: {
  reviews: Review[]
  categories: NormalizedCategory[]
}) {
  // Group by player, preserving the page's date-desc order.
  const groups = new Map<string, Review[]>()
  for (const r of reviews) {
    const pid = (r.player_id as string) || `${r.player?.first_name}-${r.player?.last_name}` || r.id
    const arr = groups.get(pid) ?? []
    arr.push(r)
    groups.set(pid, arr)
  }

  const cards = [...groups.values()]
    .map((list) => ({ latest: list[0], previous: list[1] ?? null, history: list.slice(1) }))
    .sort((a, b) => b.latest.review_date.localeCompare(a.latest.review_date))

  return (
    <div className="space-y-5">
      {cards.map(({ latest, previous, history }) => {
        const name = latest.player ? `${latest.player.first_name} ${latest.player.last_name}` : 'Unknown'
        const avg = avgOf(latest, categories)
        const prevAvg = previous ? avgOf(previous, categories) : null
        const { top, focus } = topAndFocus(latest, categories)

        return (
          <section key={latest.id} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] overflow-hidden">
            {/* HERO + OVERALL SCORE */}
            <div className="p-5 sm:p-6 grid gap-5 lg:grid-cols-[1.4fr_1fr] border-b border-white/[0.06]">
              {/* hero */}
              <div className="flex items-center gap-4">
                <span className="w-14 h-14 shrink-0 rounded-2xl bg-[#4ecde6]/15 border border-[#4ecde6]/30 flex items-center justify-center text-lg font-bold text-[#4ecde6]">
                  {initials(name)}
                </span>
                <div className="min-w-0">
                  <h3 className="text-xl font-bold text-white truncate">{name}</h3>
                  <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-white/50">
                    {latest.player?.age_group && (
                      <span className="px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.1] text-white/70 font-medium">{latest.player.age_group}</span>
                    )}
                    <span>Last report: {fmt(latest.review_date)}</span>
                    {latest.coach?.full_name && <span>· {latest.coach.full_name}</span>}
                  </div>
                </div>
              </div>
              {/* overall development score */}
              {avg != null && (
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-white/45">Overall Development Score</p>
                    <p className="text-3xl font-extrabold text-white leading-none mt-1">
                      {avg.toFixed(1)}<span className="text-base font-bold text-white/40"> / 5</span>
                    </p>
                    <div className="mt-1.5"><Delta curr={avg} prev={prevAvg} /></div>
                  </div>
                  <Stars avg={avg} />
                </div>
              )}
            </div>

            {/* AT A GLANCE — top strength / focus area */}
            {(top || focus) && (
              <div className="px-5 sm:px-6 pt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {top && (
                  <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.07] p-4">
                    <p className="text-[10px] uppercase tracking-wider text-emerald-300/80 font-semibold">★ Top Strength</p>
                    <p className="text-lg font-bold text-white mt-0.5">{top.label}</p>
                    <p className="text-xs text-white/50">Score: {top.score}/5</p>
                  </div>
                )}
                {focus && (
                  <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.07] p-4">
                    <p className="text-[10px] uppercase tracking-wider text-amber-300/80 font-semibold">◎ Focus Area</p>
                    <p className="text-lg font-bold text-white mt-0.5">{focus.label}</p>
                    <p className="text-xs text-white/50">Score: {focus.score}/5</p>
                  </div>
                )}
              </div>
            )}

            {/* CATEGORY SCORES (preserved) */}
            <div className="px-5 sm:px-6 pt-5">
              <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
                {categories.map((cat) => {
                  const s = scoreFor(latest, cat)
                  if (s == null) return null
                  return (
                    <div key={cat.key} className="flex flex-col items-center gap-1 p-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                      <ScoreBadge score={s} />
                      <span className="text-[10px] text-white/45 text-center leading-tight">{cat.label}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* COACH SUMMARY (stronger hierarchy) */}
            {(latest.strengths || latest.focus_next || latest.parent_summary) && (
              <div className="px-5 sm:px-6 pt-5 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {latest.strengths && (
                    <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.05] px-4 py-3">
                      <p className="text-[10px] uppercase tracking-wider text-emerald-300/70 font-semibold mb-1">Strengths</p>
                      <p className="text-sm text-white/80 leading-relaxed">{latest.strengths}</p>
                    </div>
                  )}
                  {latest.focus_next && (
                    <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.05] px-4 py-3">
                      <p className="text-[10px] uppercase tracking-wider text-amber-300/70 font-semibold mb-1">Areas to Improve</p>
                      <p className="text-sm text-white/80 leading-relaxed">{latest.focus_next}</p>
                    </div>
                  )}
                </div>
                {latest.parent_summary && (
                  <div className="rounded-xl border border-[#4ecde6]/20 bg-[#4ecde6]/[0.05] px-4 py-3">
                    <p className="text-[10px] uppercase tracking-wider text-[#4ecde6]/70 font-semibold mb-1">Coach Summary <span className="text-white/30 normal-case font-medium">· shown on the parent portal</span></p>
                    <p className="text-sm text-white/85 leading-relaxed">{latest.parent_summary}</p>
                  </div>
                )}
              </div>
            )}

            {/* PREVIOUS REPORTS TIMELINE */}
            {history.length > 0 && (
              <div className="px-5 sm:px-6 py-5 mt-5 border-t border-white/[0.06]">
                <p className="text-[11px] font-bold uppercase tracking-wider text-white/50 mb-3">Previous reports ({history.length})</p>
                <div className="space-y-1.5">
                  {history.map((h, i) => {
                    const hAvg = avgOf(h, categories)
                    // delta vs the next-older report (history is date-desc)
                    const olderAvg = i + 1 < history.length ? avgOf(history[i + 1], categories) : null
                    const d = hAvg != null && olderAvg != null ? Math.round((hAvg - olderAvg) * 10) / 10 : null
                    const { top: hTop, focus: hFocus } = topAndFocus(h, categories)
                    return (
                      <div key={h.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                        <span className="text-white/60 w-24 shrink-0">{fmt(h.review_date)}</span>
                        <span className="font-bold text-white tabular-nums w-10">{hAvg != null ? hAvg.toFixed(1) : '—'}</span>
                        {d != null && (
                          <span className={`w-12 tabular-nums ${d > 0 ? 'text-emerald-400' : d < 0 ? 'text-rose-400' : 'text-white/40'}`}>
                            {d > 0 ? `↑+${d.toFixed(1)}` : d < 0 ? `↓${d.toFixed(1)}` : '—'}
                          </span>
                        )}
                        {hTop && <span className="text-emerald-300/80">★ {hTop.label}</span>}
                        {hFocus && <span className="text-amber-300/80">◎ {hFocus.label}</span>}
                        {h.coach?.full_name && <span className="text-white/35 ml-auto">{h.coach.full_name}</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
