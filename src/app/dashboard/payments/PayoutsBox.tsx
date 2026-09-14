import { describeSchedule, type PayoutSnapshot } from '@/lib/payouts'

// Read-only. Answers two questions an academy owner asks every week:
// "when is the money coming?" and "what came out of it?". Live from the
// academy's own Stripe account. Same box for every academy.

const gbp = (pence: number) =>
  (pence / 100).toLocaleString('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 })

const day = (isoDate: string) =>
  new Date(`${isoDate}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

export default function PayoutsBox({ snapshot }: { snapshot: PayoutSnapshot | null }) {
  if (!snapshot) return null
  const { next, recent, month, schedule } = snapshot
  const onItsWay = snapshot.availablePence + snapshot.pendingPence
  const manual = schedule.interval === 'manual'

  return (
    <section
      aria-label="Payouts"
      className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.05] p-5 backdrop-blur-xl"
    >
      <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none" aria-hidden />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Payouts to your bank</h3>
          <p className="mt-0.5 text-[11px] text-white/45">
            {manual ? 'Payouts go out when you send them from Stripe.' : `Paid ${describeSchedule(schedule)}.`} Live from your Stripe account.
          </p>
        </div>
        <a
          href="https://dashboard.stripe.com/balance/overview"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-[#4ecde6] hover:text-[#7fdcee] whitespace-nowrap"
        >
          Open in Stripe &rarr;
        </a>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Next payout */}
        <div className="rounded-xl border border-white/[0.08] bg-[#0f1a2b] p-4">
          <div className="text-[11px] uppercase tracking-wide text-white/45">Next payout</div>
          {manual ? (
            <>
              <div className="mt-1 text-2xl font-bold text-emerald-300">{gbp(snapshot.availablePence)}</div>
              <div className="mt-0.5 text-xs text-white/60">Ready to send to your bank from Stripe</div>
              {snapshot.pendingPence > 0 && (
                <div className="mt-2 text-[11px] text-white/40">Plus {gbp(snapshot.pendingPence)} still settling</div>
              )}
            </>
          ) : next ? (
            <>
              <div className="mt-1 text-2xl font-bold text-emerald-300">{gbp(next.amountPence)}</div>
              <div className="mt-0.5 text-xs text-white/60">
                {next.status === 'in_transit' ? 'On its way, arrives ' : 'Expected '}
                {day(next.arrivalDate)}
              </div>
            </>
          ) : onItsWay > 0 ? (
            <>
              <div className="mt-1 text-2xl font-bold text-emerald-300">{gbp(onItsWay)}</div>
              <div className="mt-0.5 text-xs text-white/60">
                In the {schedule.delayDays || 0}-day settlement wait, then it goes out
              </div>
            </>
          ) : (
            <>
              <div className="mt-1 text-2xl font-bold text-white/70">{gbp(0)}</div>
              <div className="mt-0.5 text-xs text-white/60">Nothing waiting to go out</div>
            </>
          )}
          {!manual && next && onItsWay > 0 && (
            <div className="mt-2 text-[11px] text-white/40">Plus {gbp(onItsWay)} still settling</div>
          )}
        </div>

        {/* Recent */}
        <div className="rounded-xl border border-white/[0.08] bg-[#0f1a2b] p-4">
          <div className="text-[11px] uppercase tracking-wide text-white/45">Landed recently</div>
          {recent.length === 0 ? (
            <div className="mt-2 text-xs text-white/50">No payouts yet</div>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {recent.map((r) => (
                <li key={r.id} className="flex items-center justify-between text-xs">
                  <span className="text-white/60">{day(r.arrivalDate)}</span>
                  <span className="font-semibold text-white tabular-nums">{gbp(r.amountPence)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* This month */}
        <div className="rounded-xl border border-white/[0.08] bg-[#0f1a2b] p-4">
          <div className="text-[11px] uppercase tracking-wide text-white/45">{month.label} so far</div>
          <dl className="mt-2 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <dt className="text-white/60">Taken, {month.count} payment{month.count === 1 ? '' : 's'}</dt>
              <dd className="font-semibold text-white tabular-nums">{gbp(month.grossPence)}</dd>
            </div>
            {month.stripeFeePence > 0 && (
              <div className="flex justify-between">
                <dt className="text-white/60">Card processing</dt>
                <dd className="text-white/80 tabular-nums">&minus;{gbp(month.stripeFeePence)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-white/60">Player Portal, 3.5% incl. card fees</dt>
              <dd className="text-white/80 tabular-nums">&minus;{gbp(month.platformFeePence)}</dd>
            </div>
            {month.refundedPence > 0 && (
              <div className="flex justify-between">
                <dt className="text-white/60">Refunded</dt>
                <dd className="text-white/80 tabular-nums">&minus;{gbp(month.refundedPence)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-white/[0.08] pt-1.5">
              <dt className="text-white/80">To your bank</dt>
              <dd className="font-semibold text-emerald-300 tabular-nums">{gbp(month.netPence)}</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  )
}
