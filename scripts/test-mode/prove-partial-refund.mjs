/**
 * Stripe TEST MODE — prove partial-refund behaviour on a destination charge.
 *
 * Reusable. Builds the whole shape from scratch every run:
 *   1. a connected account standing in for an academy
 *   2. a destination charge on it, with an application fee, exactly as the
 *      platform creates real ones (on_behalf_of + transfer_data.destination
 *      + application_fee_amount)
 *   3. a PARTIAL refund with reverse_transfer + refund_application_fee
 *   4. reads back what Stripe actually did
 *
 * Refuses to run against a live key. Touches no real money and no real family.
 *
 *   node scripts/test-mode/prove-partial-refund.mjs
 */
import Stripe from 'stripe'
import fs from 'node:fs'

// Prefers a dedicated .env.test.local; falls back to .env.local, which on this
// machine already holds a TEST key. Either way the sk_test_ guard below is the
// thing that actually keeps this off real money — the filename is convention,
// the prefix check is enforcement.
function readKey() {
  for (const [file, name] of [
    ['.env.test.local', 'STRIPE_TEST_SECRET_KEY'],
    ['.env.local', 'STRIPE_SECRET_KEY'],
  ]) {
    if (!fs.existsSync(file)) continue
    const line = fs.readFileSync(file, 'utf8').split('\n').find((l) => l.startsWith(name + '='))
    if (!line) continue
    const v = line.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '')
    if (v) return { key: v, from: `${file} (${name})` }
  }
  return { key: '', from: 'nowhere' }
}
const { key: KEY, from: KEY_SOURCE } = readKey()
console.log(`key source: ${KEY_SOURCE}`)

if (!KEY) throw new Error('No Stripe key found in .env.test.local or .env.local')
if (!KEY.startsWith('sk_test_')) {
  throw new Error(`REFUSING TO RUN: key does not start with sk_test_. This script must never touch live money.`)
}
const stripe = new Stripe(KEY)
const p = (n) => `£${(n / 100).toFixed(2)}`
const FEE_RATE = 0.035

console.log('Stripe test mode —', stripe.getApiField('version'), '\n')

// ── 1. a connected account standing in for an academy ────────────────
const acct = await stripe.accounts.create({
  type: 'express',
  country: 'GB',
  email: 'test-academy@example.com',
  capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
  business_type: 'individual',
})
console.log(`connected account : ${acct.id}`)

// Test accounts need capabilities active before they can receive transfers.
// In test mode Stripe lets us mark the account as verified directly.
await stripe.accounts.update(acct.id, {
  business_profile: { url: 'https://example.com', mcc: '8299' },
  individual: {
    first_name: 'Test', last_name: 'Academy',
    dob: { day: 1, month: 1, year: 1990 },
    address: { line1: 'address_full_match', city: 'London', postal_code: 'SW1A 1AA', country: 'GB' },
    email: 'test-academy@example.com', phone: '+447000000000',
  },
  tos_acceptance: { date: Math.floor(Date.now() / 1000), ip: '127.0.0.1' },
})
const ready = await stripe.accounts.retrieve(acct.id)
console.log(`  charges_enabled=${ready.charges_enabled} transfers=${ready.capabilities?.transfers}`)

// ── 2. a destination charge, the same shape the platform creates ─────
const AMOUNT = 9600                        // £96, a real Intensity Membership price
const FEE = Math.round(AMOUNT * FEE_RATE)  // £3.36 at 3.5%
const pi = await stripe.paymentIntents.create({
  amount: AMOUNT,
  currency: 'gbp',
  payment_method: 'pm_card_visa',
  confirm: true,
  automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
  on_behalf_of: acct.id,
  transfer_data: { destination: acct.id },
  application_fee_amount: FEE,
  description: 'TEST — partial refund proof',
})
const charge = await stripe.charges.retrieve(pi.latest_charge)
console.log(`\ncharge            : ${charge.id}  ${p(charge.amount)}  fee ${p(FEE)}`)
const t0 = await stripe.transfers.retrieve(charge.transfer)
const f0 = await stripe.applicationFees.retrieve(charge.application_fee)
console.log(`  transfer        : ${p(t0.amount)}  reversed ${p(t0.amount_reversed)}`)
console.log(`  application fee : ${p(f0.amount)}  refunded ${p(f0.amount_refunded)}`)

// ── 3. a PARTIAL refund — a quarter of it ────────────────────────────
const REFUND = Math.round(AMOUNT / 4)      // £24 of £96
console.log(`\n── refunding ${p(REFUND)} of ${p(AMOUNT)} (25%) ──`)
const refund = await stripe.refunds.create({
  charge: charge.id,
  amount: REFUND,
  reverse_transfer: true,
  refund_application_fee: true,
  reason: 'requested_by_customer',
})

// ── 4. read back what Stripe ACTUALLY did ────────────────────────────
const c1 = await stripe.charges.retrieve(charge.id)
const t1 = await stripe.transfers.retrieve(charge.transfer)
const f1 = await stripe.applicationFees.retrieve(charge.application_fee)
const remaining = c1.amount - c1.amount_refunded

const expectedTransfer = Math.round(t0.amount * (REFUND / AMOUNT))
const expectedFee = Math.round(f0.amount * (REFUND / AMOUNT))

console.log(`\nRESULT`)
console.log(`  refund                    : ${refund.id}  ${p(refund.amount)}  status=${refund.status}`)
console.log(`  transfer amount_reversed  : ${p(t1.amount_reversed)}   expected ~${p(expectedTransfer)}`)
console.log(`  app fee amount_refunded   : ${p(f1.amount_refunded)}   expected ~${p(expectedFee)}`)
console.log(`  charge amount_refunded    : ${p(c1.amount_refunded)}`)
console.log(`  REMAINING REFUNDABLE      : ${p(remaining)}`)
console.log(`  charge.refunded (fully?)  : ${c1.refunded}`)

const okT = Math.abs(t1.amount_reversed - expectedTransfer) <= 1
const okF = Math.abs(f1.amount_refunded - expectedFee) <= 1
console.log(`\nVERDICT`)
console.log(`  transfer reversed proportionally : ${okT ? 'YES' : 'NO — DIFFERS FROM DOCS'}`)
console.log(`  application fee refunded proportionally : ${okF ? 'YES' : 'NO — DIFFERS FROM DOCS'}`)

// ── 5. a second partial, to prove they accumulate ────────────────────
const SECOND = 1200
console.log(`\n── second partial refund of ${p(SECOND)} ──`)
await stripe.refunds.create({ charge: charge.id, amount: SECOND, reverse_transfer: true, refund_application_fee: true })
const c2 = await stripe.charges.retrieve(charge.id)
const t2 = await stripe.transfers.retrieve(charge.transfer)
const f2 = await stripe.applicationFees.retrieve(charge.application_fee)
console.log(`  charge refunded total : ${p(c2.amount_refunded)} of ${p(c2.amount)}`)
console.log(`  transfer reversed     : ${p(t2.amount_reversed)}`)
console.log(`  app fee refunded      : ${p(f2.amount_refunded)}`)
console.log(`  remaining refundable  : ${p(c2.amount - c2.amount_refunded)}`)

// ── 6. over-refund must be refused ───────────────────────────────────
console.log(`\n── attempting to over-refund (${p(c2.amount)} when only ${p(c2.amount - c2.amount_refunded)} remains) ──`)
try {
  await stripe.refunds.create({ charge: charge.id, amount: c2.amount })
  console.log('  *** STRIPE ALLOWED IT — that would be a finding ***')
} catch (e) {
  console.log(`  refused, as it should be: ${e.message}`)
}
console.log(`\ntest account ${acct.id} — delete from the dashboard when you are done.`)
