'use client'

import { useMemo, useState } from 'react'
import { useBrand } from '@/components/BrandProvider'

interface Group { id: string; name: string; day: string | null; time: string | null }
interface Plan { id: string; name: string; amount: number }

export default function MigrateMemberForm({
  slug,
  groups,
  plans,
}: {
  slug: string
  groups: Group[]
  plans: Plan[]
}) {
  const brand = useBrand()
  const primary = brand?.primaryColor || '#4ecde6'

  const [planId, setPlanId] = useState('')
  const [classId, setClassId] = useState('')
  const [billedFrom, setBilledFrom] = useState('')
  const [copied, setCopied] = useState(false)

  // Default the date to the 1st of next month — the most common "their term runs out" point.
  const defaultDate = useMemo(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString().split('T')[0]
  }, [])

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.theplayerportal.net'
  const effectiveDate = billedFrom || defaultDate

  const link = useMemo(() => {
    if (!slug || !planId) return ''
    const params = new URLSearchParams({ org: slug, plan: planId, billedFrom: effectiveDate })
    if (classId) params.set('class', classId)
    return `${origin}/auth/signup?${params.toString()}`
  }, [slug, planId, classId, effectiveDate, origin])

  // Anti-tamper cap mirrors the server (100 days). Warn the admin if they exceed it.
  const tooFarOut = useMemo(() => {
    const ms = new Date(effectiveDate).getTime() - Date.now()
    return ms > 100 * 86400 * 1000
  }, [effectiveDate])

  async function copy() {
    if (!link) return
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const label = 'block text-xs sm:text-sm text-white/60 mb-1.5'
  const input = 'w-full px-3.5 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10 transition-all'

  return (
    <div className="bg-[#141414] border border-white/[0.08] rounded-2xl p-4 sm:p-6 space-y-4 max-w-xl">
      <div>
        <label className={label}>Plan *</label>
        <select className={input} value={planId} onChange={(e) => setPlanId(e.target.value)}>
          <option value="">Select a plan…</option>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>{p.name} — £{p.amount.toFixed(2)}/mo</option>
          ))}
        </select>
      </div>

      <div>
        <label className={label}>Class to enrol them in (optional)</label>
        <select className={input} value={classId} onChange={(e) => setClassId(e.target.value)}>
          <option value="">Don&apos;t auto-enrol</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}{g.day ? ` — ${g.day}` : ''}{g.time ? ` ${g.time}` : ''}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={label}>First charge date *</label>
        <input
          type="date"
          className={`${input} [color-scheme:dark]`}
          value={billedFrom || defaultDate}
          min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
          onChange={(e) => setBilledFrom(e.target.value)}
        />
        <p className="text-[11px] text-white/40 mt-1.5">
          They&apos;re charged £0 today and full price on this date — set it to when their current payment runs out.
        </p>
        {tooFarOut && (
          <p className="text-[11px] text-amber-300 mt-1">That&apos;s more than 100 days out — the server will reject it. Pick a closer date.</p>
        )}
      </div>

      <div className="pt-2 border-t border-white/[0.06]">
        <label className={label}>Shareable link</label>
        {link ? (
          <div className="space-y-2">
            <div className="px-3 py-2.5 rounded-xl bg-black/40 border border-white/[0.08] text-xs text-white/70 break-all font-mono">
              {link}
            </div>
            <button
              onClick={copy}
              className="w-full py-2.5 rounded-xl font-bold text-sm transition-all hover:scale-[1.01] active:scale-[0.99]"
              style={{ backgroundColor: primary, color: '#0a0a0a' }}
            >
              {copied ? 'Copied ✓' : 'Copy link'}
            </button>
          </div>
        ) : (
          <p className="text-xs text-white/30">Select a plan to generate the link.</p>
        )}
      </div>

      <p className="text-[11px] text-white/30 leading-snug">
        Send this to the parent. They sign up, add their card (£0 now), and get access immediately —
        Stripe charges them automatically from the date above.
      </p>
    </div>
  )
}
