'use client'

import { useMemo, useState } from 'react'
import { useBrand } from '@/components/BrandProvider'

interface Group { id: string; name: string; day: string | null; time: string | null }
interface Plan { id: string; name: string; amount: number }

/**
 * Migrate Member — single-family signup-link generator.
 *
 * Finish-pass changes (no workflow redesign, presentation only):
 *   • Clearer visual hierarchy — labeled steps + section dividers.
 *   • Live review summary card appears as soon as plan + date are picked.
 *   • Days-until-first-charge indicator next to the date input.
 *   • Three send paths: Copy, WhatsApp (wa.me prefilled), Email (mailto: prefilled).
 *   • Pre-written message templates the admin can copy without writing them.
 *   • Reassurance copy: if the parent already has an account they sign in;
 *     warn against forwarding the link to more than one family.
 */
export default function MigrateMemberForm({
  slug,
  academyName,
  groups,
  plans,
}: {
  slug: string
  academyName: string
  groups: Group[]
  plans: Plan[]
}) {
  const brand = useBrand()
  const primary = brand?.primaryColor || '#4ecde6'

  const [planId, setPlanId] = useState('')
  const [classId, setClassId] = useState('')
  const [billedFrom, setBilledFrom] = useState('')
  const [copied, setCopied] = useState(false)

  // Default the date to the 1st of next month — the most common
  // "their term runs out" point.
  const defaultDate = useMemo(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString().split('T')[0]
  }, [])

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.theplayerportal.net'
  const effectiveDate = billedFrom || defaultDate

  const selectedPlan = useMemo(() => plans.find((p) => p.id === planId) || null, [plans, planId])
  const selectedClass = useMemo(() => groups.find((g) => g.id === classId) || null, [groups, classId])

  const link = useMemo(() => {
    if (!slug || !planId) return ''
    const params = new URLSearchParams({ org: slug, plan: planId, billedFrom: effectiveDate })
    if (classId) params.set('class', classId)
    return `${origin}/auth/signup?${params.toString()}`
  }, [slug, planId, classId, effectiveDate, origin])

  // Anti-tamper cap mirrors the server (100 days). Warn the admin if they
  // exceed it; the server-side check at /api/stripe/subscribe will reject
  // the parent's submission anyway, but failing fast in the UI is kinder.
  const daysUntilCharge = useMemo(() => {
    const ms = new Date(effectiveDate).getTime() - Date.now()
    return Math.round(ms / 86400000)
  }, [effectiveDate])
  const tooFarOut = daysUntilCharge > 100

  // Human date for review summary + message templates.
  const humanDate = useMemo(() => {
    try {
      return new Date(effectiveDate + 'T00:00:00').toLocaleDateString('en-GB', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    } catch {
      return effectiveDate
    }
  }, [effectiveDate])

  // Pre-written message templates the admin can send without writing them.
  // Kept short, friendly, and informative (price + first-charge date).
  const messageBody = useMemo(() => {
    if (!selectedPlan) return ''
    return (
      `Hi! We've upgraded to Player Portal for class management and payments at ${academyName}.\n\n` +
      `Tap this link to set up your child's account — it'll take 2 minutes. Add your card to be charged automatically each month (£0 today, first charge ${humanDate}):\n\n` +
      `${link}\n\n` +
      `Same classes, same coaches, same monthly price (£${selectedPlan.amount.toFixed(2)}/mo). Reply here if anything's unclear.`
    )
  }, [link, selectedPlan, humanDate, academyName])

  const emailSubject = useMemo(
    () => selectedPlan ? `${academyName}: confirm your subscription (takes 2 minutes)` : '',
    [academyName, selectedPlan],
  )

  async function copyLink() {
    if (!link) return
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  async function copyTemplate() {
    if (!messageBody) return
    await navigator.clipboard.writeText(messageBody)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const labelCls = 'block text-xs sm:text-sm font-semibold text-white/65 mb-1.5'
  const inputCls = 'w-full px-3.5 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10 transition-all'

  return (
    <div className="space-y-5">
      {/* Form card */}
      <div className="bg-[#141414] border border-white/[0.08] rounded-2xl p-4 sm:p-6 space-y-5">
        {/* Step 1 — Plan */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-5 h-5 rounded-full bg-[#4ecde6]/15 border border-[#4ecde6]/30 text-[#4ecde6] text-[10px] font-bold flex items-center justify-center">1</span>
            <span className={labelCls + ' mb-0'}>Plan</span>
          </div>
          <select
            className={inputCls}
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
            aria-label="Subscription plan"
          >
            <option value="">Choose the plan they were already paying…</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>{p.name} — £{p.amount.toFixed(2)}/mo</option>
            ))}
          </select>
        </div>

        {/* Step 2 — Class (optional) */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-5 h-5 rounded-full bg-[#4ecde6]/15 border border-[#4ecde6]/30 text-[#4ecde6] text-[10px] font-bold flex items-center justify-center">2</span>
            <span className={labelCls + ' mb-0'}>Class to auto-enrol them in</span>
            <span className="text-[10px] text-white/35 uppercase tracking-wider ml-1">Optional</span>
          </div>
          <select
            className={inputCls}
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            aria-label="Class to auto-enrol"
          >
            <option value="">Don&apos;t auto-enrol — they pick later</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}{g.day ? ` — ${g.day}` : ''}{g.time ? ` ${g.time}` : ''}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-white/40 mt-1.5">
            If set, the parent goes straight to that class after sign-up. Leave blank if they&apos;ll choose themselves.
          </p>
        </div>

        {/* Step 3 — First charge date */}
        <div>
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#4ecde6]/15 border border-[#4ecde6]/30 text-[#4ecde6] text-[10px] font-bold flex items-center justify-center">3</span>
              <span className={labelCls + ' mb-0'}>First charge date</span>
            </div>
            {planId && (
              <span className="text-[10px] uppercase tracking-wider font-semibold text-white/45">
                {daysUntilCharge > 0 ? `in ${daysUntilCharge} day${daysUntilCharge === 1 ? '' : 's'}` : 'today'}
              </span>
            )}
          </div>
          <input
            type="date"
            className={`${inputCls} [color-scheme:dark]`}
            value={billedFrom || defaultDate}
            min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
            max={new Date(Date.now() + 99 * 86400000).toISOString().split('T')[0]}
            onChange={(e) => setBilledFrom(e.target.value)}
            aria-label="First charge date"
          />
          <p className="text-[11px] text-white/40 mt-1.5">
            £0 today, full price on this date. Set it to when their current payment runs out.
          </p>
          {tooFarOut && (
            <p className="text-[11px] text-amber-300 mt-1.5 flex items-center gap-1.5">
              <span aria-hidden>⚠</span>
              That&apos;s more than 100 days out — the server will reject it. Pick a closer date.
            </p>
          )}
        </div>
      </div>

      {/* Review summary — appears once plan is picked */}
      {selectedPlan && (
        <div
          className="rounded-2xl border border-[#4ecde6]/25 bg-[#4ecde6]/[0.04] p-4 sm:p-5"
          data-testid="migrate-member-review"
        >
          <p className="text-[10px] uppercase tracking-wider text-[#4ecde6] font-bold mb-3">Review</p>
          <dl className="space-y-2 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-white/55 shrink-0">Plan</dt>
              <dd className="text-white font-medium text-right truncate">
                {selectedPlan.name} <span className="text-white/55 font-normal">· £{selectedPlan.amount.toFixed(2)}/mo</span>
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-white/55 shrink-0">Class</dt>
              <dd className="text-white font-medium text-right truncate">
                {selectedClass ? (
                  <>
                    {selectedClass.name}
                    {(selectedClass.day || selectedClass.time) && (
                      <span className="text-white/55 font-normal">
                        {' '}· {selectedClass.day}{selectedClass.time ? ' ' + selectedClass.time : ''}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-white/45 italic">No auto-enrol</span>
                )}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-white/55 shrink-0">First charge</dt>
              <dd className="text-white font-medium text-right">
                {humanDate}{' '}
                <span className="text-white/55 font-normal">
                  ({daysUntilCharge > 0 ? `in ${daysUntilCharge} day${daysUntilCharge === 1 ? '' : 's'}` : 'today'})
                </span>
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 pt-2 border-t border-white/[0.06]">
              <dt className="text-white/55 shrink-0">Today</dt>
              <dd className="text-emerald-300 font-semibold text-right">£0.00</dd>
            </div>
          </dl>
          <p className="text-xs text-white/55 mt-3 leading-relaxed">
            When the parent opens the link they create their account (or sign in if they already have one),
            add their card, and are charged <strong className="text-white">£0 today</strong>. Stripe schedules{' '}
            <strong className="text-white">£{selectedPlan.amount.toFixed(2)}</strong> for{' '}
            <strong className="text-white">{humanDate}</strong> and continues monthly after that.
          </p>
        </div>
      )}

      {/* Send actions — appears once we have a valid link */}
      {link && !tooFarOut && (
        <div className="bg-[#141414] border border-white/[0.08] rounded-2xl p-4 sm:p-6 space-y-4">
          <div>
            <p className={labelCls}>Shareable link</p>
            <div className="px-3 py-2.5 rounded-xl bg-black/40 border border-white/[0.08] text-xs text-white/70 break-all font-mono">
              {link}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
              onClick={copyLink}
              className="py-3 rounded-xl font-bold text-sm transition-all hover:scale-[1.01] active:scale-[0.98]"
              style={{ backgroundColor: primary, color: '#0a0a0a' }}
            >
              {copied ? '✓ Copied' : 'Copy link'}
            </button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(messageBody)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="py-3 rounded-xl font-semibold text-sm text-center bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors flex items-center justify-center gap-2"
            >
              <span aria-hidden>💬</span> Send via WhatsApp
            </a>
            <a
              href={`mailto:?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(messageBody)}`}
              className="py-3 rounded-xl font-semibold text-sm text-center bg-white/[0.06] text-white/85 border border-white/[0.12] hover:bg-white/[0.10] transition-colors flex items-center justify-center gap-2"
            >
              <span aria-hidden>✉</span> Send via email
            </a>
          </div>

          {/* Pre-written message — admin can use as-is or tweak */}
          <details className="group">
            <summary className="cursor-pointer text-xs sm:text-sm font-semibold text-white/65 hover:text-white transition-colors flex items-center gap-2">
              <svg className="w-3 h-3 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              Suggested message
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); copyTemplate() }}
                className="ml-auto text-[11px] text-[#4ecde6] hover:text-[#7dddf0] font-semibold"
              >
                {copied ? 'Copied ✓' : 'Copy text'}
              </button>
            </summary>
            <div className="mt-2 px-3 py-3 rounded-xl bg-black/40 border border-white/[0.08] text-xs text-white/70 leading-relaxed whitespace-pre-wrap font-sans">
              {messageBody}
            </div>
            <p className="text-[10px] text-white/35 mt-1.5">
              Replace &ldquo;your child&apos;s&rdquo; with the actual child&apos;s name before sending.
              Edit the rest if it doesn&apos;t sound like you.
            </p>
          </details>

          {/* Reassurance + caveats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-3 border-t border-white/[0.06]">
            <div className="px-3 py-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02]">
              <p className="text-[11px] text-white/55 leading-relaxed">
                <strong className="text-white/80">Already have an account?</strong> No problem — they&apos;ll
                sign in and the child + subscription get added to their existing profile.
              </p>
            </div>
            <div className="px-3 py-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02]">
              <p className="text-[11px] text-white/55 leading-relaxed">
                <strong className="text-white/80">One family per link.</strong> Send to one parent. Generate a new link for the next family — keeps your billing date specific to them.
              </p>
            </div>
          </div>
        </div>
      )}

      {!planId && (
        <div className="bg-white/[0.02] border border-dashed border-white/[0.08] rounded-2xl p-6 text-center">
          <p className="text-sm text-white/40">Pick a plan above to generate the shareable link.</p>
        </div>
      )}
    </div>
  )
}
