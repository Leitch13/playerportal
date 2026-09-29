'use client'

// The 1-2-1 cancellation policy, ticked before any payment: a one-off booking
// here, and a regular's set-up link on the agree page. Same words for every academy.

import { POLICY_LINES } from '@/lib/one-to-one/policy'

export default function PolicyAccept({ checked, onChange, academy, accent }: { checked: boolean; onChange: (v: boolean) => void; academy: string; accent: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.1] bg-white/[0.03] p-4">
      <h3 className="text-sm font-semibold text-white">Cancellation policy</h3>
      <ul className="mt-2 space-y-1.5 text-[13px] leading-snug text-white/70">
        {POLICY_LINES.map((l) => <li key={l} className="flex gap-2"><span aria-hidden className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-white/40" />{l}</li>)}
      </ul>
      <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-sm font-medium text-white">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0" style={{ accentColor: accent }} />
        <span>I accept {academy}&apos;s cancellation policy</span>
      </label>
    </div>
  )
}
