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
const files = walk(join(ROOT, 'src'))
const failures = []
for (const f of files) {
  // Comments don't move money — strip them so history notes can't trip the guard.
  const src = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
  const rel = f.slice(ROOT.length)
  // 1. Stripe calendar-day proration must never be requested for a parent charge.
  if (/proration_behavior:\s*['"]create_prorations['"]/.test(src)) failures.push(`${rel}: uses Stripe create_prorations (calendar-day proration)`)
  // 2. Only the one builder may set a future billing_cycle_anchor on a parent subscription.
  if (/billing_cycle_anchor/.test(src) && !/src\/lib\/billing\/(first-charge|anchor|activate-scheduled-sub)\.ts$/.test(rel) && !/\/\/.*billing_cycle_anchor/.test(src.split('billing_cycle_anchor')[0].split('\n').pop() ?? '')) {
    if (!/src\/lib\/billing\//.test(rel)) failures.push(`${rel}: sets billing_cycle_anchor outside src/lib/billing (route must use sessionsBridgeCheckout)`)
  }
  // 3. The retired start-date flag must not steer money again.
  if (/isStartDateBillingEnabled/.test(src) && !/src\/lib\/billing\/flag\.ts$/.test(rel)) failures.push(`${rel}: references the retired BILLING_FLOW_STARTDATE flag`)
}
if (failures.length) {
  console.error('\n✖ billing invariants violated — build refused:\n' + failures.map((x) => '   ' + x).join('\n') + '\n')
  process.exit(1)
}
console.log('✓ billing invariants hold (' + files.length + ' files)')
