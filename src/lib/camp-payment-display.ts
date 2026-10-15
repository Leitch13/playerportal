/**
 * Unpaid camp bookings never look paid.
 *
 * A booking stores the camp price in `amount_paid` the moment it is made,
 * before anyone pays, and the register painted it green, so unpaid children
 * looked paid (WLFA, 15 Oct 2026: Levi and Felix, £180, camp on Monday).
 * John: "make sure it never goes away … just an outstanding/red box is perfect."
 *
 * The rule, for every academy:
 *   • an unpaid (pending) booking shows a red box next to the child's name:
 *     "£80.00 outstanding" — on the register, the day check-in list and the
 *     printed register
 *   • only a paid booking shows its amount as money received
 *
 * Guarded by camp-payment-display.test.ts and scripts/check-feature-invariants.mjs.
 */

/** The red box next to an unpaid child's name, or null when nothing is outstanding. */
export function outstanding(status: string | null | undefined, amount: number | string | null | undefined): string | null {
  if (status !== 'pending') return null
  const pounds = Number(amount || 0)
  return pounds > 0 ? `£${pounds.toFixed(2)} outstanding` : 'Not paid'
}

/** Money received: only a paid booking has any. */
export function paidAmount(status: string | null | undefined, amount: number | string | null | undefined): number {
  return status === 'paid' ? Number(amount || 0) : 0
}
