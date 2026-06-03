/**
 * Smoke: cancellationAdminNotifyEmail + retentionAcceptedAdminNotifyEmail
 *
 *   set -a && source /tmp/.env.prod && set +a && \
 *   node --experimental-strip-types scripts/_smoke_cancellation_admin_notify.mjs
 *
 * Drives both new admin-facing templates through the real Resend wrapper.
 * No Stripe round-trip; no DB writes.
 */
import { createClient } from '@supabase/supabase-js'
import {
  cancellationAdminNotifyEmail,
  retentionAcceptedAdminNotifyEmail,
} from '../src/lib/email-templates.ts'
import { sendEmail } from '../src/lib/email.ts'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const TARGET = 'johnleitch970+admin1@gmail.com'

const { data: prof } = await sb.from('profiles').select('id, full_name, email, organisation_id').eq('email', TARGET).limit(1).single()
const { data: org } = await sb.from('organisations').select('name').eq('id', prof.organisation_id).single()
console.log('Admin:', prof.full_name, '/', prof.email)
console.log('Org:', org.name)

const dashboardUrl = 'https://theplayerportal.net/dashboard/payments'

console.log('\n[A] Cancellation admin notify — declined save-offer scenario…')
{
  const tpl = cancellationAdminNotifyEmail({
    academyName: org.name,
    parentName: 'Demo Parent',
    parentEmail: 'demo.parent@example.com',
    reasonLabel: 'Too expensive',
    reasonDetail: null,
    offerOutcome: 'declined',
    endDate: '15 July 2026',
    orphaned: false,
    dashboardUrl,
  })
  const res = await sendEmail({ to: prof.email, ...tpl })
  console.log('  ', res.success ? 'OK' : 'FAIL', 'id=' + (res.id || 'n/a'))
}

console.log('\n[B] Cancellation admin notify — orphaned mode-mismatch scenario…')
{
  const tpl = cancellationAdminNotifyEmail({
    academyName: org.name,
    parentName: 'Test Orphan Parent',
    parentEmail: 'test.orphan@example.com',
    reasonLabel: 'Switching to another academy',
    reasonDetail: null,
    offerOutcome: 'not_shown',
    endDate: 'immediately (your subscription was already inactive in our payment system)',
    orphaned: true,
    dashboardUrl,
  })
  const res = await sendEmail({ to: prof.email, ...tpl })
  console.log('  ', res.success ? 'OK' : 'FAIL', 'id=' + (res.id || 'n/a'))
}

console.log('\n[C] Retention accepted admin notify — 50%/1mo accepted…')
{
  const tpl = retentionAcceptedAdminNotifyEmail({
    academyName: org.name,
    parentName: 'Demo Parent',
    parentEmail: 'demo.parent@example.com',
    discountPercent: 50,
    durationLabel: 'one month',
    dashboardUrl,
  })
  const res = await sendEmail({ to: prof.email, ...tpl })
  console.log('  ', res.success ? 'OK' : 'FAIL', 'id=' + (res.id || 'n/a'))
}

console.log('\nDone.')
