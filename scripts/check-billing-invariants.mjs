#!/usr/bin/env node
// Refuses to build if the per-session first-charge rule can be bypassed.
// Runs as `prebuild`. See src/lib/billing/sessions.ts firstChargeFor().
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f); const st = statSync(p)
  if (st.isDirectory()) return f === 'node_modules' || f === '.next' ? [] : walk(p)
  return /\.(ts|tsx)$/.test(f) && !/\.test\.ts$/.test(f) ? [p] : []
})
const files = [...walk(join(ROOT, 'src')), ...walk(join(ROOT, 'scripts')).filter((f) => !f.endsWith('check-billing-invariants.mjs'))]
const failures = []
// Anything on this list once made one academy bill differently from another. None may return.
const FORBIDDEN = [
  ['create_prorations', 'Stripe calendar-day proration'],
  ['ENABLED_ORG_IDS', 'per-academy billing allowlist'],
  ['isStartDateBillingEnabled', 'retired start-date flag'],
  ['BILLING_FLOW_STARTDATE', 'retired start-date flag'],
  ['BILLING_FUTURE_START', 'retired future-start flag'],
  ['BILLING_BRIDGE_MODE_KILL', 'retired bridge-mode kill switch'],
  ['allowFutureStart', 'per-academy start-date picker switch'],
  ['bridge_billing_mode', 'per-academy bridge mode'],
  ['future_prorated', 'card-saved-charge-later variant'],
  ['future_session_bridge', 'second bridge formula'],
  ['estimateBridgePence', 'second bridge formula'],
]
for (const f of files) {
  // Comments don't move money — strip them so history notes can't trip the guard.
  const src = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
  const rel = f.slice(ROOT.length)
  for (const [token, why] of FORBIDDEN) if (src.includes(token)) failures.push(`${rel}: ${why} (${token})`)
  // The quarterly gate reads the academy's own toggle and nothing else.
  if (/quarterly-billing\.ts$/.test(rel) && /process\.env/.test(src)) failures.push(`${rel}: quarterly gate reads an environment switch`)
  // 2. Only the one builder may set a future billing_cycle_anchor on a parent subscription.
  if (/billing_cycle_anchor/.test(src) && !/src\/lib\/billing\/(first-charge|anchor|activate-scheduled-sub)\.ts$/.test(rel) && !/\/\/.*billing_cycle_anchor/.test(src.split('billing_cycle_anchor')[0].split('\n').pop() ?? '')) {
    if (!/src\/lib\/billing\//.test(rel)) failures.push(`${rel}: sets billing_cycle_anchor outside src/lib/billing (route must use sessionsBridgeCheckout)`)
  }
}
if (failures.length) {
  console.error('\n✖ billing invariants violated — build refused:\n' + failures.map((x) => '   ' + x).join('\n') + '\n')
  process.exit(1)
}
console.log('✓ billing invariants hold (' + files.length + ' files)')
