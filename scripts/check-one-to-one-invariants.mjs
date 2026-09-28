#!/usr/bin/env node
// Runs before every build. Fails it if the 1-2-1 month roll can go back to
// "one refused row = nothing created for the whole academy", or if new slots
// stop going through the seat rule. Broke on 28 Sep 2026 — see
// src/lib/one-to-one/seats.ts and insertRollRows() in src/lib/one-to-one/db.ts.
import { readFileSync } from 'node:fs'

const fail = []
const db = readFileSync('src/lib/one-to-one/db.ts', 'utf8')
if (!/export async function insertRollRows\(/.test(db)) fail.push('src/lib/one-to-one/db.ts lost insertRollRows() (the one-row-at-a-time fallback)')
if (!/return insertRollRows\(/.test(db)) fail.push('rollMonth() no longer inserts through insertRollRows()')
if (/23505'\)\s*return\s*\{\s*created:\s*0/.test(db)) fail.push('rollMonth() treats a refused row as "created: 0" for the whole month again')
const route = readFileSync('src/app/api/one-to-one/admin/route.ts', 'utf8')
if (!/seatForNewSlot\(/.test(route)) fail.push('slot.create no longer uses seatForNewSlot() — 2-to-1 pairs would break the roll')
const cron = readFileSync('src/app/api/cron/one-to-one-roll/route.ts', 'utf8')
if (!/problems\.length/.test(cron) || !/sendEmail\(/.test(cron)) fail.push('the monthly roll cron no longer emails when dates could not be created')

if (fail.length) {
  console.error('\n✖ 1-2-1 invariants broken:\n')
  for (const f of fail) console.error('  • ' + f)
  console.error('')
  process.exit(1)
}
console.log('✓ 1-2-1 invariants ok (seats, roll never all-or-nothing, roll failures emailed)')
