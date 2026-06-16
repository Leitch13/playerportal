import Link from 'next/link'
import Card from '@/components/Card'
import ReportPremiumTop from '@/components/reports/ReportPremiumTop'
import ProgressTrend from '@/app/dashboard/feedback/ProgressTrend'
import RadarChart from '@/components/RadarChart'
import { PARENT_PROGRESS_V2_1B_ENABLED, type ChildJourney } from '@/lib/parent-progress-v2'

// Parent Progress 2.0 — Phase 1A. Server presentational. Child-first development
// journey: a child selector (when >1 child), the latest report as a premium hero
// (reuses ReportPremiumTop — its native LIGHT theme, hosted in a white "report
// card"), strengths/focus, a progress trend (reuses ProgressTrend — its native
// DARK theme, in a dark card) or a one-report baseline, a compact report history,
// and a deep link into the full report. No new data; all of it is built upstream
// from the reviews the Progress loader already returned.

function fmtDate(d: string | null): string {
  if (!d) return ''
  const t = Date.parse(d)
  if (Number.isNaN(t)) return ''
  return new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
function fmtNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

export default function ParentProgressV2({
  journeys,
  selectedId,
}: {
  journeys: ChildJourney[]
  selectedId: string
}) {
  const Header = (
    <div>
      <h1 className="text-2xl font-bold text-white">Progress</h1>
      <p className="text-sm text-white/50 mt-1">Your child&rsquo;s development journey.</p>
    </div>
  )

  if (journeys.length === 0) {
    return (
      <div className="space-y-6 max-w-3xl">
        {Header}
        <Card>
          <p className="text-sm text-white/60">No children are linked to your account yet. Your academy will add them when you enrol.</p>
        </Card>
      </div>
    )
  }

  const selected = journeys.find((j) => j.playerId === selectedId) ?? journeys[0]
  const multi = journeys.length > 1

  return (
    <div className="space-y-6 max-w-3xl">
      {Header}

      {/* Child selector — searchParams-driven, no client JS */}
      {multi && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Select child">
          {journeys.map((j) => {
            const active = j.playerId === selected.playerId
            return (
              <Link
                key={j.playerId}
                href={`/dashboard/feedback?child=${j.playerId}`}
                role="tab"
                aria-selected={active}
                className={`px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${
                  active
                    ? 'bg-accent text-[#0a0a0a] border-accent'
                    : 'bg-white/[0.04] text-white/60 border-white/10 hover:text-white'
                }`}
              >
                {j.firstName}
              </Link>
            )
          })}
        </div>
      )}

      {selected.hero === null ? (
        // ── No reports for this child ──
        <Card>
          <div className="py-6 text-center">
            <p className="text-base font-semibold text-white">No reports for {selected.firstName} yet</p>
            <p className="text-sm text-white/50 mt-1 max-w-md mx-auto">
              Your coach will add a progress report after sessions. {selected.firstName}&rsquo;s development journey will appear here.
            </p>
            <Link
              href="/dashboard/schedule"
              className="inline-block mt-4 px-4 py-2 rounded-lg text-sm font-semibold bg-white/[0.06] text-white hover:bg-white/[0.1] transition-colors"
            >
              View schedule
            </Link>
          </div>
        </Card>
      ) : (
        <>
          {/* ── Latest report — premium hero in a white report card ── */}
          <div className="bg-white rounded-2xl border border-border overflow-hidden">
            <ReportPremiumTop
              firstName={selected.hero.firstName}
              verdict={selected.hero.verdict}
              headline={selected.hero.headline}
              rating={selected.hero.rating}
              coachQuote={selected.hero.coachQuote}
              coachName={selected.hero.coachName}
              deltas={selected.hero.deltas}
              hasPrevReview={selected.hero.hasPrevReview}
            />
          </div>

          {/* ── Phase 1B: Strongest / Focus chips + Engagement & Value strip ── */}
          {PARENT_PROGRESS_V2_1B_ENABLED && (
            <>
              {(selected.strongest || selected.focusChip) && (
                <div className="flex flex-wrap gap-2" data-testid="skill-chips">
                  {selected.strongest && (
                    <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-sm">
                      <span aria-hidden>🌟</span>
                      <span className="text-white/50">Strongest skill</span>
                      <span className="font-semibold text-emerald-300">{selected.strongest.label}</span>
                    </span>
                  )}
                  {selected.focusChip && (
                    <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-sm">
                      <span aria-hidden>🎯</span>
                      <span className="text-white/50">Current focus</span>
                      <span className="font-semibold text-amber-300">{selected.focusChip.label}</span>
                    </span>
                  )}
                </div>
              )}

              <div className="rounded-2xl border border-white/10 bg-[#141414] p-4" data-testid="engagement-strip">
                <p className="mb-3 text-xs font-medium uppercase tracking-wider text-white/40">Engagement &amp; value</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <p className="text-2xl font-bold text-white">
                      {selected.engagement.attendancePct != null ? `${selected.engagement.attendancePct}%` : '—'}
                    </p>
                    <p className="text-[11px] text-white/40">{selected.engagement.attendancePct != null ? 'Attendance' : 'Sessions start soon'}</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{selected.engagement.sessionsAttended}</p>
                    <p className="text-[11px] text-white/40">Sessions attended</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{selected.engagement.streak > 0 ? `🔥 ${selected.engagement.streak}` : '—'}</p>
                    <p className="text-[11px] text-white/40">In a row</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{selected.engagement.reportsReceived}</p>
                    <p className="text-[11px] text-white/40">Report{selected.engagement.reportsReceived === 1 ? '' : 's'} received</p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── Strengths & focus ── */}
          {(selected.strengths || selected.focusNext) && (
            <Card title="Strengths &amp; focus">
              <div className="grid gap-4 sm:grid-cols-2">
                {selected.strengths && (
                  <div>
                    <h3 className="text-xs uppercase tracking-wide text-white/40 font-semibold mb-1">Strengths</h3>
                    <p className="text-sm text-white/80">{selected.strengths}</p>
                  </div>
                )}
                {selected.focusNext && (
                  <div>
                    <h3 className="text-xs uppercase tracking-wide text-white/40 font-semibold mb-1">Work on next</h3>
                    <p className="text-sm text-white/80">{selected.focusNext}</p>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* ── Phase 1B: Skill breakdown radar (latest report) ── */}
          {PARENT_PROGRESS_V2_1B_ENABLED && selected.radar.length >= 3 && (
            <Card title="Skill breakdown">
              <div data-testid="skill-radar" className="mx-auto max-w-xs">
                <RadarChart scores={selected.radar.map((p) => ({ label: p.label, value: p.value }))} />
              </div>
            </Card>
          )}

          {/* ── Progress trend (or one-report baseline) ── */}
          <Card title="Progress trend">
            {selected.hasTrend ? (
              <ProgressTrend reviews={selected.trendReviews} scoringCategories={selected.displayCategories} />
            ) : (
              <p className="text-sm text-white/50">
                Baseline set — {selected.firstName}&rsquo;s trend will appear here after the next report. 📈
              </p>
            )}
          </Card>

          {/* ── Report history ── */}
          <Card title="Report history">
            <ul className="divide-y divide-white/[0.06]">
              {selected.history.map((h, i) => (
                <li key={h.id || i} className="flex items-center justify-between py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white">{fmtDate(h.date) || 'Report'}</p>
                    {h.coachName && <p className="text-xs text-white/50">Reviewed by {h.coachName}</p>}
                    {/* Phase 1B — enriched timeline row: change + strongest + focus */}
                    {PARENT_PROGRESS_V2_1B_ENABLED && (h.strongest || h.focus || h.delta != null) && (
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-white/40" data-testid="history-enriched">
                        {h.delta != null && h.delta !== 0 && (
                          <span className={h.delta > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                            {h.delta > 0 ? '↑' : '↓'}{Math.abs(h.delta)}
                          </span>
                        )}
                        {h.strongest && <span>★ {h.strongest}</span>}
                        {h.focus && <span>◎ {h.focus}</span>}
                      </p>
                    )}
                  </div>
                  {h.rating != null && (
                    <span className="text-sm font-bold text-accent shrink-0">
                      {fmtNum(h.rating)}
                      <span className="text-xs text-white/40">/5</span>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </Card>

          {/* ── View full report ── */}
          <Link
            href={`/dashboard/players/${selected.playerId}/report`}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold bg-accent text-[#0a0a0a] hover:opacity-90 transition-opacity"
          >
            View {selected.firstName}&rsquo;s full report
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </>
      )}
    </div>
  )
}
