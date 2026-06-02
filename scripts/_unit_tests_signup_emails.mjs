/**
 * Unit tests for the three new/extended signup emails.
 *
 * Imports the templates from src/lib/email-templates.ts (loaded via tsx for
 * TS support). Renders each variant and asserts the HTML body contains the
 * billing-model-aware copy parents/admins are supposed to see.
 *
 * Run with:  npx tsx scripts/_unit_tests_signup_emails.mjs
 *
 * Catches regressions like: subscriptionStartedEmail with a bridge context
 * forgetting to mention sessions remaining, or scheduledSignupConfirmationEmail
 * losing the anchor-label copy.
 */

import {
  subscriptionStartedEmail,
  scheduledSignupConfirmationEmail,
  newSignupAdminEmail,
} from '../src/lib/email-templates.ts'

const results = []
function check(name, body, regex, negate = false) {
  const found = regex.test(body)
  const pass = negate ? !found : found
  results.push({ name, pass })
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : `  → expected ${negate ? 'NOT to match' : 'to match'} ${regex}`}`)
}

console.log('\n──── PHASE 1 — subscriptionStartedEmail with BRIDGE billingContext ────')
{
  const tpl = subscriptionStartedEmail({
    parentName: 'Sarah Tester',
    childName: 'Ollie',
    academyName: 'Jamie Allan Football Academy',
    planName: '1-2-1 - 4 Sessions Per Month',
    amount: '£90.00',
    dashboardUrl: 'https://www.theplayerportal.net/dashboard',
    billingContext: {
      kind: 'bridge',
      sessionsRemaining: 3,
      bridgeUntilLabel: '30 June 2026',
      anchorLabel: '1 July 2026',
      monthlyAmount: '£120.00',
    },
  })
  check('Bridge subject mentions academy', tpl.subject, /Jamie Allan/)
  check('Bridge subject mentions child', tpl.subject, /Ollie is in/)
  check('Bridge body has "Paid today"', tpl.html, /Paid today/)
  check('Bridge body has £90 bridge amount', tpl.html, /£90\.00/)
  check('Bridge body mentions 3 remaining sessions', tpl.html, /3 remaining sessions/)
  check('Bridge body has the until-label', tpl.html, /30 June 2026/)
  check('Bridge body has the anchor-label', tpl.html, /1 July 2026/)
  check('Bridge body has £120 monthly', tpl.html, /£120\.00\/month/)
  check('Bridge body explains 1st-of-month recurrence', tpl.html, /1st of every month/)
  check('Bridge body does NOT show legacy "Charged" single-row', tpl.html, /Charged.*£90/s, true)
}

console.log('\n──── PHASE 2 — subscriptionStartedEmail with PRORATED billingContext ────')
{
  const tpl = subscriptionStartedEmail({
    parentName: 'Sarah Tester',
    childName: 'Ollie',
    academyName: 'Jamie Allan Football Academy',
    planName: '1-2-1 - 4 Sessions Per Month',
    amount: '£113.53',
    dashboardUrl: 'https://www.theplayerportal.net/dashboard',
    billingContext: {
      kind: 'prorated',
      anchorLabel: '1 July 2026',
      monthlyAmount: '£120.00',
    },
  })
  check('Prorated body has "Paid today"', tpl.html, /Paid today/)
  check('Prorated body has £113.53', tpl.html, /£113\.53/)
  check('Prorated body mentions pro-rata', tpl.html, /pro-rata/i)
  check('Prorated body has anchor-label', tpl.html, /1 July 2026/)
  check('Prorated body has £120 monthly', tpl.html, /£120\.00\/month/)
  check('Prorated body does NOT mention "remaining sessions"', tpl.html, /remaining sessions/, true)
}

console.log('\n──── PHASE 3 — subscriptionStartedEmail with NO billingContext (legacy) ────')
{
  const tpl = subscriptionStartedEmail({
    parentName: 'Sarah Tester',
    childName: 'Ollie',
    academyName: 'Jamie Allan Football Academy',
    planName: 'Mini Ballers',
    amount: '£28.00',
    dashboardUrl: 'https://www.theplayerportal.net/dashboard',
  })
  check('Legacy body has "Charged" label', tpl.html, /Charged/)
  check('Legacy body has £28.00', tpl.html, /£28\.00/)
  check('Legacy body does NOT have "Paid today"', tpl.html, /Paid today/, true)
  check('Legacy body does NOT mention bridge/sessions', tpl.html, /remaining sessions/, true)
}

console.log('\n──── PHASE 4 — scheduledSignupConfirmationEmail ────')
{
  const tpl = scheduledSignupConfirmationEmail({
    parentName: 'Sarah Tester',
    childName: 'Ollie',
    academyName: 'Jamie Allan Football Academy',
    planName: 'Unlimited',
    className: 'Open Sessions',
    activatesOnLabel: 'Thu 4 June 2026',
    monthlyAmount: '£70.00',
    anchorLabel: '1 July 2026',
    dashboardUrl: 'https://www.theplayerportal.net/dashboard',
  })
  check('Scheduled subject mentions start date', tpl.subject, /4 June 2026/)
  check('Scheduled subject mentions class name', tpl.subject, /Open Sessions/)
  check('Scheduled body says "card saved" or equivalent', tpl.html, /saved your card/)
  check('Scheduled body has the start date', tpl.html, /Thu 4 June 2026/)
  check('Scheduled body has "No charge today"', tpl.html, /No charge today/i)
  check('Scheduled body has anchor-label', tpl.html, /1 July 2026/)
  check('Scheduled body has £70 monthly', tpl.html, /£70\.00\/month/)
  check('Scheduled body explains 1st-of-month recurrence', tpl.html, /1st of every month/)
}

console.log('\n──── PHASE 5 — newSignupAdminEmail (org admin) ────')
{
  const tpl = newSignupAdminEmail({
    academyName: 'Jamie Allan Football Academy',
    parentName: 'Sarah Tester',
    parentEmail: 'sarah@example.com',
    childName: 'Ollie',
    planName: '1-2-1 - 4 Sessions Per Month',
    amount: '£120.00',
    billingModelLabel: 'Bridge — £90.00 today covers 3 session(s); £120.00/mo from 1 July 2026',
    activatesOnLabel: 'Mon 15 June 2026',
    dashboardUrl: 'https://www.theplayerportal.net',
  })
  check('Admin subject names the child', tpl.subject, /Ollie/)
  check('Admin subject names the plan', tpl.subject, /1-2-1 - 4 Sessions/)
  check('Admin body has parent name', tpl.html, /Sarah Tester/)
  check('Admin body has parent email', tpl.html, /sarah@example\.com/)
  check('Admin body has child name', tpl.html, /Ollie/)
  check('Admin body has plan + amount', tpl.html, /1-2-1.*£120\.00/s)
  check('Admin body has start date', tpl.html, /Mon 15 June 2026/)
  check('Admin body explains billing model', tpl.html, /Bridge.*covers 3 session/s)
  check('Admin body links to dashboard', tpl.html, /\/dashboard\/players/)
}

console.log('\n──── SUMMARY ────')
const passed = results.filter(r => r.pass).length
const failed = results.filter(r => !r.pass).length
console.log(`  ${passed} pass / ${failed} fail / ${results.length} total`)
process.exit(failed > 0 ? 1 : 0)
