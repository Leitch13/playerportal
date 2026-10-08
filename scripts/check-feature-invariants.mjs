#!/usr/bin/env node
// Runs before every build (package.json "prebuild"). Fails the build if a
// feature an academy relies on has been removed or overwritten by a later
// change to the same page. It can't tell whether a feature WORKS (the tests
// and the daily live check do that); it catches the quieter failure, where a
// page is edited and something that used to be there simply isn't any more.
//
// One line per thing a person would miss. To retire a feature on purpose,
// remove its line here in the same change, so it is a decision and not an accident.
import { existsSync, readFileSync } from 'node:fs'

const A = 'src/app', D = `${A}/dashboard`, O = `${D}/one-to-one`
const FEATURES = [
  // ── calm academy pages (Oct 2026)
  ['Payments: memberships list', `${D}/payments/MembershipsList.tsx`, ['data-testid="memberships-list"']],
  ['Payments: change-plan picker', `${D}/payments/SubscriptionActions.tsx`, ['plan-switcher', 'plan-change-preview']],
  ['Parents: family cards', `${D}/parents/ParentsTable.tsx`, ['parents-cards']],
  ['Players: class sheets', `${D}/players/PlayersTable.tsx`, ['players-squads']],
  ['Players: who has paid on each class sheet', `${D}/players/PlayersTable.tsx`, ['data-testid="squad-pay"', 'function squadPay(']],
  ['Plans & Pricing: plans by type', `${D}/plans/PlanManager.tsx`, ['plans-type-list']],
  ['Classes: quick filters', `${D}/groups/page.tsx`, ['classes-quick-filters']],
  ['Terms: calm page', `${D}/terms/TermManager.tsx`, ['terms-headline', 'term-card']],
  ['Enrol: offers the payment link straight after', `${D}/enrolments/EnrolmentForm.tsx`, ['enrol-done', '<RequestPaymentButton']],
  ['Camps: card layout', `${D}/camps/page.tsx`, ['camp-card', 'camps-headline']],
  ['Booking page: tidy layout', `${A}/book/[slug]/TidyClassList.tsx`, ['tidy-class-list']],
  ['Booking page: tidy layout is switched on by the shared rule', `${A}/book/[slug]/page.tsx`, ['isTidyBookingOrg(']],

  // ── request payment offers the class's plans
  ['Request payment: plan-matching rule', 'src/lib/plans-for-class.ts', ['export function plansForClasses']],
  ['Request payment: Enrolments list narrows the plans', `${D}/enrolments/page.tsx`, ['plansForClasses(', 'chaseFor(']],
  ['Request payment: the Enrol step narrows the plans', `${D}/enrolments/EnrolmentForm.tsx`, ['plansForClasses(']],
  ['Request payment: the player page narrows the plans', `${D}/players/[id]/page.tsx`, ['plansForClasses(', 'morePlans=']],
  ['Request payment: Show all plans', `${D}/players/[id]/RequestPaymentButton.tsx`, ['morePlans', 'show-all-plans']],

  // ── parents signing up
  ['Sign-up: refusals are recorded', `${A}/api/stripe/subscribe/route.ts`, ['recordSignupRefusal(', "'existing_membership'", "'start_date_not_a_class_day'", "'checkout_error'"]],
  ['Sign-up: refusal record', 'src/lib/signup-refusals.ts', ["action: 'signup.refused'"]],
  ['Sign-up: the two-class refusal says what to do next', `${A}/api/stripe/subscribe/route.ts`, ['already has a membership here', 'please contact the academy']],
  ['Sign-up: sibling discount counts a child who signed up this month', `${A}/api/stripe/subscribe/route.ts`, ['SIBLING_QUALIFYING_STATUSES']],
  ['Sign-up: sibling rule', 'src/lib/billing/sibling.ts', ["'trialing'", "'active'"]],

  // ── a membership is always for a class (John, 8 Oct 2026)
  ['Class required: the rule', 'src/lib/class-for-payment.ts', ['export function classForPayment', 'export function classesForPlan', 'CLASS_REQUIRED_MESSAGE']],
  ['Class required: the payment route refuses a payment with no class', `${A}/api/stripe/subscribe/route.ts`, ['classForPayment(', "'class_required'", 'CLASS_REQUIRED_MESSAGE', '!alreadyInClass']],
  ['Class required: the Membership page asks which class', `${D}/payments/AvailableUpgrades.tsx`, ['classesForPlan(', 'upgrade-class-select', 'classId={chosen?.id}', 'upgrade-today']],
  ['Class required: the Subscribe button sends the class', `${D}/payments/SubscribeButton.tsx`, ['billingOption, classId }']],
  ['Class required: the Membership page is given the classes', `${D}/payments/page.tsx`, ['classes={joinableClasses}']],
  ['Class required: the sign-up page asks which class', `${A}/auth/signup/page.tsx`, ['classesForPlan(', 'signup-class-select', 'classId: classForThisPayment']],
  ['How-to videos: linked on the sign-up page', `${A}/auth/signup/page.tsx`, ['how-to-videos-link', '/help/parents']],
  ['How-to videos: linked on the class page', `${A}/book/[slug]/class/[groupId]/page.tsx`, ['how-to-videos-link', '/help/parents']],
  ['How-to videos: linked on the parent home', 'src/components/parent/ParentHub.tsx', ['how-to-videos-link', '/help/parents']],
  ['How-to videos: the page itself', `${A}/help/parents/page.tsx`, ['<video']],
  ['How-to videos for academies: the page', `${A}/help/academies/page.tsx`, ['<video', 'academy-who-has-paid', 'academy-one-to-ones', 'academy-camps', 'academy-class-and-plan', 'academy-first-ten-minutes']],
  ['How-to videos for academies: in the academy menu', 'src/components/Navigation.tsx', ["href: '/help/academies'", "href: '/help/parents'"]],

  // ── camp waiting list
  ['Camp waiting list: a full camp offers it', `${A}/book/[slug]/camps/[campId]/CampBookingForm.tsx`, ['<CampWaitlistForm']],
  ['Camp waiting list: the join form', `${A}/book/[slug]/camps/[campId]/CampWaitlistForm.tsx`, ['camp-waitlist-form', 'camp-waitlist-join', '/api/camps/waitlist']],
  ['Camp waiting list: public join route', `${A}/api/camps/waitlist/route.ts`, ['CAMP_WAITLIST_SOURCE', 'parseWaitlistInput(']],
  ['Camp waiting list: the academy list', `${D}/camps/[campId]/page.tsx`, ['<CampWaitingList']],
  ['Camp waiting list: Invite to book', `${D}/camps/[campId]/CampWaitingList.tsx`, ['Invite to book', 'waitlist-invite']],
  ['Camp waiting list: invite route', `${A}/api/admin/camps/[campId]/waitlist-invite/route.ts`, ['sendEmail(']],
  ['Camp waiting list: count on the camp card', `${D}/camps/page.tsx`, ['camp-waiting-count']],
  ['Camp waiting list: shown on Leads', `${D}/leads/LeadsPipeline.tsx`, ['camp_waitlist']],

  // ── 1-2-1s
  ['1-2-1s: home says who has not paid a set-up link', `${O}/page.tsx`, ['notSetUp', 'Not paid yet']],
  ['1-2-1s: Needs you grouped by type', `${O}/page.tsx`, ['needs-you-groups', 'KIND_ORDER']],
  ['1-2-1s: a refusal names the coach and the keepers', 'src/lib/one-to-one/seats.ts', ['export function seatClashMessage']],
  ['1-2-1s: the admin route uses the named refusal', `${A}/api/one-to-one/admin/route.ts`, ['clashMessage(']],
  ['1-2-1s: refusals show in the red Not saved box', `${O}/ui.tsx`, ['data-testid="action-error"', 'Not saved']],
  ['1-2-1s: second keeper box', `${O}/regulars/SlotTypeFields.tsx`, ['secondPlayerId', 'twoToOnePence']],
  ['1-2-1s: the add form uses the second keeper box', `${O}/regulars/page.tsx`, ['<SlotTypeFields', 'Choose a coach']],
  ['1-2-1s: the admin route saves a pair in one go', `${A}/api/one-to-one/admin/route.ts`, ['secondPlayerId']],
  ['1-2-1s: alternating fortnightly slots', 'src/lib/one-to-one/seats.ts', ['export function sameWeeks', 'export function onSameWeeks']],
  ['1-2-1s: the admin route checks the weeks', `${A}/api/one-to-one/admin/route.ts`, ['onSameWeeks(']],
  ['1-2-1s: Regulars as session cards', `${O}/regulars/page.tsx`, ['regular-block', 'regulars-headline', 'Resend link', 'regulars-released']],
]

const fail = []
// The video files themselves.
for (const f of ['booking', 'cant-make-it', 'confirming-your-place', 'parent-page', 'academy-first-ten-minutes', 'academy-class-and-plan', 'academy-who-has-paid', 'academy-camps', 'academy-one-to-ones']) {
  for (const ext of ['mp4', 'jpg']) if (!existsSync(`public/help/${f}.${ext}`)) fail.push(`How-to videos: public/help/${f}.${ext} is missing`)
}
for (const [feature, file, needles] of FEATURES) {
  if (!existsSync(file)) { fail.push(`${feature}: ${file} is missing`); continue }
  const text = readFileSync(file, 'utf8')
  for (const n of needles) if (!text.includes(n)) fail.push(`${feature}: ${file} no longer contains ${JSON.stringify(n)}`)
}
// The camp join form sits inside the booking form. As a <form> of its own the browser drops it and the button does nothing.
const wl = `${A}/book/[slug]/camps/[campId]/CampWaitlistForm.tsx`
if (existsSync(wl) && /<form(\s+\w+=|>\s*$)/m.test(readFileSync(wl, 'utf8'))) fail.push(`Camp waiting list: ${wl} must not render its own <form> (it is nested inside the booking form)`)

if (fail.length) {
  console.error('\n✖ A feature academies use has gone missing. If that was deliberate, remove its line from scripts/check-feature-invariants.mjs in the same change:\n')
  for (const f of fail) console.error('  • ' + f)
  console.error('')
  process.exit(1)
}
console.log(`✓ feature invariants ok (${FEATURES.length} features still in place)`)
