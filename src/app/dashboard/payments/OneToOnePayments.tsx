import Link from 'next/link'
import { STATUS_LABEL, type OneToOneMoneyRow, type OneToOneMoneyStatus } from '@/lib/one-to-one/money-report'

/**
 * 1-2-1 payments on the Payments page (No.1, 19 Oct 2026: 1-2-1 money was in no list).
 * Shown only when the academy has any. Changes to a family's 1-2-1s are made under
 * 1-2-1s → Regulars, so each row links there.
 */
const TONE: Record<OneToOneMoneyStatus, string> = {
  paid: 'text-[#4ecde6]', paid_cash: 'text-[#4ecde6]', covered: 'text-white/60', refunded: 'text-white/60',
  waiting: 'rounded-md border border-[#6b2433] bg-[#3a1620] px-2 py-0.5 text-[#ff6b6b]', failed: 'rounded-md border border-[#6b2433] bg-[#3a1620] px-2 py-0.5 text-[#ff6b6b]',
}
const gbp = (p: number) => `£${(p / 100).toFixed(2)}`
const day = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

export default function OneToOnePayments({ rows, waitingPence, waitingCount, failedPence, failedCount, monthLabel, searching }: {
  rows: OneToOneMoneyRow[]; waitingPence: number; waitingCount: number; failedPence: number; failedCount: number; monthLabel: string | null; searching: string | null
}) {
  if (!rows.length && !waitingCount && !failedCount) return null
  const paidHere = rows.filter((r) => r.status === 'paid' || r.status === 'paid_cash').reduce((a, r) => a + r.amountPence, 0)
  return (
    <div className="rounded-[15px] border border-[#1d2c42] bg-[#0f1a2b] p-5" data-testid="one-to-one-payments">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-base font-bold">1-2-1 payments</h3>
          <p className="text-xs text-white/55">{searching ? `Matching "${searching}"` : monthLabel || 'All months'} · {gbp(paidHere)} paid</p>
        </div>
        <Link href="/dashboard/one-to-one/regulars" className="text-xs font-semibold text-[#4ecde6] hover:underline">Change a family&apos;s 1-2-1s in Regulars →</Link>
      </div>
      {(waitingCount > 0 || failedCount > 0) && (
        <div className="mb-3 rounded-lg border border-[#6b2433] bg-[#3a1620] px-3 py-2 text-sm text-[#ff6b6b]">
          {waitingCount > 0 && <span className="font-semibold">{gbp(waitingPence)} waiting to be paid ({waitingCount} {waitingCount === 1 ? 'family month' : 'family months'})</span>}
          {waitingCount > 0 && failedCount > 0 && ' · '}
          {failedCount > 0 && <span className="font-semibold">{gbp(failedPence)} card failed ({failedCount})</span>}
          <span className="text-[#ff6b6b]/80"> · all months. Send set-up links from <Link href="/dashboard/one-to-one" className="underline">1-2-1s → Needs you</Link>.</span>
        </div>
      )}
      {rows.length === 0 ? (
        <p className="text-sm text-white/55">No 1-2-1 payments {searching ? 'for this search' : 'this month'}.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.08] text-[11px] uppercase tracking-wider text-white/45">
                <th className="py-2.5 text-left font-semibold">Parent</th>
                <th className="py-2.5 text-left font-semibold">Child</th>
                <th className="hidden py-2.5 text-left font-semibold md:table-cell">What</th>
                <th className="py-2.5 text-right font-semibold">Amount</th>
                <th className="hidden py-2.5 text-left font-semibold md:table-cell">Date</th>
                <th className="py-2.5 text-left font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-white/[0.08] last:border-0">
                  <td className="py-2.5">
                    {r.parentId ? <Link href={`/dashboard/parents/${r.parentId}`} className="font-medium hover:text-[#4ecde6]">{r.parentName}</Link> : <span className="font-medium">{r.parentName}</span>}
                    {r.email && <div className="hidden text-xs text-white/60 md:block">{r.email}</div>}
                  </td>
                  <td className="py-2.5">{r.children}</td>
                  <td className="hidden py-2.5 text-white/60 md:table-cell">{r.what}</td>
                  <td className="py-2.5 text-right font-medium tabular-nums">{gbp(r.amountPence)}</td>
                  <td className="hidden py-2.5 text-white/60 md:table-cell">{r.status === 'waiting' || r.status === 'failed' ? `for ${new Date(`${r.date}T12:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })}` : day(r.date)}</td>
                  <td className="py-2.5"><span className={`whitespace-nowrap text-xs font-semibold ${TONE[r.status]}`}>{STATUS_LABEL[r.status]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
