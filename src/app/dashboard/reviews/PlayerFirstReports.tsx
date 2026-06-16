/**
 * Player Reports Glow-Up — Phase 1A + 1B (presentation + derivation only).
 *
 * Re-presents the SAME loaded reviews as a premium player-development view:
 * hero (avatar/initials + position + age-group), overall score + stars +
 * progress-since-last + a mini progress sparkline, top strength / focus area,
 * an expandable full breakdown (skill-breakdown RADAR this-vs-last, category
 * scores table with vs-last + trend arrows, development insights, coach
 * summary), and an upgraded previous-reports timeline.
 *
 * Everything is DERIVED client-side from data already fetched by the page —
 * no new queries (avatar/position are read-only fields on the existing player
 * join), no writes, no schema, no scoring / publishing / parent / email /
 * visibility / business-logic changes. Flag-gated at the page level
 * (REPORTS_REDESIGN_ENABLED); off → original list. Server component; native
 * <details> + SVG, no client JS.
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
  player?: { first_name: string; last_name: string; age_group?: string | null; photo_url?: string | null; position?: string | null } | null
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
type CatRow = { label: string; score: number; last: number | null; delta: number | null }
function categoryRows(latest: Review, previous: Review | null, cats: NormalizedCategory[]): CatRow[] {
  return cats
    .map((c) => {
      const score = scoreFor(latest, c)
      if (score == null) return null
      const last = previous ? scoreFor(previous, c) : null
      const delta = last != null ? Math.round((score - last) * 10) / 10 : null
      return { label: c.label, score, last, delta }
    })
    .filter((x): x is CatRow => x != null)
}
function insights(rows: CatRow[], history: Review[], cats: NormalizedCategory[]) {
  const withDelta = rows.filter((r) => r.delta != null) as (CatRow & { delta: number })[]
  const strongest = rows.length ? rows.reduce((a, b) => (b.score > a.score ? b : a)) : null
  const mostImproved = withDelta.length ? withDelta.reduce((a, b) => (b.delta > a.delta ? b : a)) : null
  const largestDecline = withDelta.length ? withDelta.reduce((a, b) => (b.delta < a.delta ? b : a)) : null
  // Consistency: from the player's overall-score history variance (lower = steadier).
  const avgs = history.map((h) => avgOf(h, cats)).filter((v): v is number => v != null)
  let consistency: number | null = null
  if (avgs.length >= 2) {
    const m = avgs.reduce((a, b) => a + b, 0) / avgs.length
    const sd = Math.sqrt(avgs.reduce((a, b) => a + (b - m) ** 2, 0) / avgs.length)
    consistency = Math.max(0, Math.min(100, Math.round(100 - sd * 40)))
  }
  return {
    strongest,
    mostImproved: mostImproved && mostImproved.delta > 0 ? mostImproved : null,
    largestDecline: largestDecline && largestDecline.delta < 0 ? largestDecline : null,
    consistency,
  }
}

/* ── presentational atoms ── */

function Stars({ avg }: { avg: number }) {
  const full = Math.floor(avg)
  const half = avg - full >= 0.5
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${avg.toFixed(1)} out of 5`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} className="w-4 h-4" viewBox="0 0 20 20" aria-hidden>
          <defs><linearGradient id={`h${i}`}><stop offset="50%" stopColor="#f5c518" /><stop offset="50%" stopColor="rgba(255,255,255,0.15)" /></linearGradient></defs>
          <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 15.9 4.8 17.6l1-5.8L1.5 7.7l5.9-.9z"
            fill={i < full ? '#f5c518' : i === full && half ? `url(#h${i})` : 'rgba(255,255,255,0.15)'} />
        </svg>
      ))}
    </span>
  )
}

function TrendArrow({ delta }: { delta: number | null }) {
  if (delta == null) return <span className="text-white/30">—</span>
  if (delta > 0) return <span className="text-emerald-400" title="Improved">↗</span>
  if (delta < 0) return <span className="text-rose-400" title="Declined">↘</span>
  return <span className="text-white/40" title="No change">→</span>
}

function DeltaText({ d }: { d: number | null }) {
  if (d == null) return <span className="text-white/40">—</span>
  if (d > 0) return <span className="text-emerald-400 font-semibold">↑ {d.toFixed(1)}</span>
  if (d < 0) return <span className="text-rose-400 font-semibold">↓ {Math.abs(d).toFixed(1)}</span>
  return <span className="text-white/40">— 0.0</span>
}

// Mini progress sparkline of overall scores (oldest → newest).
function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null
  const W = 160, H = 40, pad = 4
  const min = Math.min(...values), max = Math.max(...values)
  const span = max - min || 1
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (W - 2 * pad)
    const y = H - pad - ((v - min) / span) * (H - 2 * pad)
    return [x, y]
  })
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-10" aria-hidden>
      <path d={d} fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="2" fill="#34d399" />)}
    </svg>
  )
}

// Generic N-axis radar — this report (filled) vs last report (dashed).
function Radar({ rows }: { rows: CatRow[] }) {
  const N = rows.length
  if (N < 3) return null
  const cx = 130, cy = 125, R = 92
  const ang = (i: number) => (-90 + (i * 360) / N) * (Math.PI / 180)
  const pt = (i: number, val: number) => [cx + (val / 5) * R * Math.cos(ang(i)), cy + (val / 5) * R * Math.sin(ang(i))]
  const poly = (vals: (number | null)[]) =>
    vals.map((v, i) => { const [x, y] = pt(i, v ?? 0); return `${x.toFixed(1)},${y.toFixed(1)}` }).join(' ')
  return (
    <svg viewBox="0 0 260 250" className="w-full max-w-[300px] mx-auto" role="img" aria-label="Skill breakdown radar">
      {[1, 2, 3, 4, 5].map((ring) => (
        <polygon key={ring}
          points={rows.map((_, i) => { const [x, y] = pt(i, ring); return `${x.toFixed(1)},${y.toFixed(1)}` }).join(' ')}
          fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      ))}
      {rows.map((_, i) => { const [x, y] = pt(i, 5); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(255,255,255,0.08)" /> })}
      {rows.some((r) => r.last != null) && (
        <polygon points={poly(rows.map((r) => r.last))} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" strokeDasharray="4 3" />
      )}
      <polygon points={poly(rows.map((r) => r.score))} fill="rgba(52,211,153,0.18)" stroke="#34d399" strokeWidth="2" />
      {rows.map((r, i) => {
        const [lx, ly] = pt(i, 6.05)
        return (
          <text key={i} x={lx} y={ly} fontSize="9" fill="rgba(255,255,255,0.6)"
            textAnchor={Math.abs(lx - cx) < 8 ? 'middle' : lx < cx ? 'end' : 'start'}>
            {r.label.length > 12 ? r.label.slice(0, 11) + '…' : r.label}
            <tspan x={lx} dy="10" fontSize="8" fill="#34d399" fontWeight="bold">{r.score}</tspan>
          </text>
        )
      })}
    </svg>
  )
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
  const groups = new Map<string, Review[]>()
  for (const r of reviews) {
    const pid = (r.player_id as string) || `${r.player?.first_name}-${r.player?.last_name}` || r.id
    const arr = groups.get(pid) ?? []
    arr.push(r)
    groups.set(pid, arr)
  }
  const cards = [...groups.values()]
    .map((list) => ({ latest: list[0], previous: list[1] ?? null, history: list, older: list.slice(1) }))
    .sort((a, b) => b.latest.review_date.localeCompare(a.latest.review_date))

  return (
    <div className="space-y-5">
      {cards.map(({ latest, previous, history, older }, idx) => {
        const name = latest.player ? `${latest.player.first_name} ${latest.player.last_name}` : 'Unknown'
        const avg = avgOf(latest, categories)
        const prevAvg = previous ? avgOf(previous, categories) : null
        const overallDelta = avg != null && prevAvg != null ? Math.round((avg - prevAvg) * 10) / 10 : null
        const rows = categoryRows(latest, previous, categories)
        const top = rows.length ? rows.reduce((a, b) => (b.score > a.score ? b : a)) : null
        const focus = rows.length ? rows.reduce((a, b) => (b.score < a.score ? b : a)) : null
        const ins = insights(rows, history, categories)
        const sparkVals = [...history].reverse().map((h) => avgOf(h, categories)).filter((v): v is number => v != null)
        const photo = latest.player?.photo_url
        const position = latest.player?.position

        return (
          <section key={latest.id} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] overflow-hidden">
            {/* ── SUMMARY (always visible) ── */}
            <div className="p-5 sm:p-6 grid gap-5 lg:grid-cols-[1.3fr_1fr_1fr] items-stretch border-b border-white/[0.06]">
              {/* hero */}
              <div className="flex items-center gap-4">
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo} alt="" className="w-16 h-16 rounded-2xl object-cover border border-white/10 shrink-0" />
                ) : (
                  <span className="w-16 h-16 shrink-0 rounded-2xl bg-[#4ecde6]/15 border border-[#4ecde6]/30 flex items-center justify-center text-lg font-bold text-[#4ecde6]">{initials(name)}</span>
                )}
                <div className="min-w-0">
                  <h3 className="text-xl font-bold text-white truncate">{name}</h3>
                  <p className="text-xs text-white/55 mt-0.5 truncate">
                    {[latest.player?.age_group, position].filter(Boolean).join(' · ') || '—'}
                  </p>
                  <p className="text-[11px] text-white/40 mt-1">Last report: {fmt(latest.review_date)}{latest.coach?.full_name ? ` · ${latest.coach.full_name}` : ''}</p>
                </div>
              </div>
              {/* overall score */}
              {avg != null && (
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
                  <p className="text-[10px] uppercase tracking-wider text-white/45">Overall Development Score</p>
                  <p className="text-3xl font-extrabold text-white leading-none mt-1">{avg.toFixed(1)}<span className="text-base font-bold text-white/40"> / 5</span></p>
                  <div className="mt-1.5"><Stars avg={avg} /></div>
                  <p className="text-[11px] mt-1.5">
                    {overallDelta == null ? <span className="text-white/40">First report</span>
                      : overallDelta > 0 ? <span className="text-emerald-400 font-semibold">↑ +{overallDelta.toFixed(1)} vs last report</span>
                      : overallDelta < 0 ? <span className="text-rose-400 font-semibold">↓ {overallDelta.toFixed(1)} vs last report</span>
                      : <span className="text-white/40">— no change</span>}
                  </p>
                </div>
              )}
              {/* top strength + focus + sparkline */}
              <div className="space-y-2">
                {top && <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.07] px-3 py-2 flex items-center justify-between"><span className="text-[10px] uppercase tracking-wider text-emerald-300/80 font-semibold">★ Top Strength</span><span className="text-sm font-bold text-white">{top.label} <span className="text-white/40 font-medium">{top.score}/5</span></span></div>}
                {focus && <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.07] px-3 py-2 flex items-center justify-between"><span className="text-[10px] uppercase tracking-wider text-amber-300/80 font-semibold">◎ Focus Area</span><span className="text-sm font-bold text-white">{focus.label} <span className="text-white/40 font-medium">{focus.score}/5</span></span></div>}
                {sparkVals.length >= 2 && (
                  <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-1.5">
                    <p className="text-[10px] uppercase tracking-wider text-white/40">Progress · last {sparkVals.length}</p>
                    <Sparkline values={sparkVals} />
                  </div>
                )}
              </div>
            </div>

            {/* ── EXPANDABLE FULL BREAKDOWN ── */}
            <details open={idx === 0} className="group">
              <summary className="cursor-pointer list-none px-5 sm:px-6 py-3 text-xs font-semibold text-[#4ecde6] hover:bg-white/[0.02] flex items-center gap-2">
                <span className="group-open:rotate-90 transition-transform">▸</span> Full breakdown
              </summary>

              <div className="px-5 sm:px-6 pb-6 grid gap-5 lg:grid-cols-[1fr_1fr]">
                {/* radar */}
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-sm font-semibold text-white">Skill Breakdown</h4>
                    <span className="text-[10px] text-white/45">● This <span className="text-white/30">⌐ Last</span></span>
                  </div>
                  <Radar rows={rows} />
                </div>

                {/* category scores table + insights */}
                <div className="space-y-4">
                  <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                    <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 text-[10px] uppercase tracking-wider text-white/40 pb-2 border-b border-white/[0.06]">
                      <span>Category</span><span className="text-right">This</span><span className="text-right">vs Last</span><span className="text-right">Trend</span>
                    </div>
                    {rows.map((r) => (
                      <div key={r.label} className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 items-center py-1.5 text-sm border-b border-white/[0.04] last:border-0">
                        <span className="text-white/80 truncate">{r.label}</span>
                        <span className="text-right font-semibold text-white tabular-nums">{r.score}<span className="text-white/30">/5</span></span>
                        <span className="text-right text-xs tabular-nums w-12"><DeltaText d={r.delta} /></span>
                        <span className="text-right"><TrendArrow delta={r.delta} /></span>
                      </div>
                    ))}
                  </div>
                  {/* development insights */}
                  <div className="grid grid-cols-2 gap-2">
                    {ins.strongest && <Insight label="Strongest" value={ins.strongest.label} tone="cyan" />}
                    {ins.mostImproved && <Insight label="Most Improved" value={`${ins.mostImproved.label} ↑${ins.mostImproved.delta!.toFixed(1)}`} tone="emerald" />}
                    {ins.largestDecline && <Insight label="Largest Decline" value={`${ins.largestDecline.label} ↓${Math.abs(ins.largestDecline.delta!).toFixed(1)}`} tone="rose" />}
                    {ins.consistency != null && <Insight label="Consistency" value={`${ins.consistency}%`} tone="muted" />}
                  </div>
                </div>
              </div>

              {/* coach summary */}
              {(latest.strengths || latest.focus_next || latest.parent_summary) && (
                <div className="px-5 sm:px-6 pb-5 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {latest.strengths && <Panel title="Strengths" tone="emerald" body={latest.strengths} />}
                    {latest.focus_next && <Panel title="Areas to Improve" tone="amber" body={latest.focus_next} />}
                  </div>
                  {latest.parent_summary && <Panel title="Coach Summary" sub="shown on the parent portal" tone="cyan" body={latest.parent_summary} />}
                </div>
              )}

              {/* previous reports timeline */}
              {older.length > 0 && (
                <div className="px-5 sm:px-6 pb-6 border-t border-white/[0.06] pt-5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-white/50 mb-3">Previous reports ({older.length})</p>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {older.map((h, i) => {
                      const hAvg = avgOf(h, categories)
                      const olderAvg = i + 1 < older.length ? avgOf(older[i + 1], categories) : null
                      const d = hAvg != null && olderAvg != null ? Math.round((hAvg - olderAvg) * 10) / 10 : null
                      const hr = categoryRows(h, older[i + 1] ?? null, categories)
                      const hTop = hr.length ? hr.reduce((a, b) => (b.score > a.score ? b : a)) : null
                      const hFocus = hr.length ? hr.reduce((a, b) => (b.score < a.score ? b : a)) : null
                      return (
                        <div key={h.id} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-white/55">{fmt(h.review_date)}</span>
                            <span className="text-xs"><DeltaText d={d} /></span>
                          </div>
                          <p className="text-2xl font-extrabold text-white mt-0.5">{hAvg != null ? hAvg.toFixed(1) : '—'}<span className="text-xs text-white/30"> /5</span></p>
                          {hTop && <p className="text-[11px] text-emerald-300/80 mt-1">★ {hTop.label}</p>}
                          {hFocus && <p className="text-[11px] text-amber-300/80">◎ {hFocus.label}</p>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </details>
          </section>
        )
      })}
    </div>
  )
}

function Insight({ label, value, tone }: { label: string; value: string; tone: 'cyan' | 'emerald' | 'rose' | 'muted' }) {
  const t: Record<string, string> = {
    cyan: 'border-[#4ecde6]/25 bg-[#4ecde6]/[0.06] text-[#4ecde6]',
    emerald: 'border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-300',
    rose: 'border-rose-500/25 bg-rose-500/[0.06] text-rose-300',
    muted: 'border-white/[0.08] bg-white/[0.03] text-white/70',
  }
  return (
    <div className={`rounded-xl border p-3 ${t[tone]}`}>
      <p className="text-[10px] uppercase tracking-wider opacity-70">{label}</p>
      <p className="text-sm font-bold mt-0.5 truncate">{value}</p>
    </div>
  )
}

function Panel({ title, sub, tone, body }: { title: string; sub?: string; tone: 'emerald' | 'amber' | 'cyan'; body: string }) {
  const t: Record<string, string> = {
    emerald: 'border-emerald-500/15 bg-emerald-500/[0.05] text-emerald-300/70',
    amber: 'border-amber-500/15 bg-amber-500/[0.05] text-amber-300/70',
    cyan: 'border-[#4ecde6]/20 bg-[#4ecde6]/[0.05] text-[#4ecde6]/70',
  }
  return (
    <div className={`rounded-xl border px-4 py-3 ${t[tone]}`}>
      <p className="text-[10px] uppercase tracking-wider font-semibold mb-1">{title}{sub && <span className="text-white/30 normal-case font-medium"> · {sub}</span>}</p>
      <p className="text-sm text-white/85 leading-relaxed">{body}</p>
    </div>
  )
}
