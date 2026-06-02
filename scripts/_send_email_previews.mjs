/**
 * Send the 4 email variants to a target inbox so the operator can verify
 * (a) the templates render correctly through Resend, and (b) the wording
 * matches the new billing model.
 *
 * Send target: ADMIN_NOTIFICATION_EMAIL or process.argv[2].
 *
 * Run with:
 *   set -a && source /tmp/.env.prod && set +a && \
 *   npx tsx scripts/_send_email_previews.mjs johnleitch970@gmail.com
 */

import {
  subscriptionStartedEmail,
  scheduledSignupConfirmationEmail,
  newSignupAdminEmail,
} from '../src/lib/email-templates.ts'
import { sendEmail } from '../src/lib/email.ts'

const to = process.argv[2] || process.env.ADMIN_NOTIFICATION_EMAIL || 'johnleitch970@gmail.com'

if (!to || to.length < 5) {
  console.error('No target email. Pass one as the first argument or set ADMIN_NOTIFICATION_EMAIL.')
  process.exit(1)
}

console.log(`Sending 4 preview emails to: ${to}`)

// Each variant gets a [PREVIEW] subject prefix so the operator's inbox doesn't
// confuse them with real signups.
const variants = [
  {
    label: 'Variant 1/4: BRIDGE (subscriptionStartedEmail with bridge billingContext)',
    args: subscriptionStartedEmail({
      parentName: 'Sarah Tester',
      childName: 'Ollie',
      academyName: 'Jamie Allan Football Academy',
      planName: '1-2-1 - 4 Sessions Per Month',
      amount: '£90.00',
      dashboardUrl: 'https://www.theplayerportal.net/dashboard',
      academyContactEmail: 'jamieallan4141@gmail.com',
      billingContext: {
        kind: 'bridge',
        sessionsRemaining: 3,
        bridgeUntilLabel: '30 June 2026',
        anchorLabel: '1 July 2026',
        monthlyAmount: '£120.00',
      },
    }),
  },
  {
    label: 'Variant 2/4: PRORATED (subscriptionStartedEmail with prorated billingContext)',
    args: subscriptionStartedEmail({
      parentName: 'Sarah Tester',
      childName: 'Ollie',
      academyName: 'Jamie Allan Football Academy',
      planName: '1-2-1 - 4 Sessions Per Month',
      amount: '£113.53',
      dashboardUrl: 'https://www.theplayerportal.net/dashboard',
      academyContactEmail: 'jamieallan4141@gmail.com',
      billingContext: {
        kind: 'prorated',
        anchorLabel: '1 July 2026',
        monthlyAmount: '£120.00',
      },
    }),
  },
  {
    label: 'Variant 3/4: SCHEDULED (scheduledSignupConfirmationEmail — calendar setup mode)',
    args: scheduledSignupConfirmationEmail({
      parentName: 'Sarah Tester',
      childName: 'Ollie',
      academyName: 'Jamie Allan Football Academy',
      planName: 'Unlimited',
      className: 'Open Sessions — Monday 5:15',
      activatesOnLabel: 'Thu 4 June 2026',
      monthlyAmount: '£70.00',
      anchorLabel: '1 July 2026',
      dashboardUrl: 'https://www.theplayerportal.net/dashboard',
      academyContactEmail: 'jamieallan4141@gmail.com',
    }),
  },
  {
    label: 'Variant 4/4: ADMIN (newSignupAdminEmail — to org admins, every signup)',
    args: newSignupAdminEmail({
      academyName: 'Jamie Allan Football Academy',
      parentName: 'Sarah Tester',
      parentEmail: 'sarah@example.com',
      childName: 'Ollie',
      planName: '1-2-1 - 4 Sessions Per Month',
      amount: '£120.00',
      billingModelLabel: 'Bridge — £90.00 today covers 3 sessions; £120.00/mo from 1 July 2026',
      activatesOnLabel: 'Mon 15 June 2026',
      dashboardUrl: 'https://www.theplayerportal.net',
    }),
  },
]

let sent = 0, failed = 0
for (const v of variants) {
  const result = await sendEmail({
    to,
    subject: `[PREVIEW] ${v.args.subject}`,
    html: v.args.html,
    fromName: 'Jamie Allan Football Academy',
  })
  if (result.success) {
    sent++
    console.log(`  ✓ ${v.label}`)
    console.log(`    Resend ID: ${result.id || '(skipped — no RESEND_API_KEY)'}`)
    console.log(`    Subject:   ${v.args.subject}`)
  } else {
    failed++
    console.log(`  ✗ ${v.label}`)
    console.log(`    Error: ${JSON.stringify(result.error)}`)
  }
}

console.log(`\nResult: ${sent} sent / ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
