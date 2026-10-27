'use client'

import { useState } from 'react'

/**
 * "Have a discount code?" box, the same on every page where a parent pays: sign-up, the
 * membership page, quick book, the invite page and paid trials (camps have their own, older box).
 * Checks the code with /api/promo/validate (read-only) and hands the code to the page, which sends
 * it with the payment. The server checks it again before taking any money.
 */
export type CodeContext = 'subscription' | 'trial' | 'one_off'

export interface AppliedCode { code: string; discount_type: 'percentage' | 'fixed'; discount_value: number }

const DURATION_TEXT: Record<CodeContext, string> = {
  subscription: 'off your monthly payments from the 1st',
  trial: 'off the trial',
  one_off: 'off',
}

export function codeLabel(c: AppliedCode, context: CodeContext): string {
  const amt = c.discount_type === 'percentage' ? `${c.discount_value}%` : `£${(c.discount_value / 100).toFixed(2)}`
  return `${c.code}: ${amt} ${DURATION_TEXT[context]}`
}

export default function DiscountCodeBox({
  slug, orgId, planId, groupId, context, onChange, accent = '#4ecde6', dark = true,
}: {
  slug?: string
  orgId?: string
  planId?: string
  groupId?: string
  context: CodeContext
  onChange: (code: AppliedCode | null) => void
  accent?: string
  dark?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [applied, setApplied] = useState<AppliedCode | null>(null)
  const [msg, setMsg] = useState('')
  const [checking, setChecking] = useState(false)

  const text = dark ? 'text-white/60' : 'text-gray-600'
  const field = dark ? 'bg-[#1a1a1a] border-[#2a2a2a] text-white placeholder:text-white/30' : 'bg-white border-gray-300 text-gray-900'

  async function apply() {
    const code = input.trim()
    if (!code) return
    setChecking(true); setMsg('')
    try {
      const res = await fetch('/api/promo/validate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, context, slug, orgId, planId, groupId }) })
      const d = await res.json()
      if (d.valid) {
        const c = { code: d.code, discount_type: d.discount_type, discount_value: Number(d.discount_value) }
        setApplied(c); onChange(c)
      } else { setApplied(null); onChange(null); setMsg(d.reason || 'That code isn’t valid') }
    } catch { setMsg('Couldn’t check that code. Try again.') }
    setChecking(false)
  }

  function remove() { setApplied(null); setInput(''); setMsg(''); onChange(null) }

  if (applied) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm" style={{ background: `${accent}18`, border: `1px solid ${accent}55` }} data-testid="discount-code-applied">
        <span className={dark ? 'text-white' : 'text-gray-900'}>✓ {codeLabel(applied, context)}</span>
        <button type="button" onClick={remove} className={`text-xs underline ${text}`}>Remove</button>
      </div>
    )
  }
  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} className={`text-sm underline ${text}`} data-testid="discount-code-open">Have a discount code?</button>
  }
  return (
    <div>
      <div className="flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value.toUpperCase())} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); apply() } }}
          placeholder="Discount code" autoCapitalize="characters" className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-mono uppercase ${field}`} data-testid="discount-code-input" />
        <button type="button" onClick={apply} disabled={checking || !input.trim()} className="rounded-xl px-4 text-sm font-bold disabled:opacity-50" style={{ background: accent, color: '#06222b' }}>
          {checking ? 'Checking…' : 'Apply'}
        </button>
      </div>
      {msg && <p className="mt-1.5 text-xs text-red-400">{msg}</p>}
    </div>
  )
}
