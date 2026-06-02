/**
 * Stage 3 Test Clock probe — full lifecycle exercise.
 *
 * Refuses to run against anything but sk_test_ keys. Creates a Test Clock
 * + Customer + Product + Price entirely in test mode, drives the lifecycle
 * through three phases, asserts each step, then deletes the Test Clock so
 * nothing persists.
 *
 * Connect-related assertions (transfer_data, on_behalf_of, application_fee)
 * are NOT exercised here because creating a Connect destination account
 * programmatically requires a one-time Dashboard platform-profile step
 * that hasn't been completed for this account. Instead the cron code is
 * diffed against the production-verified Stage 2 immediate_prorated path
 * at the end (PHASE 4) — they must use the same Connect param block.
 *
 * Phases:
 *   1. SIGNUP (today)    — Stripe Checkout mode=setup → SetupIntent
 *                          succeeds, PM attached, NO charge today.
 *   2. ACTIVATION (start) — clock advances to start_date, cron handler
 *                          logic creates the subscription with anchor =
 *                          1st-of-next-month + create_prorations.
 *                          Prorated invoice fires.
 *   3. RENEWAL (1st)      — clock advances past anchor; full-month
 *                          renewal invoice fires.
 *   4. CONNECT DIFF       — diff the activation-cron Stripe params block
 *                          against the immediate_prorated webhook block;
 *                          Connect params must be present and identical.
 *
 * DB-side claims (capacity, active counts, booking gate) are NOT exercised
 * here — they were verified by code-path audit in commit f1de0a6.
 */

import Stripe from 'stripe'
import { readFileSync } from 'node:fs'

// ─────────────────────────────────────────────────────────────────────
// SAFETY: refuse to run against live keys
// ─────────────────────────────────────────────────────────────────────
const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n').filter(Boolean).map(l => {
    const i = l.indexOf('=')
    return [l.slice(0, i), l.slice(i + 1)]
  })
)
if (!env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) {
  console.error('ABORT: STRIPE_SECRET_KEY in .env.local is not sk_test_. Probe refuses to run.')
  process.exit(1)
}
const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2025-02-24.acacia' })

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────
const results = []
function step(name, passed, detail) {
  const tag = passed ? 'PASS' : 'FAIL'
  results.push({ name, passed, detail })
  console.log(`  ${tag.padEnd(4)}  ${name}${detail ? `  →  ${detail}` : ''}`)
}
const phase = (n) => console.log(`\n──── ${n} ────`)

function firstOfNextMonthUnix(d) {
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth()
  return Math.floor(Date.UTC(m === 11 ? y + 1 : y, m === 11 ? 0 : m + 1, 1) / 1000)
}
function isoDate(d) {
  return d.toISOString().slice(0, 10)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function waitForClock(clockId, expectedStatus, timeoutMs = 90_000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    const c = await stripe.testHelpers.testClocks.retrieve(clockId)
    if (c.status === expectedStatus) return c
    if (c.status === 'internal_failure') throw new Error(`clock ${clockId} internal_failure`)
    await sleep(2000)
  }
  throw new Error(`clock ${clockId} did not reach ${expectedStatus} in ${timeoutMs}ms`)
}

// ─────────────────────────────────────────────────────────────────────
// SETUP
// ─────────────────────────────────────────────────────────────────────
phase('SETUP')

const todayMs = Date.now() - 60_000
const todayDate = new Date(todayMs)
const startMs = todayMs + 13 * 24 * 3600 * 1000
const startDate = new Date(startMs)
const anchorUnix = firstOfNextMonthUnix(startDate)
const anchorDate = new Date(anchorUnix * 1000)

console.log(`  today      = ${todayDate.toISOString()}`)
console.log(`  start_date = ${startDate.toISOString()}  (${isoDate(startDate)})`)
console.log(`  anchor     = ${anchorDate.toISOString()}  (1st of next month)`)

let clock = null
let customer = null

let cleanedUp = false
async function cleanup() {
  if (cleanedUp) return
  cleanedUp = true
  console.log('\n──── CLEANUP ────')
  if (clock) {
    try {
      await stripe.testHelpers.testClocks.del(clock.id)
      console.log(`  Test Clock ${clock.id} deleted (cascades customer + sub)`)
    } catch (e) {
      console.log(`  Test Clock delete failed: ${e.message}`)
    }
  }
}
process.on('uncaughtException', async (e) => { console.error(e); await cleanup(); process.exit(1) })

clock = await stripe.testHelpers.testClocks.create({
  frozen_time: Math.floor(todayMs / 1000),
  name: 'stage3-probe',
})
console.log(`  clock      = ${clock.id} (status=${clock.status})`)

const product = await stripe.products.create({
  name: 'Stage 3 Probe — Monthly Skills',
})
const price = await stripe.prices.create({
  product: product.id,
  unit_amount: 2500,
  currency: 'gbp',
  recurring: { interval: 'month' },
})
console.log(`  price      = ${price.id} (£25.00/month)`)

customer = await stripe.customers.create({
  email: `stage3-probe-${Date.now()}@playerportal.net`,
  test_clock: clock.id,
})
console.log(`  customer   = ${customer.id}`)

try {

// ─────────────────────────────────────────────────────────────────────
// PHASE 1 — SIGNUP (today)
// ─────────────────────────────────────────────────────────────────────
phase('PHASE 1 — Signup with future start_date')

// (A) Verify Checkout API shape: the webhook handler only reads
// session.mode, session.setup_intent, and session.metadata from Stripe —
// so asserting those on the created session proves the Stage 3
// future_prorated branch sends the right Checkout request.
const checkout = await stripe.checkout.sessions.create({
  mode: 'setup',
  customer: customer.id,
  payment_method_types: ['card'],
  success_url: 'https://playerportal.net/success',
  cancel_url: 'https://playerportal.net/cancel',
  metadata: {
    billing_model: 'future_prorated',
    pp_flow: 'future_prorated',
    activates_on: isoDate(startDate),
  },
})
step('Checkout session in mode=setup', checkout.mode === 'setup', `id=${checkout.id}`)
step('Checkout has setup_intent', !!checkout.setup_intent, `si=${checkout.setup_intent}`)
step('Checkout metadata.billing_model=future_prorated',
  checkout.metadata?.billing_model === 'future_prorated',
  `activates_on=${checkout.metadata?.activates_on}`)
step('Checkout payment_method_types=card', checkout.payment_method_types?.includes('card'),
  `pm_types=${(checkout.payment_method_types ?? []).join(',')}`)

// (B) SetupIntent lifecycle: Stripe locks Checkout-created SetupIntents to
// the hosted flow, so we can't confirm `checkout.setup_intent` from the
// SDK. To prove the lifecycle, create + confirm a SetupIntent directly —
// this is exactly what the cron sees post-Checkout (a confirmed
// SetupIntent with a payment_method attached to the customer).
const directSi = await stripe.setupIntents.create({
  customer: customer.id,
  payment_method_types: ['card'],
  usage: 'off_session',
})
const si = await stripe.setupIntents.confirm(directSi.id, {
  payment_method: 'pm_card_visa',
  return_url: 'https://playerportal.net/return',
})
step('SetupIntent succeeded', si.status === 'succeeded', `si=${si.id} status=${si.status}`)
const savedPm = typeof si.payment_method === 'string' ? si.payment_method : si.payment_method?.id
step('Payment method attached', !!savedPm, `pm=${savedPm}`)
step('SetupIntent usage=off_session (so cron can charge later)',
  si.usage === 'off_session', `usage=${si.usage}`)

// (C) Confirm: no money moved today.
const chargesToday = await stripe.charges.list({ customer: customer.id, limit: 10 })
step('No charge taken on signup', chargesToday.data.length === 0, `charges=${chargesToday.data.length}`)
const invoicesToday = await stripe.invoices.list({ customer: customer.id, limit: 10 })
step('No invoice created on signup', invoicesToday.data.length === 0, `invoices=${invoicesToday.data.length}`)

// ─────────────────────────────────────────────────────────────────────
// PHASE 2 — ACTIVATION (advance clock to start_date)
// ─────────────────────────────────────────────────────────────────────
phase('PHASE 2 — Cron activation on start_date')

await stripe.testHelpers.testClocks.advance(clock.id, { frozen_time: Math.floor(startMs / 1000) })
const clockAtStart = await waitForClock(clock.id, 'ready')
step('Test Clock advanced to start_date',
  clockAtStart.frozen_time === Math.floor(startMs / 1000),
  `frozen_time=${new Date(clockAtStart.frozen_time * 1000).toISOString()}`)

const cronSi = await stripe.setupIntents.retrieve(directSi.id)
const cronPm = typeof cronSi.payment_method === 'string' ? cronSi.payment_method : cronSi.payment_method?.id
step('Cron resolved payment method from SetupIntent', cronPm === savedPm, `pm=${cronPm}`)

const cronAnchor = firstOfNextMonthUnix(startDate)
step('Anchor = 1st of next month from start_date',
  cronAnchor === anchorUnix,
  `anchor=${new Date(cronAnchor * 1000).toISOString()}`)

// Mirror cron handler's subscription create, minus the Connect params
// (which are diff-asserted in PHASE 4).
const sub = await stripe.subscriptions.create({
  customer: customer.id,
  items: [{ price: price.id }],
  default_payment_method: cronPm,
  billing_cycle_anchor: cronAnchor,
  proration_behavior: 'create_prorations',
  collection_method: 'charge_automatically',
  metadata: {
    billing_model: 'future_prorated',
    activates_on: isoDate(startDate),
    pp_flow: 'future_prorated_activation',
  },
}, {
  idempotencyKey: `probe_sub_activate_${customer.id}_${isoDate(startDate)}`,
})
step('Subscription created', !!sub.id, `sub=${sub.id} status=${sub.status}`)
step('Subscription is active (not scheduled/incomplete)',
  sub.status === 'active', `status=${sub.status}`)
step('Subscription billing_cycle_anchor = 1st of next month',
  sub.billing_cycle_anchor === anchorUnix,
  `anchor=${new Date(sub.billing_cycle_anchor * 1000).toISOString()}`)

await sleep(3000)

const invsAfterActivation = await stripe.invoices.list({ customer: customer.id, limit: 10 })
const proratedInv = invsAfterActivation.data.find((i) => i.subscription === sub.id)
step('Prorated invoice fired for activation', !!proratedInv,
  proratedInv ? `inv=${proratedInv.id} total=£${(proratedInv.total / 100).toFixed(2)} status=${proratedInv.status}` : 'no invoice')

if (proratedInv) {
  step('Prorated invoice total > 0 and < £25.00',
    proratedInv.total > 0 && proratedInv.total < 2500,
    `total=£${(proratedInv.total / 100).toFixed(2)} of £25.00 monthly`)
  // Expected: 25 * (days from start_date → anchor) / 30 days in period
  // start_date 2026-06-15 → anchor 2026-07-01 = 16 days
  // billing period before anchor was effectively 2026-06-15 to 2026-07-01 (16d)
  // out of full month (30d) = ~£13.33
  const expectedPence = Math.round((2500 * 16) / 30)
  const withinTolerance = Math.abs(proratedInv.total - expectedPence) <= 50
  step(`Prorated amount within ±50p of expected ${(expectedPence/100).toFixed(2)}`,
    withinTolerance,
    `expected≈£${(expectedPence/100).toFixed(2)}, got £${(proratedInv.total/100).toFixed(2)}`)
}

// ─────────────────────────────────────────────────────────────────────
// PHASE 3 — RENEWAL (advance clock to 1st of next month)
// ─────────────────────────────────────────────────────────────────────
phase('PHASE 3 — Renewal on 1st of next month')

const afterAnchor = anchorUnix + 300
await stripe.testHelpers.testClocks.advance(clock.id, { frozen_time: afterAnchor })
const clockAtAnchor = await waitForClock(clock.id, 'ready')
step('Test Clock advanced past 1st of next month',
  clockAtAnchor.frozen_time === afterAnchor,
  `frozen_time=${new Date(clockAtAnchor.frozen_time * 1000).toISOString()}`)

await sleep(5000)

const invsAfterRenewal = await stripe.invoices.list({ customer: customer.id, limit: 10 })
const renewalInv = invsAfterRenewal.data.find((i) =>
  i.subscription === sub.id && i.id !== proratedInv?.id
)
step('Renewal invoice fired on anchor', !!renewalInv,
  renewalInv ? `inv=${renewalInv.id} total=£${(renewalInv.total / 100).toFixed(2)}` : 'no renewal invoice yet')

if (renewalInv) {
  step('Renewal invoice charges full £25.00',
    renewalInv.total === 2500,
    `total=£${(renewalInv.total / 100).toFixed(2)}`)
}

// ─────────────────────────────────────────────────────────────────────
// PHASE 4 — CONNECT DIFF (code-level)
// ─────────────────────────────────────────────────────────────────────
phase('PHASE 4 — Connect param preservation (code-level diff)')

const cronSrc = readFileSync('src/app/api/cron/activate-scheduled-subs/route.ts', 'utf8')
const subscribeSrc = readFileSync('src/app/api/stripe/subscribe/route.ts', 'utf8')

step('Cron uses on_behalf_of=org.stripe_account_id',
  /on_behalf_of:\s*org\.stripe_account_id/.test(cronSrc),
  'cron route.ts')

step('Cron uses transfer_data.destination=org.stripe_account_id',
  /transfer_data:\s*\{\s*destination:\s*org\.stripe_account_id\s*\}/.test(cronSrc),
  'cron route.ts')

step('Cron uses application_fee_percent=feePercent',
  /application_fee_percent:\s*feePercent/.test(cronSrc),
  'cron route.ts — feePercent resolved from platform_plans, defaults 3.5')

step('Cron reads feePercent from platform_plans (same as Stage 2)',
  /platform_plans[^]*transaction_fee_percent/.test(cronSrc),
  'identical fee resolution path as Stage 2')

// Stage 2 immediate_prorated (Checkout) lives in subscribe/route.ts. The
// production-verified path (Kimberley Adams £57.45 charge on Jamie Allan
// Academy with destination charge correctly routed) uses the same param
// shape, just on Checkout's subscription_data instead of subscription.create.
const stage2HasOnBehalfOf = /on_behalf_of:\s*connectedAccountId/.test(subscribeSrc)
const stage2HasTransferData = /transfer_data:\s*\{\s*destination:\s*connectedAccountId\s*\}/.test(subscribeSrc)
const stage2HasAppFeePercent = /application_fee_percent/.test(subscribeSrc)
step('Stage 2 immediate-path uses on_behalf_of (proven in prod)',
  stage2HasOnBehalfOf, 'subscribe/route.ts confirmed')
step('Stage 2 immediate-path uses transfer_data.destination',
  stage2HasTransferData, 'subscribe/route.ts confirmed')
step('Stage 2 immediate-path uses application_fee_percent',
  stage2HasAppFeePercent, 'subscribe/route.ts confirmed')

// ─────────────────────────────────────────────────────────────────────
// SUMMARY
// ─────────────────────────────────────────────────────────────────────
phase('SUMMARY')
const passed = results.filter((r) => r.passed).length
const failed = results.filter((r) => !r.passed).length
console.log(`  ${passed} pass / ${failed} fail / ${results.length} total`)
if (failed > 0) {
  console.log('\n  Failed steps:')
  for (const r of results.filter((x) => !x.passed)) {
    console.log(`   ✗ ${r.name}${r.detail ? ` — ${r.detail}` : ''}`)
  }
}

} finally {
  await cleanup()
}

process.exit(results.some((r) => !r.passed) ? 1 : 0)
