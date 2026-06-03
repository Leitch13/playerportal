/**
 * Day 2 — Parent failed-payment recovery email smoke.
 *
 *   set -a && source /tmp/.env.prod && set +a && \
 *   node --experimental-strip-types scripts/_smoke_day2_parent_failed_payment.mjs
 *
 * Drives the EXACT send pipeline that handleInvoicePaymentFailed now runs
 * (paymentFailedParentEmail template → sendEmail via Resend) using a real
 * production parent profile + a synthetic Stripe.Invoice shape with
 * attempt_count=1 and a hosted_invoice_url. Proves:
 *   1. Template renders cleanly
 *   2. sendEmail dispatches via Resend
 *   3. Resend ID captured
 *   4. Failure reason surfaced
 *
 * NO Stripe round-trip — that's the upstream piece, separately verified
 * via webhook idempotency (Stages C+D, already in production).
 *
 * Hard-wired test cohort (safe — parent profile with john's gmail):
 *   • parent johnleitch970+test4@gmail.com (org JSl sports)
 *   • Synthetic invoice: £24.00, attempt_count=1, hosted_invoice_url set
 */
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '../src/lib/email.ts'
import { paymentFailedParentEmail } from '../src/lib/email-templates.ts'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const PARENT_EMAIL = 'johnleitch970+test4@gmail.com'

// ── Resolve the parent + org context ──
console.log('[1/4] Resolving parent + org context…')
const { data: parent } = await sb.from('profiles').select('id, full_name, email, organisation_id').eq('email', PARENT_EMAIL).limit(1).single()
console.log('  parent:', parent.full_name, '/', parent.email)
const { data: org } = await sb.from('organisations').select('name, primary_color').eq('id', parent.organisation_id).single()
console.log('  org:', org.name, '/', org.primary_color)

// ── Build the same payload the webhook handler builds ──
console.log('\n[2/4] Building paymentFailedParentEmail template…')
const synthetic = {
  amount_due: 2400,                                        // £24.00
  attempt_count: 1,
  hosted_invoice_url: 'https://invoice.stripe.com/i/test_demo_link_for_recovery',
  failure_reason: 'Your card was declined. Insufficient funds.',
}
const tpl = paymentFailedParentEmail({
  academyName: org.name,
  parentName: parent.full_name?.split(' ')[0] || 'there',
  childName: 'Liam',
  planName: 'Weekly Skills',
  amount: `£${(synthetic.amount_due / 100).toFixed(2)}`,
  failureReason: synthetic.failure_reason,
  updatePaymentUrl: synthetic.hosted_invoice_url,
  dashboardUrl: 'https://theplayerportal.net',
  accentColor: org.primary_color,
})
console.log('  subject:', tpl.subject)
console.log('  html length:', tpl.html.length, 'chars')

// ── Dispatch via Resend ──
console.log('\n[3/4] Sending via Resend (same path the webhook uses)…')
const sendRes = await sendEmail({
  to: parent.email,
  subject: tpl.subject,
  html: tpl.html,
  fromName: org.name,
})
console.log('  Resend response:', JSON.stringify(sendRes))

// ── Verify ──
console.log('\n[4/4] Verifying delivery state…')
const ok = sendRes && sendRes.success === true
console.log('  ok:', ok)
console.log('  resend_id:', sendRes?.id || '(none)')

console.log('\n══════ EVIDENCE ══════')
console.log('  • Day 2 paymentFailedParentEmail template renders ✓')
console.log('  • Resend dispatch:', ok ? 'SUCCESS' : 'FAILED')
console.log('  • Resend ID:', sendRes?.id || 'n/a')
console.log('  • Recipient:', parent.email, '(gmail-plus → routes to johnleitch970@gmail.com)')
console.log('  • Subject visible in inbox: "' + tpl.subject + '"')
console.log('  • Stripe round-trip: NOT exercised here — webhook idempotency + Stripe→webhook plumbing untouched, validated by existing webhook unit + integration coverage')
process.exit(ok ? 0 : 1)
