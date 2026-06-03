/**
 * Trial follow-up due section — Phase 2.4 step 2 (visibility only).
 *
 * Server component. Pure presentation given a pre-derived list of rows.
 * The Enrolments page passes the unified TrialFollowUpRow[] cohort here;
 * we never re-derive or query.
 *
 * READ-ONLY actions:
 *   • Message parent → mailto:parent_email (no messaging-system changes)
 *   • View trial / enrolment → existing pages
 *   • View parent → /dashboard/parents/[id] (only when we have parent_id)
 *
 * Convert / extend / mark-lost buttons are intentionally NOT shown here.
 * They land in Phase 2.4 step 3 after the user approves the read-only pass.
 */
import Link from 'next/link'
import type { TrialFollowUpRow } from '@/lib/trial-followups-loader'
import { STAGE_LABEL } from '@/lib/trial-derive'
// Phase 2.4 step 5 — DB-only admin actions. Each button confirms before
// firing and refreshes the page on success. No Stripe / cron / email.
import TrialFollowUpActions from './TrialFollowUpActions'

interface Props {
  rows: TrialFollowUpRow[]
}

export default function TrialFollowUpSection({ rows }: Props) {
  if (rows.length === 0) return null

  const staleCount = rows.filter(r => r.stage === 'stale_followup').length
  const awaitingCount = rows.length - staleCount

  return (
    <section id="trial-followup">
      {/* Heading — visible cue that this is the action queue surface */}
      <div className="flex items-baseline gap-2 mb-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-amber-300">
          Trial follow-up due
        </h2>
        <span className="text-xs text-white/30">
          {rows.length}
          {staleCount > 0 ? ` · ${staleCount} stale` : ''}
        </span>
      </div>

      <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.03] overflow-hidden">
        {/* Mini context line — tells the academy owner WHY these are surfaced. */}
        <div className="px-4 py-2 text-[11px] text-amber-200/80 bg-amber-500/[0.04] border-b border-amber-500/15">
          {awaitingCount > 0 && (
            <>
              <strong className="font-semibold">{awaitingCount}</strong> trial
              {awaitingCount === 1 ? '' : 's'} awaiting a follow-up.
            </>
          )}
          {staleCount > 0 && (
            <>
              {awaitingCount > 0 ? ' ' : ''}
              <strong className="font-semibold text-amber-100">{staleCount}</strong> still open after 7 days — escalate.
            </>
          )}
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white/[0.02]">
              <Th>Child</Th>
              <Th>Parent</Th>
              <Th>Class</Th>
              <Th>Trial date</Th>
              <Th>Stage</Th>
              <Th>Days since</Th>
              <Th className="text-right pr-4">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={`${r.source}:${r.id}`} className="border-t border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                <Td>
                  <div className="font-medium text-white">{r.childName}</div>
                  <div className="text-[10px] uppercase tracking-wider text-white/30 mt-0.5">
                    {r.source === 'booking' ? 'Trial booking' : 'Enrolment trial'}
                  </div>
                </Td>
                <Td className="text-white/75">
                  {r.parentName || <span className="text-white/30 italic">No name</span>}
                  {r.parentEmail && (
                    <div className="text-[11px] text-white/40 truncate max-w-[180px]">{r.parentEmail}</div>
                  )}
                </Td>
                <Td className="text-white/70">
                  {r.groupName || <span className="text-white/30 italic">—</span>}
                </Td>
                <Td className="text-white/70">
                  {r.trialDateIso ? formatDate(r.trialDateIso) : <span className="text-white/30">—</span>}
                </Td>
                <Td>
                  <StageChip stage={r.stage} />
                </Td>
                <Td className="text-white/60 tabular-nums">
                  {r.daysSinceTrial === null
                    ? '—'
                    : r.daysSinceTrial === 0
                      ? 'Today'
                      : `${r.daysSinceTrial}d`}
                </Td>
                <Td className="text-right pr-4">
                  <div className="flex flex-col items-end gap-1.5">
                    {/* Row 1 — read-only navigation (Phase 2.4 steps 2-4) */}
                    <div className="inline-flex items-center gap-1.5 flex-wrap justify-end">
                      {r.messageHref ? (
                        <a
                          href={r.messageHref}
                          className="px-2 py-1 rounded-md text-[11px] bg-amber-500/10 text-amber-200 border border-amber-500/30 hover:bg-amber-500/20 transition-colors"
                          title="Email parent (opens in your mail client)"
                        >
                          ✉ Message
                        </a>
                      ) : (
                        <span
                          className="px-2 py-1 rounded-md text-[11px] bg-white/[0.04] text-white/30 border border-white/[0.06]"
                          title="No parent email on file"
                        >
                          ✉ Message
                        </span>
                      )}
                      <Link
                        href={r.viewHref}
                        className="px-2 py-1 rounded-md text-[11px] bg-white/[0.04] text-white/80 border border-white/[0.08] hover:bg-white/[0.08] transition-colors"
                      >
                        View
                      </Link>
                      {r.parentHref ? (
                        <Link
                          href={r.parentHref}
                          className="px-2 py-1 rounded-md text-[11px] bg-white/[0.04] text-white/80 border border-white/[0.08] hover:bg-white/[0.08] transition-colors"
                        >
                          Family
                        </Link>
                      ) : null}
                    </div>
                    {/* Row 2 — Phase 2.4 step 5 DB-only admin actions */}
                    <TrialFollowUpActions
                      source={r.source}
                      id={r.id}
                      signupHref={r.parentHref || '/dashboard/groups'}
                    />
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// ─── Stage chip ────────────────────────────────────────────────────────

function StageChip({ stage }: { stage: TrialFollowUpRow['stage'] }) {
  // Only two stages appear in this section: awaiting_followup, stale_followup.
  // Render the others defensively (in case the cohort filter ever changes).
  const tone =
    stage === 'stale_followup'
      ? 'bg-rose-500/15 text-rose-200 border-rose-500/30'
      : stage === 'awaiting_followup'
        ? 'bg-amber-500/15 text-amber-200 border-amber-500/30'
        : 'bg-white/[0.04] text-white/60 border-white/[0.08]'

  return (
    <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-medium border ${tone}`}>
      {STAGE_LABEL[stage]}
    </span>
  )
}

// ─── Tiny table primitives — kept local; the page has its own copies. ──

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`text-left px-3 py-2 text-[10px] uppercase tracking-wider text-white/40 font-bold ${className || ''}`}>
      {children}
    </th>
  )
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2.5 align-middle ${className || 'text-white'}`}>{children}</td>
}

// ─── Date formatter ────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}
