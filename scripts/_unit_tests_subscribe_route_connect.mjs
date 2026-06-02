/**
 * Regression test for /api/stripe/subscribe Connect-routing branding.
 *
 * Background: every Stripe Checkout session we open MUST attribute itself to
 * the academy's Connect account, otherwise Stripe falls back to rendering
 * the platform account's `business_profile.name` on the Checkout page,
 * mandate copy, and receipt. (Real-world breakage: SetupIntent-mode
 * Checkouts for Stage 3 future-start signups were branded with the platform
 * account's legacy name "Gold and Gray Soccer Academy ltd" because the
 * useFutureProrated branch omitted setup_intent_data.on_behalf_of.)
 *
 * This test scans subscribe/route.ts for every Checkout.SessionCreateParams
 * block and asserts that each block sets `on_behalf_of` at one of the four
 * allowed positions:
 *   - setup_intent_data.on_behalf_of  (SetupIntent / setup mode)
 *   - payment_intent_data.on_behalf_of (one-off payment mode)
 *   - subscription_data.on_behalf_of  (subscription mode)
 *
 * A passing scan means: at least one Stripe API parameter actually attributes
 * the session to the Connect account. If any block omits it, this test
 * fails and the deploy should be blocked.
 *
 * Pure source-level analysis — no Stripe API calls, no DB, no fixtures.
 * Catches drift on every CI run.
 */

import fs from 'node:fs'
import path from 'node:path'

const ROUTE_PATH = path.join(
  process.cwd(),
  'src/app/api/stripe/subscribe/route.ts',
)

const src = fs.readFileSync(ROUTE_PATH, 'utf8')

// Pull every `SessionCreateParams` block. The route declares them like:
//   const sessionBridgeParams: Stripe.Checkout.SessionCreateParams = { ... }
//   const setupParams: Stripe.Checkout.SessionCreateParams = { ... }
//   etc.
// We extract from the `=` after `SessionCreateParams` through to the matching
// closing brace (counting braces).
function extractParamsBlocks(text) {
  const blocks = []
  const decl = /(\w+):\s*Stripe\.Checkout\.SessionCreateParams\s*=\s*\{/g
  let m
  while ((m = decl.exec(text)) !== null) {
    const name = m[1]
    const openBraceIdx = text.indexOf('{', m.index + m[0].length - 1)
    let depth = 0
    let i = openBraceIdx
    for (; i < text.length; i++) {
      const ch = text[i]
      if (ch === '{') depth++
      else if (ch === '}') {
        depth--
        if (depth === 0) break
      }
    }
    blocks.push({ name, body: text.slice(openBraceIdx, i + 1) })
  }
  return blocks
}

// Also extract `stripe.checkout.sessions.create({ ... })` calls that pass
// an inline object literal (not a pre-built params var). The route doesn't
// currently do this for Connect-routed sessions, but if a future edit
// introduces one, we want to catch it.
function extractInlineCreateCalls(text) {
  const blocks = []
  const sig = /stripe\.checkout\.sessions\.create\(\s*\{/g
  let m
  while ((m = sig.exec(text)) !== null) {
    const openBraceIdx = text.indexOf('{', m.index + m[0].length - 1)
    let depth = 0
    let i = openBraceIdx
    for (; i < text.length; i++) {
      const ch = text[i]
      if (ch === '{') depth++
      else if (ch === '}') {
        depth--
        if (depth === 0) break
      }
    }
    blocks.push({ name: 'inline-create', body: text.slice(openBraceIdx, i + 1) })
  }
  return blocks
}

const paramsBlocks = extractParamsBlocks(src)
const inlineBlocks = extractInlineCreateCalls(src)
const blocks = [...paramsBlocks, ...inlineBlocks]

const results = []
function eq(name, got, want) {
  const pass = got === want
  results.push({ name, pass, got, want })
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`)
}

console.log('\n──── PHASE 1 — discovered checkout param blocks ────')
console.log(`  Found ${blocks.length} checkout param block(s):`)
for (const b of blocks) console.log(`   • ${b.name}`)

eq('At least 3 param blocks discovered (sanity check)', blocks.length >= 3, true)

console.log('\n──── PHASE 2 — every block sets on_behalf_of somewhere ────')

const OBO_POSITIONS = [
  /setup_intent_data:\s*\{[^}]*on_behalf_of/s,
  /payment_intent_data:\s*\{[^}]*on_behalf_of/s,
  /subscription_data:\s*\{[^}]*on_behalf_of/s,
  // Defensive: allow top-level on_behalf_of just in case Stripe adds it later.
  /^\s*on_behalf_of\s*:/m,
]

for (const b of blocks) {
  // Quarterly is mode='payment' for a one-time charge — it uses
  // payment_intent_data.on_behalf_of via the same pattern but the actual
  // assignment lives after the params declaration (mutation). Detect that
  // pattern too.
  const hasInBody = OBO_POSITIONS.some((r) => r.test(b.body))
  let hasAfter = false
  if (!hasInBody && b.name !== 'inline-create') {
    // Look for `<paramsName>.payment_intent_data = { ... on_behalf_of ... }`
    // or `<paramsName>.subscription_data = { ... on_behalf_of ... }` mutations
    // anywhere after the block in the source.
    const blockEnd = src.indexOf(b.body) + b.body.length
    const tail = src.slice(blockEnd)
    const mutPattern = new RegExp(
      `${b.name}\\.(payment_intent_data|subscription_data|setup_intent_data)\\s*=\\s*\\{[^}]*on_behalf_of`,
      's',
    )
    hasAfter = mutPattern.test(tail)
  }
  eq(`Block "${b.name}" attributes session to Connect account`, hasInBody || hasAfter, true)
}

console.log('\n──── PHASE 3 — useFutureProrated specifically (the regression) ────')
const setupBlock = blocks.find((b) => b.name === 'setupParams')
eq(
  'setupParams block exists (Stage 3 future-prorated path is reachable)',
  !!setupBlock,
  true,
)
if (setupBlock) {
  eq(
    'setupParams.setup_intent_data sets on_behalf_of',
    /setup_intent_data:\s*\{[^}]*on_behalf_of/s.test(setupBlock.body),
    true,
  )
}

console.log('\n──── PHASE 4 — Connect attribution is always conditional ────')
// We want `on_behalf_of` to be tied to `connectedAccountId` truthiness so
// the route doesn't crash for academies that haven't connected Stripe yet.
// (The route also has a safety gate that rejects un-connected academies
// with a 503 earlier, but the on_behalf_of usage should still be guarded.)
const unconditionalUsage = /on_behalf_of:\s*[^c]/g
const matches = [...src.matchAll(/on_behalf_of:\s*(\w+)/g)].map((m) => m[1])
const allConditioned = matches.every((v) => v === 'connectedAccountId')
eq(
  `Every on_behalf_of reference uses connectedAccountId (found: ${matches.join(', ')})`,
  allConditioned,
  true,
)
// suppress unused-var warning
void unconditionalUsage

console.log('\n──── SUMMARY ────')
const passed = results.filter((r) => r.pass).length
const failed = results.filter((r) => !r.pass).length
console.log(`  ${passed} pass / ${failed} fail / ${results.length} total`)
if (failed > 0) {
  console.log('\n  Failed:')
  for (const r of results.filter((x) => !x.pass)) {
    console.log(`   ✗ ${r.name}`)
  }
}
process.exit(failed > 0 ? 1 : 0)
