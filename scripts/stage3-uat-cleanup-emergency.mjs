/**
 * Emergency cleanup for stage3-preview-uat.mjs dangling test records.
 *
 * The UAT script left these IDs in production:
 *   enrolment   c30212d6-67c6-4d60-890e-6ca840611183
 *   player      68ffa371-529d-4bd7-94fa-8d21ad508750
 *   profile     b2bb58e4-3afa-4964-b724-7325dad1e48e
 *   auth.user   b2bb58e4-3afa-4964-b724-7325dad1e48e
 *
 * Subscription 8324673e-adba-4faa-b79d-ba9b5fd8c21a was deleted successfully.
 *
 * The original cleanup failed with "column training_group_id does not exist"
 * which strongly implies a trigger on enrolments and players references
 * a column that doesn't exist on those tables. Diagnose, then bypass.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

function parseEnv(content) {
  const out = {}
  for (const raw of content.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 0) continue
    const key = line.slice(0, eq).trim()
    let val = line.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    out[key] = val
  }
  return out
}
const env = parseEnv(readFileSync('/tmp/.env.prod', 'utf8'))

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const ENROL_ID = 'c30212d6-67c6-4d60-890e-6ca840611183'
const PLAYER_ID = '68ffa371-529d-4bd7-94fa-8d21ad508750'
const PROFILE_ID = 'b2bb58e4-3afa-4964-b724-7325dad1e48e'
const AUTH_ID = 'b2bb58e4-3afa-4964-b724-7325dad1e48e'

console.log('═══ Diagnose triggers on enrolments + players ═══')

// Look for any reference to training_group_id in functions/triggers via REST RPC
const triggerProbe = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/pg_get_triggerdef_all`, {
  method: 'POST',
  headers: {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  },
  body: '{}',
})
console.log(`  pg_get_triggerdef_all RPC: ${triggerProbe.status}`)

// Try direct enrolment delete first with verbose error
console.log('\n═══ Attempt: enrolment delete (verbose) ═══')
const enrolDel = await supabase.from('enrolments').delete().eq('id', ENROL_ID).select()
console.log(`  data: ${JSON.stringify(enrolDel.data)} | error: ${enrolDel.error ? enrolDel.error.message + ' | code: ' + enrolDel.error.code + ' | hint: ' + (enrolDel.error.hint || 'n/a') : 'none'}`)

// Diagnose: try selecting enrolment to confirm it still exists
const enrolSel = await supabase.from('enrolments').select('*').eq('id', ENROL_ID).maybeSingle()
console.log(`  enrolment row present: ${!!enrolSel.data}`)
if (enrolSel.data) {
  console.log(`  enrolment row: ${JSON.stringify(enrolSel.data)}`)
}

// Try updating enrolment status to cancelled first — if a status-based trigger
// only fires on pending→active flips, this might dodge it.
console.log('\n═══ Attempt: enrolment status update to cancelled (workaround) ═══')
const enrolUpd = await supabase.from('enrolments').update({ status: 'cancelled' }).eq('id', ENROL_ID).select()
console.log(`  data: ${JSON.stringify(enrolUpd.data)} | error: ${enrolUpd.error ? enrolUpd.error.message : 'none'}`)

// Now try delete again
console.log('\n═══ Attempt: enrolment delete (after status update) ═══')
const enrolDel2 = await supabase.from('enrolments').delete().eq('id', ENROL_ID).select()
console.log(`  data: ${JSON.stringify(enrolDel2.data)} | error: ${enrolDel2.error ? enrolDel2.error.message : 'none'}`)

// Verify
const enrolSel2 = await supabase.from('enrolments').select('id').eq('id', ENROL_ID).maybeSingle()
console.log(`  enrolment row still present: ${!!enrolSel2.data}`)

console.log('\n═══ Attempt: player delete (verbose) ═══')
const plDel = await supabase.from('players').delete().eq('id', PLAYER_ID).select()
console.log(`  data: ${JSON.stringify(plDel.data)} | error: ${plDel.error ? plDel.error.message + ' | code: ' + plDel.error.code : 'none'}`)
const plSel = await supabase.from('players').select('id, first_name, last_name').eq('id', PLAYER_ID).maybeSingle()
console.log(`  player row present: ${!!plSel.data} ${plSel.data ? JSON.stringify(plSel.data) : ''}`)

console.log('\n═══ Attempt: auth.user delete ═══')
const authDel = await supabase.auth.admin.deleteUser(AUTH_ID)
console.log(`  data: ${JSON.stringify(authDel.data)} | error: ${authDel.error ? authDel.error.message : 'none'}`)
const authSel = await supabase.auth.admin.getUserById(AUTH_ID)
console.log(`  auth.user present: ${!!authSel.data?.user}`)

// Cascade through profile via auth deletion
const profSel = await supabase.from('profiles').select('id').eq('id', PROFILE_ID).maybeSingle()
console.log(`  profile row present after auth delete: ${!!profSel.data}`)

console.log('\n═══ FINAL STATE ═══')
for (const [table, id] of [
  ['enrolments', ENROL_ID],
  ['players', PLAYER_ID],
  ['profiles', PROFILE_ID],
]) {
  const { count } = await supabase.from(table).select('id', { count: 'exact', head: true }).eq('id', id)
  console.log(`  ${table}.${id}: ${count} row(s) remaining`)
}
const auFinal = await supabase.auth.admin.getUserById(AUTH_ID)
console.log(`  auth.users.${AUTH_ID}: ${auFinal.data?.user ? 'STILL EXISTS' : 'deleted'}`)
