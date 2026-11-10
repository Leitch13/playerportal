import Link from 'next/link'
import type { UnconfirmedMembership } from '@/lib/parent-unconfirmed'

const gbp = (n: number) => `£${n.toFixed(2)}`

/**
 * "Jacob's membership isn't set up yet": shown at the top of every parent money screen
 * while a membership waits to be confirmed. See src/lib/parent-unconfirmed.ts.
 */
export default function UnconfirmedMembershipCards({ items, className = '' }: { items: UnconfirmedMembership[]; className?: string }) {
  if (!items.length) return null
  return (
    <div className={`space-y-3 ${className}`} data-testid="unconfirmed-memberships">
      {items.map((m) => (
        <div key={m.subId} className="rounded-2xl border border-[#e8a33d]/50 bg-[#2a1d0a] p-4 sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#f2b552]">Not set up yet</p>
          <h2 className="mt-1 text-base sm:text-lg font-bold text-white">{m.childFirstName}&rsquo;s membership isn&rsquo;t set up, so nothing has been paid</h2>
          <p className="mt-1.5 text-sm text-white/75">
            {m.todayAmount > 0
              ? <><span className="font-semibold text-white">{gbp(m.todayAmount)} due now</span> ({m.todayLabel}), then {gbp(m.monthly)} a month from {m.monthlyFrom}.</>
              : <>{m.todayLabel}, then {gbp(m.monthly)} a month.</>}
            {' '}{m.childFirstName}&rsquo;s place isn&rsquo;t confirmed until this is done.
          </p>
          <Link
            href={m.href}
            className="mt-3 inline-flex w-full sm:w-auto items-center justify-center rounded-xl bg-[#f2b552] px-5 py-3 text-sm font-bold text-[#1a1206] hover:opacity-90"
          >
            Set up {m.childFirstName}&rsquo;s membership{m.todayAmount > 0 ? ` and pay ${gbp(m.todayAmount)}` : ''} →
          </Link>
        </div>
      ))}
    </div>
  )
}
