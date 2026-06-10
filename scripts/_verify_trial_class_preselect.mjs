#!/usr/bin/env node
/**
 * Verify class-specific trial preselection.
 *
 * Steps:
 *   1. Generic /trial/quick page renders, no <option ... selected>
 *   2. Class detail page Free Trial CTA href contains ?class=<groupId>
 *   3. /trial/quick?class=<groupId> renders, dropdown's selected option = groupId
 *   4. /trial/quick?class=<bad-uuid> renders, no <option selected>, no error
 *   5. Anon INSERT into trial_bookings with group_id=<groupId> succeeds
 *   6. Verify the row's group_id matches
 *   7. Service-role DELETE the test row, confirm count=0 after
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const BASE = 'https://theplayerportal.net'
const SLUG = 'jamie-allan-football-academy'
const BAD = '00000000-0000-0000-0000-000000000000'

const anon = createClient(SUPABASE_URL, ANON_KEY)
const svc  = createClient(SUPABASE_URL, SERVICE_KEY)

function fail(msg) { console.error('FAIL:', msg); process.exit(2) }
function pass(msg) { console.log('PASS:', msg) }

// --- discover a valid groupId for Jamie's org ---
const { data: org } = await svc
  .from('organisations')
  .select('id, name')
  .ilike('slug', SLUG)
  .single()
if (!org) fail(`org not found for slug ${SLUG}`)
console.log(`Org: ${org.name} (${org.id})`)

const { data: groups } = await svc
  .from('training_groups')
  .select('id, name, day_of_week, time_slot')
  .eq('organisation_id', org.id)
  .order('name')
if (!groups?.length) fail('no training_groups found for org')

const GROUP = groups[0]
console.log(`Test group: "${GROUP.name}" (${GROUP.id}) — ${GROUP.day_of_week || '?'} ${GROUP.time_slot || '?'}`)
console.log(`Total groups available: ${groups.length}`)
console.log()

// --- helper ---
async function fetchHtml(url) {
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) fail(`${url} returned ${res.status}`)
  return await res.text()
}

function selectedOptionValue(html, dropdownNeedle) {
  // Find the <select> block containing the dropdown needle, then find the
  // option with the `selected` attribute inside it.
  const selectMatch = html.match(/<select[^>]*>[\s\S]*?<\/select>/g) || []
  for (const block of selectMatch) {
    if (!block.includes(dropdownNeedle)) continue
    const m = block.match(/<option\s+[^>]*selected[^>]*value="([^"]+)"/) ||
              block.match(/<option\s+value="([^"]+)"[^>]*selected/)
    if (m) return m[1]
    return null
  }
  return undefined
}

// === CHECK 1: generic /trial/quick — no preselection ===
{
  const url = `${BASE}/book/${SLUG}/trial/quick`
  const html = await fetchHtml(url)
  if (!html.includes('Book a Free Trial')) fail(`generic page didn't render header (${url})`)
  // The dropdown contains the group names — find the select that has GROUP.name
  // as an option text, then check selected.
  const sel = selectedOptionValue(html, GROUP.name)
  if (sel === undefined) fail('could not locate class dropdown on generic page')
  if (sel !== null) fail(`generic page UNEXPECTEDLY preselected option value=${sel}`)
  pass(`CHECK 1: generic /trial/quick — no preselection (selected option absent in <select>)`)
}

// === CHECK 2: class detail page — Free Trial CTA includes ?class=<groupId> ===
{
  const url = `${BASE}/book/${SLUG}/class/${GROUP.id}`
  const html = await fetchHtml(url)
  const want = `/book/${SLUG}/trial/quick?class=${GROUP.id}`
  if (!html.includes(want)) fail(`class detail page does NOT contain expected href "${want}"`)
  // Also confirm we DIDN'T leave the old bare href as the trial CTA
  const trialCtaPattern = new RegExp(`href="\\/book\\/${SLUG}\\/trial\\/quick"[^>]*>[^<]*Try a Free Session`)
  if (trialCtaPattern.test(html)) fail('class detail page still has a bare /trial/quick CTA — change did not deploy')
  pass(`CHECK 2: class detail page — Free Trial CTA → "${want}"`)
}

// === CHECK 3: /trial/quick?class=<groupId> — preselection ===
{
  const url = `${BASE}/book/${SLUG}/trial/quick?class=${GROUP.id}`
  const html = await fetchHtml(url)
  const sel = selectedOptionValue(html, GROUP.name)
  if (sel === undefined) fail('could not locate class dropdown on preselected page')
  if (sel !== GROUP.id) fail(`expected preselected value=${GROUP.id} but got ${sel}`)
  pass(`CHECK 3: /trial/quick?class=${GROUP.id} — preselected option value=${GROUP.id} ("${GROUP.name}")`)
}

// === CHECK 3b: dropdown remains editable (no disabled / readonly) ===
{
  const url = `${BASE}/book/${SLUG}/trial/quick?class=${GROUP.id}`
  const html = await fetchHtml(url)
  // Locate the <select> that contains our group name and assert no disabled/readonly on it
  const selectMatch = (html.match(/<select[^>]*>[\s\S]*?<\/select>/g) || []).find(b => b.includes(GROUP.name))
  if (!selectMatch) fail('dropdown not found for editability check')
  const tagHead = selectMatch.match(/<select[^>]*>/)[0]
  if (/\sdisabled\b/.test(tagHead) || /\sreadonly\b/.test(tagHead)) {
    fail(`dropdown <select> has disabled/readonly: ${tagHead}`)
  }
  pass(`CHECK 3b: dropdown remains editable (no disabled/readonly on <select>)`)
}

// === CHECK 4: /trial/quick?class=<bad-uuid> — graceful fallback ===
{
  const url = `${BASE}/book/${SLUG}/trial/quick?class=${BAD}`
  const res = await fetch(url, { redirect: 'follow' })
  if (res.status !== 200) fail(`bad-class URL returned ${res.status} (expected 200)`)
  const html = await res.text()
  if (!html.includes('Book a Free Trial')) fail('bad-class page did not render')
  const sel = selectedOptionValue(html, GROUP.name)
  if (sel === undefined) fail('dropdown missing on bad-class page')
  if (sel !== null) fail(`bad-class page incorrectly preselected ${sel}`)
  // Spot-check: no Next.js error overlay markers in HTML
  if (html.includes('Application error') || html.includes('500 Internal Server Error')) {
    fail('bad-class URL returned an error page')
  }
  pass(`CHECK 4: /trial/quick?class=${BAD} → 200 OK, dropdown empty, no error`)
}

// === CHECK 5+6: anon INSERT trial_booking and verify ===
const marker = `class-preselect-verify-${Date.now()}`
const testRow = {
  organisation_id: org.id,
  training_group_id: GROUP.id, // ← actual column name (was wrongly `group_id` in v1 of script)
  parent_name: 'Class Preselect Verify',
  parent_email: 'class-preselect-verify@example.invalid',
  child_name: 'Test Child',
  notes: marker, // marker so we can find + delete cleanly
}
{
  // PRODUCTION CODE SHAPE: no chained `.select()` after `.insert()`.
  // anon RLS on trial_bookings permits INSERT but not SELECT, so a returning
  // row would fail with 42501 — see CLAUDE.md failure-mode #2.  Match the
  // form in TrialForm.tsx exactly: insert, no select.
  const { error } = await anon.from('trial_bookings').insert(testRow)
  if (error) fail(`anon INSERT failed: ${error.message} (${error.code})`)
  pass(`CHECK 5: anon INSERT trial_booking succeeded (production shape, no .select())`)

  // Read the freshly-inserted row back via service role using our marker.
  const { data: inserted } = await svc
    .from('trial_bookings')
    .select('id, training_group_id, organisation_id, parent_email, notes')
    .eq('notes', marker)
    .single()
  if (!inserted) fail('service-role read after insert returned no row')
  if (inserted.training_group_id !== GROUP.id) fail(`inserted training_group_id ${inserted.training_group_id} != ${GROUP.id}`)
  if (inserted.organisation_id !== org.id) fail(`inserted organisation_id mismatch`)
  pass(`CHECK 6: trial_bookings.training_group_id (${inserted.training_group_id}) === preselected groupId (${GROUP.id})`)

  // === CHECK 7: cleanup ===
  const { error: delErr, count } = await svc
    .from('trial_bookings')
    .delete({ count: 'exact' })
    .eq('id', inserted.id)
  if (delErr) fail(`cleanup DELETE failed: ${delErr.message}`)
  // Sanity: re-query and confirm absent
  const { data: gone } = await svc
    .from('trial_bookings')
    .select('id')
    .eq('id', inserted.id)
    .maybeSingle()
  if (gone) fail(`cleanup verify: row ${inserted.id} still present after DELETE`)
  pass(`CHECK 7: cleanup — DELETE count=${count}, re-query returned no row`)
}

// === Final sanity: there are NO leftover rows with our marker ===
{
  const { data: residual } = await svc
    .from('trial_bookings')
    .select('id, notes')
    .eq('notes', marker)
  if (residual?.length) fail(`residual marker rows: ${residual.length}`)
  pass('FINAL: no residual marker rows remain in trial_bookings')
}

console.log()
console.log('All 7 verification checks passed.')
