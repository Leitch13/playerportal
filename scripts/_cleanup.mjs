import Stripe from 'stripe'
import { readFileSync } from 'node:fs'
const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n').filter(Boolean).map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)] }))
const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2025-02-24.acacia' })
const clocks = await stripe.testHelpers.testClocks.list({ limit: 10 })
console.log(`Found ${clocks.data.length} clocks`)
for (const c of clocks.data) {
  try {
    await stripe.testHelpers.testClocks.del(c.id)
    console.log(`  deleted ${c.id} (was: ${c.name})`)
  } catch (e) {
    console.log(`  failed ${c.id}: ${e.message}`)
  }
}
const accts = await stripe.accounts.list({ limit: 20 })
for (const a of accts.data) {
  if (a.email?.startsWith('stage3-probe-')) {
    try {
      await stripe.accounts.del(a.id)
      console.log(`  deleted account ${a.id}`)
    } catch (e) {
      console.log(`  account delete failed ${a.id}: ${e.message}`)
    }
  }
}
