/**
 * Sprint follow-up — proof that all 4 platform-billing emails render +
 * dispatch via real Resend.
 *
 *   set -a && source /tmp/.env.prod && set +a && \
 *   node --experimental-strip-types scripts/_smoke_platform_billing_emails.mjs
 *
 * Drives each template + sendEmail directly (same imports the webhook
 * helpers use) against the real Resend infrastructure. Recipient is the
 * johnleitch970+admin1@gmail.com admin profile (gmail-plus routes to the
 * real owner inbox). No Stripe round-trip.
 *
 * Proves:
 *   1. All four templates render cleanly
 *   2. All four dispatch via Resend (returns id)
 *   3. Each email is recognisable by subject
 *
 * Stripe Connect parent-billing flow is UNTOUCHED — no API calls made
 * against subscribe/route.ts, no Stripe Connect math executed here.
 */
import { createClient } from '@supabase/supabase-js'
import {
  platformSubscriptionActivatedEmail,
  platformPaymentFailedEmail,
  platformCancellationConfirmEmail,
  platformPaymentRecoveredEmail,
} from '../src/lib/email-templates.ts'
import { sendEmail } from '../src/lib/email.ts'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const TARGET_EMAIL = 'johnleitch970+admin1@gmail.com'

console.log('\nResolving target admin profile…')
const { data: profile } = await sb.from('profiles')
  .select('id, full_name, email, organisation_id')
  .eq('email', TARGET_EMAIL).limit(1).single()
console.log('  admin:', profile.full_name, '/', profile.email)
const { data: org } = await sb.from('organisations')
  .select('name, primary_color, platform_plan_id').eq('id', profile.organisation_id).single()
console.log('  org:', org.name, '/', org.platform_plan_id || '(no plan id)')

const planInfo = org.platform_plan_id ? await sb.from('platform_plans')
  .select('name, monthly_price')
  .eq('id', org.platform_plan_id).maybeSingle() : { data: null }
const planName = planInfo.data?.name || 'Starter'
const monthlyPrice = Number(planInfo.data?.monthly_price ?? 20)
console.log('  plan:', planName, '/ £' + monthlyPrice.toFixed(2))

const dashboardUrl = 'https://theplayerportal.net'
const adminFirstName = (profile.full_name || '').split(' ')[0] || 'there'

const results = []
async function send(name, tpl) {
  const res = await sendEmail({ to: profile.email, ...tpl })
  const ok = !!(res && res.success)
  results.push({ email: name, ok, resendId: res?.id || null, subject: tpl.subject })
  console.log(`  [${ok ? 'OK' : 'FAIL'}] ${name}: resend_id=${res?.id || 'none'}`)
}

console.log('\n[#3] Subscription activated…')
await send('#3 Subscription activated', platformSubscriptionActivatedEmail({
  academyName: org.name,
  adminFirstName,
  planName,
  monthlyAmount: `£${monthlyPrice.toFixed(2)}`,
  nextBillingDate: new Date(Date.now() + 30 * 86400e3).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
  dashboardUrl,
}))

console.log('\n[#8] Platform payment failed…')
await send('#8 Platform payment failed', platformPaymentFailedEmail({
  academyName: org.name,
  adminFirstName,
  planName,
  amount: `£${monthlyPrice.toFixed(2)}`,
  failureReason: 'Your card was declined. (Test scenario — your card is fine.)',
  updatePaymentUrl: 'https://invoice.stripe.com/i/test_demo_update_link',
  dashboardUrl,
}))

console.log('\n[#9] Platform cancellation confirmation…')
await send('#9 Cancellation confirmation', platformCancellationConfirmEmail({
  academyName: org.name,
  adminFirstName,
  planName,
  endDate: new Date(Date.now() + 30 * 86400e3).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
  dashboardUrl,
}))

console.log('\n[#11] Platform payment recovered…')
await send('#11 Payment recovered', platformPaymentRecoveredEmail({
  academyName: org.name,
  adminFirstName,
  planName,
  dashboardUrl,
}))

console.log('\n══════ SUMMARY ══════')
for (const r of results) {
  console.log(`  ${r.ok ? '✓' : '✗'} ${r.email.padEnd(34)} resend_id=${r.resendId || 'n/a'}`)
}
const allOk = results.every(r => r.ok)
console.log(allOk ? '\nAll 4 platform-billing emails dispatched successfully.' : '\nSome sends failed.')
console.log('Subjects to look for in johnleitch970@gmail.com inbox:')
for (const r of results) console.log('  • ' + r.subject)
process.exit(allOk ? 0 : 1)
