/**
 * Sprint 14 — Academy Readiness widget.
 *
 * Server component. Renders the structured ReadinessState produced by
 * src/lib/academy-readiness.ts.
 *
 * Cannot be dismissed (no client state). Survives page refresh (state
 * is computed server-side every render). Designed to be understood
 * within 5 seconds:
 *
 *   • Top-of-card verdict pill ─ "NOT LIVE" red / "LIVE" green
 *   • One-line "next step" callout when not live
 *   • 8-item check list with per-row CTA links
 *
 * Pure display. Reads only — does not call Stripe, does not write to
 * the database, does not touch any protected system.
 */

import Link from 'next/link'
import type { ReadinessItem, ReadinessState } from '@/lib/academy-readiness'

export default function AcademyReadinessWidget({ state }: { state: ReadinessState }) {
  const { isLive, items, doneCount, totalCount, nextStep, isPilot } = state

  return (
    <section
      data-testid="academy-readiness"
      aria-labelledby="academy-readiness-heading"
      className="rounded-2xl border border-[#1e1e1e] bg-[#0f0f0f] p-5 sm:p-6"
    >
      {/* Header — verdict + progress */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 sm:mb-5">
        <div className="flex items-center gap-3">
          <h2 id="academy-readiness-heading" className="text-sm sm:text-base font-bold uppercase tracking-wider text-white/70">
            Academy Readiness
          </h2>
          <span
            data-testid="academy-readiness-verdict"
            className={
              isLive
                ? 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/40'
                : 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/40'
            }
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-emerald-400' : 'bg-amber-400'}`}
              aria-hidden
            />
            {isLive ? 'Live' : 'Not live'}
          </span>
        </div>
        <span className="text-xs text-white/40 font-medium">
          {doneCount}/{totalCount} complete
        </span>
      </div>

      {/* "Next step" callout — only when not live */}
      {!isLive && nextStep && (
        <div
          data-testid="academy-readiness-next-step"
          className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-4"
        >
          <p className="text-sm font-semibold text-amber-100 leading-snug mb-1">
            Your academy is in preview mode.
            <span className="text-amber-200/70 font-medium"> Parents can&apos;t book yet.</span>
          </p>
          <p className="text-sm text-white/80">
            <span className="text-amber-300/90 font-semibold">Next step:</span>{' '}
            {nextStep.cta ? (
              <Link href={nextStep.cta.href} className="text-amber-200 underline underline-offset-2 hover:text-amber-100">
                {nextStep.label}
              </Link>
            ) : (
              <span className="text-amber-200">{nextStep.label}</span>
            )}
            {nextStep.detail && (
              <span className="block text-xs text-white/50 mt-1">{nextStep.detail}</span>
            )}
          </p>
        </div>
      )}

      {/* LIVE state celebration */}
      {isLive && (
        <div
          data-testid="academy-readiness-live-summary"
          className="mb-5 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] p-4"
        >
          <p className="text-sm font-semibold text-emerald-200 leading-snug mb-0.5">
            🎉 You&apos;re live{isPilot ? ' (pilot)' : ''}.
          </p>
          <p className="text-sm text-emerald-100/80">
            Parents can book and pay. Share your booking page link to start enrolling.
          </p>
        </div>
      )}

      {/* 8-item readiness list */}
      <ul className="space-y-2 sm:space-y-2.5" role="list">
        {items.map((item) => (
          <ReadinessRow key={item.key} item={item} />
        ))}
      </ul>
    </section>
  )
}

function ReadinessRow({ item }: { item: ReadinessItem }) {
  const labelEl = item.cta && !item.done ? (
    <Link
      href={item.cta.href}
      className="text-white hover:text-[#4ecde6] transition-colors underline underline-offset-2 decoration-white/20 hover:decoration-[#4ecde6]/60"
    >
      {item.label}
    </Link>
  ) : (
    <span className={item.done ? 'text-white/85' : 'text-white/85'}>{item.label}</span>
  )

  return (
    <li
      data-testid={`academy-readiness-row-${item.key}`}
      data-done={item.done ? 'true' : 'false'}
      className="flex items-start gap-3 py-1.5"
    >
      <span
        aria-hidden
        className={
          item.done
            ? 'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
            : 'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/[0.04] text-white/40 border border-white/10'
        }
      >
        {item.done ? (
          <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
            <path d="M3 7L6 10L11 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
        )}
      </span>
      <span className="sr-only">{item.done ? 'Complete:' : 'To do:'}</span>
      <div className="min-w-0 flex-1">
        <div className="text-sm">{labelEl}</div>
        {item.detail && (
          <div className="text-xs text-white/45 mt-0.5 leading-snug">{item.detail}</div>
        )}
      </div>
      {item.cta && !item.done && (
        <Link
          href={item.cta.href}
          className="shrink-0 text-xs font-semibold text-[#4ecde6] hover:text-[#6dd8ee] transition-colors whitespace-nowrap"
          aria-label={item.cta.label}
        >
          {item.cta.label} →
        </Link>
      )}
    </li>
  )
}
