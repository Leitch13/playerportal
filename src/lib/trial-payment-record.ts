/**
 * A paid trial is a payment, so it goes on the academy's Payments page like camps, classes and
 * 1-2-1s. Until 26 Oct 2026 the webhook saved the trial booking and stopped, so all 36 paid trials
 * ever taken were missing from Payments, its search, month totals, Analytics and Exports (John:
 * "why not?" … "build now"). The money itself always reached the academy's Stripe correctly.
 *
 * One row per Stripe Checkout (idempotent on stripe_session_id). The parent is linked when they
 * already have an account at the academy; otherwise their name and email go in the notes.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any

export interface PaidTrialFacts {
  orgId: string; sessionId: string; paymentIntent: string | null; amountPence: number; paidAt: string
  parentEmail: string | null; parentName: string | null; childName: string; classId: string | null; sessionDate: string | null
}

const fmtDay = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })

export function trialPaymentDescription(className: string | null, sessionDate: string | null, childName: string): string {
  return ['Trial', className, sessionDate ? fmtDay(sessionDate) : null, childName].filter(Boolean).join(' · ')
}

export async function recordPaidTrialPayment(db: Db, f: PaidTrialFacts): Promise<'added' | 'already'> {
  const { data: existing } = await db.from('payments').select('id').eq('stripe_session_id', f.sessionId).limit(1)
  if (existing && existing.length) return 'already'
  const [{ data: cls }, { data: parent }] = await Promise.all([
    f.classId ? db.from('training_groups').select('name').eq('id', f.classId).maybeSingle() : Promise.resolve({ data: null }),
    f.parentEmail ? db.from('profiles').select('id').eq('organisation_id', f.orgId).ilike('email', f.parentEmail.trim()).limit(1).maybeSingle() : Promise.resolve({ data: null }),
  ])
  const pounds = f.amountPence / 100
  const day = f.paidAt.slice(0, 10)
  const { error } = await db.from('payments').insert({
    organisation_id: f.orgId, parent_id: (parent as { id?: string } | null)?.id ?? null, player_id: null,
    amount: pounds, amount_paid: pounds, status: 'paid',
    stripe_session_id: f.sessionId, stripe_payment_intent_id: f.paymentIntent,
    description: trialPaymentDescription((cls as { name?: string } | null)?.name ?? null, f.sessionDate, f.childName),
    notes: `Paid trial · parent ${f.parentName || 'not given'}${f.parentEmail ? ` (${f.parentEmail})` : ''}`,
    due_date: day, paid_date: day,
  })
  if (error) throw new Error(`payments.insert (paid trial) failed: ${error.message}`)
  return 'added'
}
