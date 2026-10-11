#!/usr/bin/env node
// Runs before every build (package.json "prebuild"). An academy must be told
// whenever a parent books, joins, pays or leaves. This fails the build if a
// route can do one of those things silently.
//
// Why: paid trials were silent from May to October 2026. Ten bookings at three
// academies were never announced, and one parent who heard nothing paid twice.
// The other guards could not see it, because they protect features that exist;
// this alert had never been built. So this guard does not ask "is the feature
// still there?". It asks "does every way of booking have one?".
//
// How it works:
//   1. It finds every file that creates a trial, a camp place, a waiting-list
//      place, a class place, a 1-2-1 session or a card payment page.
//   2. Each of those files must be in LEDGER below, with an answer:
//        alert: [file, 'text that must be there']  the academy is told, and here is the proof
//        staff: 'why'                              the academy did this itself, so nobody needs telling
//   3. A file that is not in the ledger fails the build. So does a ledger entry
//      whose proof has gone.
//
// Adding a new way to book? Add its file here in the same change, with the line
// that tells the academy. There is no third answer.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const A = 'src/app/api', WH = `${A}/stripe/webhooks/route.ts`, OTO = `${A}/stripe/one-to-one-webhooks/route.ts`
const CREATES = [
  ['a trial booking', /from\('trial_bookings'\)\s*\.insert\(/],
  ['a camp place', /from\('camp_bookings'\)\s*\.insert\(/],
  ['a waiting-list place', /from\('waitlist'\)\s*\.insert\(/],
  ['a class place', /from\('enrolments'\)\s*\.insert\(|rpc\(\s*'enrol_if_capacity_available'/],
  ['a 1-2-1 session', /from\('coaching_sessions'\)\s*\.insert\(/],
  ['a lead or camp waiting-list request', /from\('leads'\)\s*\.insert\(/],
  ['a card payment page', /checkout\.sessions\.create\(/],
]

const LEDGER = {
  // ── trials
  'src/app/book/[slug]/trial/quick/TrialForm.tsx': { alert: [[`${A}/trials/notify-academy/route.ts`, 'alertAcademyOfTrial('], ['src/app/book/[slug]/trial/quick/TrialForm.tsx', '/api/trials/notify-academy']] },
  [`${A}/trial-bookings/paid/route.ts`]: { alert: [[WH, "await import('@/lib/trial-alerts')"], [WH, 'alertAcademyOfTrial(supabase, trialId)'], [WH, 'confirmPaidTrialToParent(supabase, trialId)'], [`${A}/trial-bookings/paid/route.ts`, 'TRIAL_ALREADY_BOOKED_MESSAGE']] },
  // ── the class webhook: memberships, camps, one-off requests and paid trials all land here
  [WH]: { alert: [[WH, 'alertAcademyOfTrial(supabase, trialId)'], [WH, 'newSignupAdminEmail('], [WH, 'Academy admin notification'], [WH, 'notifyOrgAdmins(']] },
  [`${A}/stripe/subscribe/route.ts`]: { alert: [[WH, 'newSignupAdminEmail(']] },
  [`${A}/migration/confirm-checkout/route.ts`]: { alert: [[WH, "type: 'invite_confirmed'"]] },
  [`${A}/stripe/camp-checkout/route.ts`]: { alert: [[WH, 'Academy admin notification']] },
  [`${A}/stripe/flexible-camp-checkout/route.ts`]: { alert: [[WH, 'Academy admin notification']] },
  [`${A}/admin/camps/[campId]/bookings/[bookingId]/payment-link/route.ts`]: { alert: [[WH, 'Academy admin notification']] },
  'src/lib/invoice-checkout.ts': { alert: [[WH, "session.metadata?.payment_id"], [WH, 'notifyOrgAdmins(']] },
  // ── classes and waiting lists
  [`${A}/enrolments/book/route.ts`]: { alert: [[`${A}/enrolments/book/route.ts`, 'notifyOrgAdmins(']] },
  [`${A}/enrolments/move/route.ts`]: { alert: [[`${A}/enrolments/move/route.ts`, 'notifyOrgAdmins(']] },
  'src/app/dashboard/schedule/BookClassButton.tsx': { alert: [['src/app/dashboard/schedule/BookClassButton.tsx', '/api/email/booking-confirmation'], [`${A}/email/booking-confirmation/route.ts`, "type: 'class_booked'"], ['src/app/dashboard/schedule/BookClassButton.tsx', '/api/waitlist/announce'], [`${A}/waitlist/announce/route.ts`, 'notifyOrgAdmins(']] },
  [`${A}/waitlist/join/route.ts`]: { alert: [[`${A}/waitlist/join/route.ts`, 'notifyOrgAdmins(']] },
  [`${A}/waitlist/accept/route.ts`]: { alert: [[`${A}/waitlist/accept/route.ts`, "type: 'waitlist_accepted'"]] },
  [`${A}/stripe/change-plan/route.ts`]: { alert: [[`${A}/stripe/change-plan/route.ts`, "type: 'plan_changed'"]] },
  [`${A}/camps/waitlist/route.ts`]: { alert: [[`${A}/camps/waitlist/route.ts`, "type: 'camp_waitlist_joined'"]] },
  // ── 1-2-1s
  'src/lib/one-to-one/checkout.ts': { alert: [[OTO, "type: 'one_to_one_booked'"]] },
  // ── the academy's own actions: they did it, so nobody needs telling
  [`${A}/admin/camps/[campId]/add-player/route.ts`]: { staff: 'an admin adds a child to a camp by hand' },
  [`${A}/admin/players/route.ts`]: { staff: 'an admin adds a player and puts them in a class' },
  [`${A}/enrolments/admin-add/route.ts`]: { staff: 'an admin enrols a child' },
  [`${A}/import/migrate/route.ts`]: { staff: 'the academy imports its members' },
  [`${A}/import/players/route.ts`]: { staff: 'the academy imports its players' },
  [`${A}/migration/import/route.ts`]: { staff: 'the academy imports its members' },
  [`${A}/one-to-one/admin/route.ts`]: { staff: 'the academy books or changes a 1-2-1 itself' },
  'src/lib/one-to-one/db.ts': { staff: 'the monthly roll writes the regular 1-2-1 sessions the academy set up' },
  'src/lib/one-to-one/money.ts': { alert: [[OTO, "type: 'one_to_one_set_up'"]] },
  'src/app/dashboard/enrolments/EnrolmentForm.tsx': { staff: 'an admin enrols a child' },
  'src/app/dashboard/leads/LeadsPipeline.tsx': { staff: 'an admin adds a lead or books a trial for a lead' },
  'src/app/dashboard/players/[id]/AddToGroupButton.tsx': { staff: 'an admin adds a player to a class' },
  [`${A}/leads/create/route.ts`]: { staff: 'a lead row saved alongside a trial or an abandoned checkout; the trial itself is what is announced' },
  [`${A}/platform/subscribe/route.ts`]: { staff: 'the academy paying its own Player Portal subscription' },
}

// Parent actions that end something rather than start it. Not found by CREATES, so listed by hand.
const ALSO = [
  ['A parent cancels a class place', `${A}/enrolments/cancel/route.ts`, "type: 'class_cancelled'"],
  ['A parent cancels a membership', `${A}/stripe/cancel/route.ts`, 'notifyOrgAdmins('],
  ['Every trial is announced through one function', 'src/lib/trial-alerts.ts', 'TRIAL_ALERTED_ACTION'],
  ['The daily check that every trial was announced', 'src/lib/canaries/index.ts', 'canary17TrialNotAnnounced'],
]

const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(f) && !/\.test\./.test(f) ? [p] : [] })
const read = (f) => (existsSync(f) ? readFileSync(f, 'utf8') : null)
const failures = []
let alerting = 0, staff = 0

for (const file of walk('src')) {
  const src = readFileSync(file, 'utf8')
  const makes = CREATES.filter(([, re]) => re.test(src)).map(([what]) => what)
  if (!makes.length) continue
  const entry = LEDGER[file]
  if (!entry) { failures.push(`${file} creates ${makes.join(' and ')} but is not in the ledger. Decide who is told and add it to scripts/check-academy-alert-invariants.mjs.`); continue }
  if (entry.staff) { staff++; continue }
  for (const [where, proof] of entry.alert) {
    const body = read(where)
    if (body == null) failures.push(`${file}: its alert is meant to be in ${where}, which no longer exists.`)
    else if (!body.includes(proof)) failures.push(`${file}: the academy alert has gone. Expected "${proof}" in ${where}.`)
  }
  alerting++
}
for (const file of Object.keys(LEDGER)) if (!existsSync(file)) failures.push(`${file} is in the ledger but no longer exists. Remove its line in the same change that removed the file.`)
for (const [what, where, proof] of ALSO) { const body = read(where); if (body == null || !body.includes(proof)) failures.push(`${what}: expected "${proof}" in ${where}.`) }

if (failures.length) {
  console.error(`✗ academy alerts: ${failures.length} problem${failures.length === 1 ? '' : 's'}\n` + failures.map((f) => '  - ' + f).join('\n'))
  process.exit(1)
}
console.log(`✓ academy alerts ok (${alerting} ways a parent can book or pay all tell the academy; ${staff} are the academy's own actions)`)
