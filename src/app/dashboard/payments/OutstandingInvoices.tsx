import Link from 'next/link'

// ─── Parent-facing outstanding invoices ─────────────────────────────────────
//
// Lists one-off invoices the parent still owes, each linking to the public
// /pay/[id] page (the same proven flow the emailed payment-request links use
// — Connect-routed checkout, settled-refusal, webhook reconciliation). This
// component performs no queries and no mutations: the parent payments page
// already loads these rows; it only renders the billable subset it's given.
//
// Renders nothing when there's nothing to pay, so the vast majority of
// parents never see it.

export interface OutstandingRow {
  id: string
  description: string | null
  amount: number
  amount_paid: number
  status: string
  due_date: string | null
  childName: string | null
}

/** Filter helper — the page passes its already-loaded payments through this. */
export function toOutstandingRows(
  payments: Array<{
    id: string
    description?: string | null
    amount: number | string
    amount_paid?: number | string | null
    status: string
    due_date?: string | null
    player?: { first_name?: string; last_name?: string | null } | null
  }>
): OutstandingRow[] {
  return payments
    .filter(
      (p) =>
        (p.status === 'unpaid' || p.status === 'partial' || p.status === 'overdue') &&
        Number(p.amount) - Number(p.amount_paid || 0) > 0
    )
    .map((p) => ({
      id: p.id,
      description: p.description || null,
      amount: Number(p.amount),
      amount_paid: Number(p.amount_paid || 0),
      status: p.status,
      due_date: p.due_date || null,
      childName: p.player
        ? `${p.player.first_name || ''} ${p.player.last_name || ''}`.trim() || null
        : null,
    }))
}

export default function OutstandingInvoices({ rows }: { rows: OutstandingRow[] }) {
  if (rows.length === 0) return null

  const fmt = (n: number) => `£${n.toFixed(2)}`

  return (
    <div
      className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-5"
      data-testid="outstanding-invoices"
    >
      <p className="mb-1 text-xs font-medium uppercase tracking-wider text-amber-400">
        Payment requested
      </p>
      <p className="mb-4 text-sm text-white/60">
        Your academy has asked for the following payment{rows.length === 1 ? '' : 's'}. Paying takes
        about 30 seconds.
      </p>
      <ul className="space-y-3">
        {rows.map((r) => {
          const remaining = Math.round((r.amount - r.amount_paid) * 100) / 100
          return (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 p-4"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-white">
                  {r.description || 'Amount due'}
                </p>
                <p className="mt-0.5 text-xs text-white/50">
                  {r.childName ? `${r.childName} · ` : ''}
                  {r.due_date
                    ? `Due ${new Date(`${r.due_date}T00:00:00`).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}`
                    : 'Due now'}
                  {r.status === 'partial' ? ` · ${fmt(r.amount_paid)} already paid` : ''}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-base font-bold tabular-nums text-white">
                  {fmt(remaining)}
                </span>
                <Link
                  href={`/pay/${r.id}`}
                  className="rounded-lg bg-[#4ecde6] px-4 py-2 text-sm font-semibold text-[#06222a] transition hover:opacity-90"
                >
                  Pay now →
                </Link>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
