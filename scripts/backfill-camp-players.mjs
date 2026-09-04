#!/usr/bin/env node
/**
 * Backfill camp_bookings.player_id for historical PAID bookings.
 *
 *   node scripts/backfill-camp-players.mjs            # dry run — prints what would happen, writes nothing
 *   node scripts/backfill-camp-players.mjs --apply    # writes links and creates missing players
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from the environment.
 *
 * What it will NOT do, even with --apply
 * --------------------------------------
 *   • Create a parent account. Live bookings do that (src/lib/camp-player-link.ts)
 *     because the parent just paid and is expecting to hear from the academy.
 *     Sending "you now have an account" to 160 families who booked a camp in
 *     June is a different thing, and it is not this script's call to make.
 *     Bookings whose parent has no account are listed under NEEDS ACCOUNT.
 *   • Send any email.
 *   • Touch pending, refunded or cancelled bookings.
 *
 * Duplicate guard is the same as the live path: match on parent + academy +
 * name + date of birth before inserting anything.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const APPLY = process.argv.includes('--apply')
if (!URL || !KEY) { console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'); process.exit(1) }

const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }
const get = async (p) => { const r = await fetch(`${URL}/rest/v1/${p}`, { headers: H }); if (!r.ok) throw new Error(`${p} → ${r.status} ${await r.text()}`); return r.json() }
const post = async (p, body) => { const r = await fetch(`${URL}/rest/v1/${p}`, { method: 'POST', headers: { ...H, Prefer: 'return=representation' }, body: JSON.stringify(body) }); if (!r.ok) throw new Error(`POST ${p} → ${r.status} ${await r.text()}`); return r.json() }
const patch = async (p, body) => { const r = await fetch(`${URL}/rest/v1/${p}`, { method: 'PATCH', headers: H, body: JSON.stringify(body) }); if (!r.ok) throw new Error(`PATCH ${p} → ${r.status} ${await r.text()}`) }

function splitName(childName, parentName) {
  const parts = (childName || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return [parts.slice(0, -1).join(' '), parts[parts.length - 1]]
  const pp = (parentName || '').trim().split(/\s+/).filter(Boolean)
  return [parts[0] || 'Unnamed', pp.length >= 2 ? pp[pp.length - 1] : '']
}

const bookings = await get(`camp_bookings?select=id,organisation_id,parent_name,parent_email,child_name,child_dob,medical_info,photo_consent,created_at&payment_status=eq.paid&player_id=is.null&order=created_at&limit=2000`)
console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} — paid bookings with no player: ${bookings.length}\n`)

const tally = { linkedExisting: 0, wouldCreate: 0, created: 0, needsAccount: 0, placeholder: 0, failed: 0 }
const needsAccount = []
const virtual = new Set() // dry-run only: children the first booking would have created

for (const b of bookings) {
  const email = (b.parent_email || '').trim().toLowerCase()
  if (!email.includes('@')) { tally.failed++; continue }
  if (email.endsWith('@theplayerportal.net')) { tally.placeholder++; continue }

  const profiles = await get(`profiles?select=id&email=ilike.${encodeURIComponent(email)}&limit=1`)
  const parentId = profiles[0]?.id
  if (!parentId) { tally.needsAccount++; needsAccount.push(b); continue }

  const [first, last] = splitName(b.child_name, b.parent_name)
  const cands = await get(`players?select=id,date_of_birth&parent_id=eq.${parentId}&organisation_id=eq.${b.organisation_id}&first_name=ilike.${encodeURIComponent(first)}&last_name=ilike.${encodeURIComponent(last)}&archived_at=is.null&limit=5`)
  let match = cands.find((c) => !b.child_dob || !c.date_of_birth || c.date_of_birth === b.child_dob)

  // Same child under a DIFFERENT parent account at this academy (mum booked
  // the class, dad booked the camp). Exact name + exact DOB. Link, don't
  // duplicate. Mirrors the live path in src/lib/camp-player-link.ts.
  if (!match && b.child_dob) {
    const [other] = await get(`players?select=id,parent_id&organisation_id=eq.${b.organisation_id}&first_name=ilike.${encodeURIComponent(first)}&last_name=ilike.${encodeURIComponent(last)}&date_of_birth=eq.${b.child_dob}&archived_at=is.null&parent_id=neq.${parentId}&limit=1`)
    if (other) { match = other; match._otherParent = true }
  }

  // Dry run only: a repeat camper (same child, several weeks) would be
  // created once by the first booking and linked by the rest. Track that
  // so the numbers reported are the numbers --apply would produce.
  const vbase = `${parentId}|${first.toLowerCase()}|${last.toLowerCase()}|`
  const vkey = vbase + (b.child_dob || '')
  // A booking with no DOB matches a child of that name already created (the
  // live match rule treats a missing DOB on either side as compatible).
  const vhit = virtual.has(vkey) || (!b.child_dob && [...virtual].some((k) => k.startsWith(vbase)))
  if (!match && !APPLY && vhit) match = { id: `(would be created above)`, _virtual: true }

  try {
    if (match) {
      const note = match._otherParent ? '  ← exists under a different parent; linked, not duplicated' : ''
      console.log(`  link     ${b.id}  → existing player ${match.id}  (${b.child_name})${note}`)
      if (APPLY && !match._virtual) await patch(`camp_bookings?id=eq.${b.id}`, { player_id: match.id })
      tally.linkedExisting++
    } else {
      virtual.add(vkey)
      console.log(`  ${APPLY ? 'create  ' : 'WOULD create'} ${b.id}  player "${first} ${last}" dob=${b.child_dob || '—'} under parent ${parentId}`)
      if (APPLY) {
        const consent = b.photo_consent === true || b.photo_consent === false
          ? { photo_consent: b.photo_consent, photo_consent_at: new Date().toISOString(), photo_consent_source: 'camp_booking' }
          : {}
        const [p] = await post('players', { organisation_id: b.organisation_id, parent_id: parentId, first_name: first, last_name: last, date_of_birth: b.child_dob || null, medical_info: b.medical_info || null, playing_level: 'development', ...consent })
        await patch(`camp_bookings?id=eq.${b.id}`, { player_id: p.id })
        tally.created++
      } else tally.wouldCreate++
    }
  } catch (e) { tally.failed++; console.error(`  FAILED   ${b.id}  ${e.message}`) }
}

console.log('\nSUMMARY')
console.log(`  linked to existing player : ${tally.linkedExisting}`)
console.log(`  ${APPLY ? 'players created           ' : 'players that would be created'}: ${APPLY ? tally.created : tally.wouldCreate}`)
console.log(`  parent has no account     : ${tally.needsAccount}   ← not touched; a decision, not a backfill`)
console.log(`  placeholder emails skipped: ${tally.placeholder}`)
console.log(`  failed                    : ${tally.failed}`)
if (needsAccount.length) {
  console.log('\nNEEDS ACCOUNT (booking id, org, booked)')
  for (const b of needsAccount) console.log(`  ${b.id}  ${b.organisation_id.slice(0, 8)}  ${b.created_at.slice(0, 10)}`)
}
