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
  // A backup contact on every camp booking (13 Oct 2026). See src/lib/camp-backup-contact.ts.
  ['Camps: the whole-camp form asks for a backup contact', `${A}/book/[slug]/camps/[campId]/CampBookingForm.tsx`, ['camp-backup-name', 'camp-backup-phone', 'backupContactProblem({ name: backupName, phone: backupPhone, parentPhone })', 'backupName,\n        backupPhone,']],
  ['Camps: the by-the-day form asks for a backup contact', `${A}/book/[slug]/camps/[campId]/CampFlexibleDayPicker.tsx`, ['camp-backup-name', 'camp-backup-phone', 'backupProblem === null', 'backupName,\n        backupPhone,']],
  ['Camps: whole-camp checkout checks and records the backup contact', `${A}/api/stripe/camp-checkout/route.ts`, ['backupContactProblem({ name: backupName, phone: backupPhone, parentPhone })', 'bookingId: booking.id, name: backupName']],
  ['Camps: by-the-day checkout checks and records the backup contact', `${A}/api/stripe/flexible-camp-checkout/route.ts`, ['backupContactProblem({ name: backupName, phone: backupPhone, parentPhone })', 'bookingId, name: backupName']],
  ['Camps: the register shows the backup contact and a link to ask for one', `${D}/camps/[campId]/RosterClient.tsx`, ['camp-perday-backup', 'camp-backup-copy-link', 'camp-no-backup-count', "'Backup contact', 'Backup phone'"]],
  ['Camps: the camp page reads each booking\'s backup contact', `${D}/camps/[campId]/page.tsx`, ['latestBackups(', 'CAMP_BACKUP_ACTION', 'backup_phone: backups.get(b.id)']],
  ['Camps: a booked family can add a backup contact from a link', `${A}/api/camps/backup-contact/route.ts`, ['backupContactProblem(', "source: 'link'", 'parentPhone: booking.parent_phone']],
  ['Camps: the add-a-backup page', `${A}/book/[slug]/camps/backup/[bookingId]/page.tsx`, ['camp-backup-page', '<BackupContactForm']],
  // Welcome packs: the PDF an academy gives a new family, per class (13 Oct 2026). See src/lib/welcome-pack.ts.
  ['Welcome packs: the academy adds a pack and sees who has opened it', `${D}/welcome-packs/WelcomePackManager.tsx`, ['welcome-pack-form', 'uploadToSignedUrl(', 'welcome-pack-coverage', 'Not opened yet:', 'welcome-pack-remove']],
  ['Welcome packs: the academy can email a pack to parents who have not opened it', `${D}/welcome-packs/WelcomePackManager.tsx`, ['welcome-pack-email', "action: 'email', packId: p.packId", 'window.confirm(`Email', 'welcome-pack-emailed']],
  ['Welcome packs: saving a pack emails the families already in its classes; the button reminds', `${A}/api/admin/welcome-packs/route.ts`, ["body.action === 'email'", "mode: 'on_save'", "mode: 'button'", 'body.emailNow !== false']],
  ['Welcome packs: one send routine, nobody emailed twice by the system, never after opening', 'src/lib/welcome-pack-server.ts', ['export async function emailPack(', 'packEmailRecipients(', 'PACK_EMAILED_TO_ACTION', "opts.mode === 'new_joiners'", 's.enrolled_at >= pack.createdAt', "via: 'welcome_email'"]],
  ['Welcome packs: the morning job emails families who joined since', `${A}/api/cron/welcome-packs/route.ts`, ["mode: 'new_joiners'", 'CRON_SECRET', 'loadAllPacks(']],
  ['Welcome packs: the morning job is scheduled', 'vercel.json', ['"/api/cron/welcome-packs"']],
  ['Welcome packs: the form says it will email, and lets the academy choose not to', `${D}/welcome-packs/WelcomePackManager.tsx`, ['welcome-pack-email-now', 'emailNow }) })', 'Save and email parents']],
  ['Welcome packs: one page for the academy and for the parent', `${D}/welcome-packs/page.tsx`, ['loadFamilyPacks(', 'loadAcademyPacks(', 'packCoverage(', 'welcome-packs-parent']],
  ['Welcome packs: on the parent home page until opened', 'src/components/WelcomePackCard.tsx', ['welcome-pack-card', '!r.opened.has(p.packId)', '/api/welcome-pack/${p.packId}']],
  ['Welcome packs: the card is on the parent home page', `${D}/page.tsx`, ['<WelcomePackCard userId={userId} />}']],
  ['Welcome packs: opening checks the family is entitled and writes it down', `${A}/api/welcome-pack/[id]/route.ts`, ['packsForFamily(', 'PACK_OPENED_ACTION', 'createSignedUrl(', 'pathBelongsTo(']],
  ['Welcome packs: only an admin adds or removes, only inside their own academy', `${A}/api/admin/welcome-packs/route.ts`, ["me.role !== 'admin'", 'pathBelongsTo(path, orgId)', 'createSignedUploadUrl(', ".eq('organisation_id', orgId).in('id', classIds)"]],
  ['Welcome packs: the welcome email carries the button', 'src/lib/email-templates.ts', ['params.welcomePackUrl ?', 'Open your welcome pack']],
  ['Welcome packs: both welcome emails ask for the link', `${A}/api/stripe/webhooks/route.ts`, ['welcomePackLink(supabase, ctx.userId, appUrl)', 'welcomePackLink(supabase, userId, appUrl)']],
  ['Welcome packs: in both menus', 'src/components/Navigation.tsx', ["label: 'Welcome Pack'", "label: 'Welcome Packs'"]],
  ['Welcome packs: kept off the ordinary Documents list', `${D}/documents/page.tsx`, [".or('doc_type.is.null,doc_type.neq.welcome_pack')"]],
  // Player Reports one class at a time (13 Oct 2026). See src/lib/report-class-filter.ts.
  ['Player Reports: filter by class, and who still needs a report', `${D}/reviews/page.tsx`, ['<ReportClassFilter', 'playersInClass(', 'reportCoverage(', 'report-class-coverage', 'report-class-missing']],
  // The academy is told whether the parent was emailed a report and whether they opened it (13 Oct 2026). See src/lib/report-status.ts.
  ['Player Reports: each report says emailed / seen, with a send button', `${D}/reviews/PlayerFirstReports.tsx`, ['<ReportStatusLine review={latest}', 'reportStatus(', '<ReportResendButton']],
  ['Player Reports: the status line and its send button', `${D}/reviews/ReportResendButton.tsx`, ['report-status-sent', 'report-status-seen', 'report-resend', 'json.emailed']],
  ['Player Reports: the coach is told whether the email went', `${D}/reviews/ReviewForm.tsx`, ['savedReportMessage(childName, { emailed: res.ok && !!j.emailed']],
  ['Player Reports: the email route reports the truth and can re-send a saved report', `${A}/api/email/progress-report/route.ts`, ['body.reviewId', "success: true, emailed })", "'No parent email', emailed: false"]],
  ['Player Reports: the list is given the parent and both times', `${D}/reviews/page.tsx`, ['parent:profiles!players_parent_id_fkey(full_name, email)']],
  ['Player Reports: the class dropdown', `${D}/reviews/ReportClassFilter.tsx`, ['report-class-select', 'All classes', "next.set('class', id)"]],
  // After a trial: one joining link, sent in one tap, that opens sign-up filled in (13 Oct 2026). See src/lib/trial-join.ts.
  ['Trials: the academy sends a joining link in one tap', `${D}/trials/TrialJoinActions.tsx`, ['trial-send-join-link', "'send-join-link'", 'trial-date-picker', 'type="date"', 'trial-not-joining']],
  ['Trials: an attended trial offers the joining link, and Copy link copies it', `${D}/trials/TrialManager.tsx`, ['<TrialJoinActions', 'trialJoinPath(academySlug, trial.id)', "t.status === 'attended' && !t.converted && ("]],
  ['Trials: the page shows when the link was sent', `${D}/trials/page.tsx`, ['TRIAL_JOIN_SENT_ACTION', 'joinLinkSentAt']],
  ['Trials: the joining link ties the payment to the trial and opens sign-up', `${A}/book/[slug]/join/[trialId]/route.ts`, ['trial_signup_attributions', 'trialSignupPath(', 'to(fallback)']],
  ['Trials: sending the link emails the parent and is written down', `${A}/api/admin/trials/[id]/send-join-link/route.ts`, ['trialJoinLinkEmail(', 'TRIAL_JOIN_SENT_ACTION', 'joinLinkProblem(', 'conversion_offer_sent: true']],
  ['Trials: sign-up fills in a trial family\'s details', `${A}/auth/signup/page.tsx`, ["searchParams.get('tj')", '/api/trials/join-details', 'signup-from-trial']],
  ['Trials: the pre-fill gives nothing once a family has joined', `${A}/api/trials/join-details/route.ts`, ['t.converted', 'splitChildName(']],
  ['Trials: the day-1 follow-up email uses the joining link', `${A}/api/cron/trial-followup/route.ts`, ['trialJoinPath(org.slug, trial.id)']],
  ['Trials: the day-3 offer email uses the joining link', `${A}/api/cron/trial-conversion/route.ts`, ['trialJoinPath(org.slug, trial.id)']],
  ['Classes: filter by day, age group, venue and coach', `${D}/groups/page.tsx`, ['<ClassFilters', 'matchesClassFilters(', 'classFilterOptions(']],
  ['Classes: the filter row', `${D}/groups/ClassFilters.tsx`, ['class-filter-${key}', 'class-filters-clear', 'Any age group']],
  ['Terms: calm page', `${D}/terms/TermManager.tsx`, ['terms-headline', 'term-card']],
  ['Enrol: offers the payment link straight after', `${D}/enrolments/EnrolmentForm.tsx`, ['enrol-done', '<RequestPaymentButton']],
  ['Camps: card layout', `${D}/camps/page.tsx`, ['camp-card', 'camps-headline']],
  ['Camps: day register is a day picker and one list', `${D}/camps/[campId]/RosterClient.tsx`, ['camp-perday-register', 'camp-perday-tab', 'function PerDayRegister(']],
  ['Camps: tap a name on the day register for the child\'s details', `${D}/camps/[campId]/RosterClient.tsx`, ['camp-perday-name', 'camp-perday-details', 'tel:']],
  ['Camps: sort by name or age and show one age, on the bookings table and the day register', `${D}/camps/[campId]/RosterClient.tsx`, ['<SortBar', 'camp-roster-sort', 'camp-perday-sort', 'sortRoster(', 'onlyAge(']],
  ['Registers: the shared sort and age control', 'src/components/SortBar.tsx', ['export default function SortBar(', 'All ages']],
  ['Camps: the sort rule', 'src/lib/roster-sort.ts', ['export function sortRoster', 'export function agesPresent']],
  ['Camps: tick a child in on the day register', `${D}/camps/[campId]/RosterClient.tsx`, ['camp-perday-tick', '/check-in']],
  ['Camps: a tick is saved', `${A}/api/admin/camps/[campId]/check-in/route.ts`, ['CHECKED_IN_ACTION', "['admin', 'coach']"]],
  ['Camps: ticks are read back on the camp page', `${D}/camps/[campId]/page.tsx`, ['checkedInNow(']],
  ['Camps: a whole-week camp has the same tick-in register, kept by date', `${D}/camps/[campId]/page.tsx`, ['datesBetween(', 'dateDayId(', 'perDayGroups={perDayGroups}']],
  ['Camps: the tick route accepts a date for a whole-week camp', `${A}/api/admin/camps/[campId]/check-in/route.ts`, ['byDate', 'datesBetween(']],
  ['Booking page: tidy layout', `${A}/book/[slug]/TidyClassList.tsx`, ['tidy-class-list']],
  ['Booking page: tidy layout is switched on by the shared rule', `${A}/book/[slug]/page.tsx`, ['isTidyBookingOrg(']],
  // A link that shows one programme only, for ads (13 Oct 2026). See src/lib/programme-filter.ts.
  ['Booking page: a link for one programme only (?programme=)', `${A}/book/[slug]/page.tsx`, ['classesForProgramme(allSortedGroups, sp.programme)', 'data-testid="programme-only"', 'See all our classes']],

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

  // ── parents: My Children (Oct 2026)
  ['My Children: a card per child with age, membership, classes and details for the coach', `${D}/children/page.tsx`, ['data-testid="child-card"', 'data-testid="child-membership"', 'data-testid="child-stats"', 'data-testid="child-next"', 'data-testid="child-missing"', 'ageOn(', 'nextClassDate(', "'en-GB'"]],
  ['My Children: add and edit are still there', `${D}/children/page.tsx`, ['<AddChildForm', '<ChildEditor', '<PhotoUpload']],

  // ── the child's profile (Oct 2026): same card language as My Children
  ['Profile: header with membership, stats and four matching actions', `${D}/players/[id]/page.tsx`, ['data-testid="player-header"', 'data-testid="player-header-stats"', 'data-testid="player-header-actions"', 'data-testid="photo-consent-badge"', '<PlayerLevelEditor', '/passport', '/highlights', '/report/print']],
  ['Profile: the timeline uses line icons', 'src/components/PlayerTimeline.tsx', ['TIMELINE_ICON', 'data-testid="timeline-icon"']],

  // ── the class register (Oct 2026): one list to run a session from
  ['Class register: on the class page', `${D}/groups/[id]/page.tsx`, ['<ClassRegister', 'membershipPill(', 'latestClassDate(']],
  ['Class register: mark here or away, age, flags, details, sort, export', `${D}/groups/[id]/ClassRegister.tsx`, ['data-testid="register-mark"', 'data-testid="register-details"', 'data-testid="register-age"', '<SortBar', 'register-all-here', 'register-export', "onConflict: 'player_id,group_id,session_date'", 'tel:']],
  ['Class register: move and remove are still reachable', `${D}/groups/[id]/ClassRegister.tsx`, ['<ClassRosterRow menuOnly']],
  ['Class register: the rules', 'src/lib/class-register.ts', ['export function nextMark', 'export function ageOn', 'export function latestClassDate']],

  // ── a camp booking must give a date of birth, a phone number and a medical answer (12 Oct 2026)
  ['Camp booking: the rule', 'src/lib/camp-booking-details.ts', ['export function campDetailsProblem', 'NOTHING_TO_REPORT', 'export function validChildDob']],
  ['Camp booking: whole-camp form asks for them', `${A}/book/[slug]/camps/[campId]/CampBookingForm.tsx`, ['campDetailsProblem(', 'data-testid="camp-dob"', 'data-testid="camp-phone"', 'data-testid="camp-medical-none"']],
  ['Camp booking: by-the-day form asks for them', `${A}/book/[slug]/camps/[campId]/CampFlexibleDayPicker.tsx`, ['campDetailsProblem(', 'data-testid="camp-dob"', 'data-testid="camp-phone"', 'data-testid="camp-medical-none"']],
  ['Camp booking: the whole-camp route refuses a booking without them', `${A}/api/stripe/camp-checkout/route.ts`, ['campDetailsProblem(', "'camp_details_missing'"]],
  ['Camp booking: the by-the-day route refuses a booking without them', `${A}/api/stripe/flexible-camp-checkout/route.ts`, ['campDetailsProblem(', "'camp_details_missing'"]],

  // ── released 12 Oct 2026
  ['Dashboard: the calm academy home', 'src/components/CommandCentre.tsx', ['data-testid="calm-dashboard"', 'data-testid="dash-todo"', 'data-testid="dash-figures"']],
  ['Request payment: the academy must choose when the parent starts paying', `${D}/players/[id]/RequestPaymentButton.tsx`, ["useState<'today' | 'next_month' | null>(null)", 'Choose when they start paying.', '!firstBilling']],
  ['1-2-1 timetable: the phone agenda', `${D}/one-to-one/timetable/page.tsx`, ['data-testid="timetable-agenda"', 'timetable-block-time', 'timetable-roll']],

  // ── trials (Oct 2026: paid trials told nobody for four months)
  ['Trials: on a phone each trial is a card with its class, date, phone and every button', `${D}/trials/TrialManager.tsx`, ['data-testid="trial-cards"', 'data-testid="trial-card-actions"', 'rowActions(t, true)', 'trial-next-step', 'md:hidden', 'tel:']],
  ['Trials: a paid trial shows as paid', `${D}/trials/TrialManager.tsx`, ['data-testid="trial-paid"', 'paidTrialPence(']],
  ['Trials: the parent of a paid trial gets a confirmation', 'src/lib/email-templates.ts', ['export function paidTrialConfirmationEmail']],
  ['Trials: one booking per child, class and date', `${A}/api/trial-bookings/paid/route.ts`, ['sameTrial(', "'trial_already_booked'"]],

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
  // Parent home in the premium look, 14 Oct 2026. Greeted without a name (accounts are often "X Family"). See src/lib/parent-greeting.ts.
  ['Parent home: greeting with no surname, and a line about today', 'src/components/parent/ParentHub.tsx', ['greetingFor()', 'todayLine(nextSession)', 'parent-greeting', 'parent-next-session', '{props.welcomePack}', 'MembershipOverview activeSubs={activeSubs}']],
  ['Parent home: the welcome pack sits inside the home page', `${D}/page.tsx`, ['welcomePack={<WelcomePackCard userId={userId} />}']],
  ['How-to videos: the page itself', `${A}/help/parents/page.tsx`, ['<video']],
  ['How-to videos for academies: the page', `${A}/help/academies/page.tsx`, ['<video', 'academy-who-has-paid', 'academy-one-to-ones', 'academy-camps', 'academy-class-and-plan', 'academy-first-ten-minutes', 'academy-refund', 'academy-who-owes', 'academy-class-start-date', 'academy-class-prices', 'academy-camp-owed', 'academy-one-to-one-setup', 'academy-one-to-one-month']],
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
  // ── A trial booked from the class dropdown always asks for a date (Jamie's ads, 15 Oct 2026)
  ['Trials: picking a class from the dropdown shows Pick your date', `${A}/book/[slug]/trial/quick/TrialForm.tsx`, ['data-testid="trial-date-after-class"', "setSessionDate('') }}", "Please pick a date for the trial."]],
  // ── 1-2-1 audit fixes (15 Oct 2026)
  ['1-2-1s: regulars not yet rolled are never sold to the public', 'src/lib/one-to-one/db.ts', ['const notYetRolled', '...notYetRolled']],
  ['1-2-1s: blocks and resolved flags still take the coach out', 'src/lib/one-to-one/availability.ts', ['Blocks and flags ALWAYS take the coach out']],
  ['1-2-1s: the hold outlives the payment page', `${A}/api/one-to-one/public/route.ts`, ['hold_expires_at: new Date(Date.now() + 31 * 60_000)']],
  ['1-2-1s: paid with no session is refunded at once', `${A}/api/stripe/one-to-one-webhooks/route.ts`, ['Never keep\n          // money for nothing']],
  ['1-2-1s: moved sessions are billed', 'src/lib/one-to-one/money.ts', ["const BILLED_SOURCES = ['regular', 'admin']"]],
  ['1-2-1s: pause credits paid dates, resume brings dates back', 'src/lib/one-to-one/money.ts', ['export async function takeOffSlotSessions', 'export async function resumeSlotSessions']],
  ['1-2-1s: a set-up link never reopens a paid month, one link per month', 'src/lib/one-to-one/money.ts', ['async function prepareSetupCharge', 'await expireIfOpen(existing.stripe_checkout_session_id']],
  ['1-2-1s: cash families can be set up', `${D}/one-to-one/page.tsx`, ["action: 'slot.cash_setup'"]],
  ['1-2-1s: a cancelled guest booking is refunded', 'src/lib/one-to-one/money.ts', ['} else if (wasCharged && !s.parent_id && s.stripe_payment_intent_id']],
  // ── 1-2-1 money owed from a late cancellation is billed once (live JSL test, 15 Oct 2026)
  ['1-2-1s: owed money goes on the bill without negative credit', 'src/lib/one-to-one/ledger.ts', ['export function chargeRow', 'export function owedOnCharge', 'Math.max(0, b.creditAppliedPence)']],
  ['1-2-1s: both charge paths write the row through chargeRow, and paying clears what was owed', 'src/lib/one-to-one/money.ts', ['...chargeRow(b),\n      status:', '...chargeRow(b),\n    breakdown:', 'const owed = owedOnCharge(charge)']],
  // ── Analytics counts paid 1-2-1s (No.1 GK, 15 Oct 2026)
  ['Analytics: revenue includes paid 1-2-1s', `${D}/analytics/page.tsx`, ["from('coaching_charges')", 'oneToOneByMonth(', 'from 1-2-1s']],
  ['Analytics: the 1-2-1 revenue rule', 'src/lib/analytics-revenue.ts', ["export const PAID_ONE_TO_ONE = ['paid_online', 'paid_cash']", 'export function oneToOneByMonth']],
  // ── Reminders: never "see you tomorrow" for a class between its blocks (G&G, 14 Oct 2026)
  ['Session reminders: skip classes outside their block dates', `${A}/api/cron/session-reminders/route.ts`, ['term:terms(start_date, end_date)', 'classRunsOn(tomorrowDate', 'ukDateFromNow(1)']],
  ['Session reminders: the block-date rule', 'src/lib/term-window.ts', ['export function classRunsOn', 'export function ukDateFromNow']],
  // ── Refunds made easy (John, 15 Oct 2026: "is it easier to send a refund?")
  ['Refunds: every paid card payment is refundable', 'src/lib/refund-kind.ts', ["startsWith('cs_') || stripeSessionId.startsWith('in_')", "return 'one_off'", "d.startsWith('Sessions this month')"]],
  ['Refunds: one-window refund button', `${D}/payments/invoice/[id]/RefundButton.tsx`, ['data-testid="refund-confirm"', 'Cancel this membership too', 'compact']],
  ['Refunds: button on every payment row', `${D}/payments/page.tsx`, ['canRefund(p) && (', '<RefundButton\n                                  compact']],
  ['Refunds: button on the family payment history', `${D}/parents/[id]/page.tsx`, ['canRefund(pay) && (', "rpc('get_my_role')"]],
  ['Refunds: receipt button is admins only', `${D}/payments/invoice/[id]/page.tsx`, ["profile.role === 'admin' && sameOrg && canRefund(payment)"]],
  ['Refunds: route takes every card payment and emails the parent', `${A}/api/admin/payments/[id]/refund/route.ts`, ['hasRefundableStripeId(payment.stripe_session_id', 'refundedEmail({']],
  ['Refunds: Stripe refunds synced for every kind', `${A}/api/stripe/webhooks/route.ts`, ["refundKind(payment.description as string | null) === 'camp'"]],
  ['Payments: search a parent or child', `${D}/payments/page.tsx`, ['data-testid="payments-search"', 'const searching = q.length >= 2']],
  // ── A regular's new price is emailed to the family when saved (John, 15 Oct 2026)
  ['1-2-1s: price change emails the family', 'src/lib/one-to-one/price-change.ts', ['export async function emailPriceChange', 'sendPriceChanged({', ".eq('charge_state', 'unpaid')", 'dates: (dates ?? []).map(']],
  ['1-2-1s: saving a new price sends it', `${A}/api/one-to-one/admin/route.ts`, ["price !== cur.price_pence && (cur.status === 'active' || cur.status === 'paused')", 'emailPriceChange(admin, orgId']],
  ['1-2-1s: the form shows "emailed to"', `${O}/ui.tsx`, ['data-testid="action-notice"', 'r.notice']],
  ['Camps: resend confirmation only for paid bookings', `${D}/camps/[campId]/RosterClient.tsx`, ["b.payment_status !== 'paid' || !b.parent_email", 'setResendError(']],
  // ── Unpaid camp bookings never look paid (WLFA, 15 Oct 2026 — John: "make sure it never goes away")
  ['Camps: the unpaid display rule', 'src/lib/camp-payment-display.ts', ["if (status !== 'pending') return null", '`£${pounds.toFixed(2)} outstanding`', "return status === 'paid' ? Number(amount || 0) : 0"]],
  ['Camps: the unpaid display rule is tested', 'src/lib/camp-payment-display.test.ts', ["expect(outstanding('pending', 80)).toBe('£80.00 outstanding')", "expect(paidAmount('pending', 80)).toBe(0)"]],
  ['Camps: red outstanding box on the register', `${D}/camps/[campId]/RosterClient.tsx`, ['data-testid="camp-roster-outstanding"', 'data-testid="camp-perday-outstanding"', 'paidAmount(b.payment_status, b.amount_paid) > 0 ?']],
  ['Camps: printed register shows the outstanding box', `${D}/camps/[campId]/print/page.tsx`, ['data-testid="print-outstanding"', 'booking_mode, amount_paid']],
  ['Camps: unpaid booking stays on (red) and the academy is told', `${A}/api/stripe/webhooks/route.ts`, ["type: 'camp_unpaid'", "They're on the register in red", "if (session.metadata.sent_by === 'academy_payment_link') return"]],
  ['Camps: the academy\'s payment link never runs out', 'src/lib/camp-payment-link.ts', ['export async function checkCampLink', 'export async function openCampCheckout', "sent_by: 'academy_payment_link'"]],
  ['Camps: payment link email opens the never-expiring pay page', `${A}/api/admin/camps/[campId]/bookings/[bookingId]/payment-link/route.ts`, ['/pay/camp/${booking.id}', 'checkCampLink(svc, bookingId)']],
  ['Camps: parent pay page and its checkout', `${A}/pay/camp/[bookingId]/page.tsx`, ['checkoutPath={`/api/camp-bookings/${b.id}/checkout`}']],
  ['Camps: pay page checkout route', `${A}/api/camp-bookings/[id]/checkout/route.ts`, ['openCampCheckout(svc, c, origin)']],
  ['Camps: the rule is written down', 'BILLING_RULES.md', ["There's no way that people can book camps and not pay. The academy has to be told that they are not paying.", 'Never assume a rule']],
  // ── Class registers: red "£X outstanding" box next to the child (John, 15 Oct 2026, "like ClassForKids")
  ['Classes: the outstanding rule', 'src/lib/class-outstanding.ts', ["const OWING_PAYMENT = ['unpaid', 'partial', 'overdue']", "const FAILED_SUB = ['past_due', 'unpaid', 'incomplete']", "return 'No membership'", 'export async function loadClassOutstanding']],
  ['Classes: the outstanding rule is tested', 'src/lib/class-outstanding.test.ts', ["toBe('£36.00 outstanding')", "toBe('No membership')"]],
  ['Classes: red box on the class page register', `${D}/groups/[id]/ClassRegister.tsx`, ['data-testid="register-outstanding"']],
  ['Classes: class page loads what is outstanding', `${D}/groups/[id]/page.tsx`, ['loadClassOutstanding(', 'outstanding: outstandingByPlayer.get(p.id)']],
  ['Classes: red box on the live register', `${D}/attendance/register/[groupId]/LiveRegisterClient.tsx`, ['data-testid="live-register-outstanding"']],
  ['Classes: live register loads what is outstanding', `${D}/attendance/register/[groupId]/page.tsx`, ['loadClassOutstanding(']],
  ['Classes: red box on the printed register', `${D}/attendance/register/[groupId]/blank/page.tsx`, ['data-testid="print-register-outstanding"', 'loadClassOutstanding(']],
  ['Classes: Remove from class can cancel a failing membership too', `${D}/groups/[id]/ClassRosterRow.tsx`, ['data-testid="roster-remove-cancel-membership"', "fetch('/api/stripe/cancel'", 'Cancel their membership too']],
  // ── A class whose term hasn't started starts on the term (CFCoaching, 17 Oct 2026)
  ['Sign-up: earliest start is the term start', 'src/lib/class-start.ts', ['export function earliestStart', 'export function termNotStarted']],
  ['Sign-up: earliest start is tested', 'src/lib/class-start.test.ts', ["toBe('2026-11-02')"]],
  ['Sign-up: picker only offers dates from the term', 'src/components/billing/StartDatePicker.tsx', ['earliestStart(todayIso, termStartIso, classDayOfWeek)', 'generateSessionDates(startFromIso', 'data-testid="start-term-note"']],
  ['Sign-up: booking page passes the term', `${A}/book/[slug]/class/[groupId]/quick-book/page.tsx`, ['term:terms(start_date)', 'termStartIso=']],
  ['Sign-up: server moves an early start to the term', `${A}/api/stripe/subscribe/route.ts`, ['termNotStarted(todayIsoUtc, termStart)', "'class_term_not_open_yet'", 'activatesOnIso = first']],
  // ── Class prices visible, academies' own names (John, 17 Oct 2026)
  ['Classes: prices rule', 'src/lib/class-prices.ts', ['export function pricesForClass', 'p.active !== false']],
  ['Classes: prices rule tested', 'src/lib/class-prices.test.ts', ["a class with nothing on sale for it has no prices"]],
  ['Classes: class page shows its prices, red when none', `${D}/groups/[id]/page.tsx`, ['data-testid="class-prices"', 'data-testid="class-prices-none"', 'data-testid="class-prices-button"']],
  ['Classes: list flags a class with no price', `${D}/groups/GroupCard.tsx`, ['data-testid="class-card-no-price"']],
  ['Classes: price page has no ready-made templates, own names', `${D}/groups/[id]/plans/ClassPlanManager.tsx`, ['+ Add a price', 'Name parents see *']],
  // ── 1-2-1s Needs you: grouped, short rows, Show all, Resend all, bigger buttons (John, 17 Oct 2026)
  ['1-2-1s: Needs you grouped with short rows', `${O}/page.tsx`, ['testId="needs-unpaid"', "action: 'slot.setup_link_all'", 'Release the slot']],
  ['1-2-1s: Needs you shows the first few and Show all', `${O}/NeedsGroup.tsx`, ['data-testid="needs-show-all"', 'rows.slice(0, show)']],
  ['1-2-1s: Resend all links', `${A}/api/one-to-one/admin/route.ts`, ["case 'slot.setup_link_all'"]],
  ['1-2-1s: bigger buttons on a laptop', `${O}/ui.tsx`, ['lg:h-10 lg:px-4 lg:text-sm']],
  // ── Each family's month under Regulars, and the updated breakdown email (John, 18 Oct 2026)
  ['1-2-1s: family month uses the real bill calculation', 'src/lib/one-to-one/family-month.ts', ['chargeBreakdown(unpaid.map(', 'export function offReason', "you couldn't make it · not charged"]],
  ['1-2-1s: family month is tested', 'src/lib/one-to-one/family-month.test.ts', ["comes off the bill and says why"]],
  ['1-2-1s: one breakdown per family, due changes sent', 'src/lib/one-to-one/family-month-send.ts', ['export async function sendFamilyMonth', 'export async function breakdownsDue', 'export async function markBreakdownDue']],
  ['1-2-1s: breakdown email', 'src/lib/one-to-one/emails.ts', ['export async function sendMonthBreakdown', "sessions, updated`"]],
  ['1-2-1s: dates and changes under each regular', `${O}/regulars/page.tsx`, ['data-testid="family-month-panel"', "action: 'session.cant_make_it'", "action: 'family.send_month'", 'data-testid="family-month-unsent"']],
  ['1-2-1s: academy date actions', `${A}/api/one-to-one/admin/route.ts`, ["case 'session.cant_make_it'", "case 'family.send_month'", 'markBreakdownDue(admin, orgId']],
  ['1-2-1s: 6pm run sends any breakdown still due', `${A}/api/cron/one-to-one-breakdowns/route.ts`, ['breakdownsDue(admin)']],
  ['1-2-1s: the 6pm run is scheduled', 'vercel.json', ['"/api/cron/one-to-one-breakdowns"']],
  // ── Release A (18 Oct 2026): NA medical, credit history, change amount, coach emails, missing details, held dates
  ['Camps: "NA" and the like are not medical notes', 'src/lib/camp-booking-details.ts', ['const NOTHING = /^(n', '!NOTHING.test(t)']],
  ['1-2-1s: credit history and credit waiting', `${O}/regulars/page.tsx`, ['data-testid="credit-history"', 'data-testid="credit-waiting"', 'data-testid="family-month-setup"']],
  ['1-2-1s: held dates shown for a family not set up yet', 'src/lib/one-to-one/family-month.ts', ["tag: 'held · not set up yet'", 'setUpPence']],
  ['1-2-1s: held dates never counted in the month', `${O}/regulars/page.tsx`, ["const billed = fm.on.filter((l) => !l.tag?.startsWith('held'))", '{billed.length} session']],
  ['1-2-1s: held dates never in the month email', 'src/lib/one-to-one/family-month-send.ts', ["on: m.on.filter((l) => !l.tag?.startsWith('held'))"]],
  ['Camps: change amount on an unpaid booking, never £0', `${A}/api/admin/camps/[campId]/bookings/[bookingId]/amount/route.ts`, ['amount <= 0', "payment_status !== 'pending'", "action: 'camp_booking.amount_changed'"]],
  ['Camps: change amount on the register', `${D}/camps/[campId]/RosterClient.tsx`, ['data-testid="camp-roster-change-amount"', 'data-testid="camp-roster-age-missing"', 'data-testid="camp-ask-details"']],
  ['Camps: ask families for missing details', `${A}/api/admin/camps/[campId]/ask-details/route.ts`, ['missingDetails(svc, campId)', "action: 'camp.details_requested'"]],
  ['Camps: family link takes a missing date of birth', `${A}/api/camps/backup-contact/route.ts`, ['validChildDob(body.dob)']],
  ['1-2-1s: coaches emailed about their sessions', 'src/lib/one-to-one/coach-notify.ts', ['export async function coachNewRegular', 'export async function coachSessionChange']],
  ['Classes: a full class shows only the waiting list', 'src/app/book/[slug]/class/[groupId]/page.tsx', ['{showTrialCta && !isFull && (', '<div id="waitlist">', '{!isFull && <Link']],
  ['Classes: free-trial form checks places', 'src/app/book/[slug]/trial/quick/TrialForm.tsx', ["fetch('/api/trials/place-check'", 'disabled={d.full}']],
  ['Classes: full class trial links go to the waiting list', 'src/app/book/[slug]/trial/quick/page.tsx', ['redirect(`/book/${slug}/class/${preselectedClassId}#waitlist`)']],
  ['Classes: paid trial refused for a full day', `${A}/api/trial-bookings/paid/route.ts`, ['await trialPlaceFree(placesDb(), groupId, sessionDate)']],
  ['Classes: paid trial page for a full class goes to the waiting list', 'src/app/book/[slug]/class/[groupId]/trial/paid/page.tsx', ['#waitlist`)']],
  ['Classes: academy told when a class goes over its limit', `${A}/api/cron/class-over-limit/route.ts`, ['alertOverLimitDays(placesDb()']],
  ['Classes: over-limit cron scheduled', 'vercel.json', ['/api/cron/class-over-limit']],
  ['Classes: red over-limit line on class page and register', `${D}/groups/[id]/page.tsx`, ['<OverLimitDays days={overDays} />']],
  ['Classes: red over-limit line on the live register', `${D}/attendance/register/[groupId]/page.tsx`, ['data-testid="register-over-limit"']],
  ['Classes: database refuses a public trial for a full day', 'supabase/123_trial_needs_a_place.sql', ['CREATE TRIGGER trial_booking_needs_a_place']],
  ['1-2-1s: the 20th notice never tells a family "0 sessions, £0"', 'src/lib/one-to-one/money.ts', ['if (m.breakdown.sessionIds.length === 0) { skipped++; continue }']],
  ['Memberships: next payment date read from wherever Stripe puts it', 'src/app/api/stripe/webhooks/route.ts', ['const sub = withPeriod(subscription as Stripe.Subscription)', "import { withPeriod, subPeriod } from '@/lib/stripe-period'"]],
  ['1-2-1s: payments listed on the Payments page', `${D}/payments/page.tsx`, ['await loadOneToOneMoney(adminClient(), orgId', '<OneToOnePayments rows={oneToOneRows}']],
  ['1-2-1s: section on Analytics', `${D}/analytics/page.tsx`, ['loadOneToOneActivity(adminClient()', 'data-testid="analytics-one-to-ones"']],
  ['1-2-1s: payments in Exports', `${A}/api/export/[type]/route.ts`, ["case 'one-to-ones':"]],
  ['1-2-1s: money report reads charges and one-offs', 'src/lib/one-to-one/money-report.ts', ["from('coaching_charges')", "neq('source', 'regular')"]],
  ['1-2-1s: coach emailed when a whole regular moves', 'src/app/api/one-to-one/admin/route.ts', ['await coachRegularMoved(admin, cur,']],
  ['1-2-1s: coach emails wired in', 'src/lib/one-to-one/money.ts', ['await coachNewRegular(admin, slot)', "await coachSessionChange(admin, 'off', s"]],
  ['1-2-1s: coach told about one-off bookings', `${A}/api/stripe/one-to-one-webhooks/route.ts`, ["await coachSessionChange(admin, 'booked', s)"]],
  ['1-2-1s: coach told about cover and moves', `${A}/api/one-to-one/admin/route.ts`, ["coachSessionChange(admin, 'cover'", "coachSessionChange(admin, 'moved_out'"]],
  ['Camps: register table uses the NA rule', `${D}/camps/[campId]/RosterClient.tsx`, ['const hasMedical = hasMedicalNote(b.medical_info)']],
  ['Camps: printed register uses the NA rule', `${D}/camps/[campId]/print/page.tsx`, ['const hasMedical = hasMedicalNote(r.medical_info)']],
  ['Classes: live register uses the NA rule', `${D}/attendance/register/[groupId]/LiveRegisterClient.tsx`, ['const hasMedical = hasMedicalNote(p.medical_info)']],
  ['1-2-1s: Regulars as session cards', `${O}/regulars/page.tsx`, ['regular-block', 'regulars-headline', 'Resend link', 'regulars-released']],
]

const fail = []
// The video files themselves.
for (const f of ['booking', 'cant-make-it', 'confirming-your-place', 'parent-page', 'academy-first-ten-minutes', 'academy-class-and-plan', 'academy-who-has-paid', 'academy-camps', 'academy-one-to-ones', 'academy-refund', 'academy-who-owes', 'academy-class-start-date', 'academy-class-prices', 'academy-camp-owed', 'academy-one-to-one-setup', 'academy-one-to-one-month']) {
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
