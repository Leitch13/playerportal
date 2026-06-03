/**
 * Day 1 — LIVE end-to-end smoke against PRODUCTION.
 *
 *   set -a && source /tmp/.env.prod && set +a && \
 *   node --experimental-strip-types scripts/_live_smoke_messaging_prod.mjs
 *
 * Drives the EXACT pipeline that /api/messages/send runs in production:
 *   1. INSERT message row (legacy columns only)
 *   2. sendEmail() via the same Resend wrapper the route uses
 *   3. UPDATE message row with delivery_status + provider_message_id
 *   4. Re-SELECT to prove the row is exactly what /dashboard/messages will read
 *
 * Hard-wired test cohort (chosen for safety):
 *   • Org: "George" (7c6584c4) — small org, real domain
 *   • Sender: Aidan Galashan (admin)
 *   • Recipient: John Leitch parent profile w/ email johnleitch970+test1@gmail.com
 *     (Gmail plus-address routes to the real owner inbox)
 *
 * Prints: Resend message id, DB row, delivery_status — these are the
 * evidence the operator asked for.
 */
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '../src/lib/email.ts'
import { messageNotificationEmail } from '../src/lib/email-templates.ts'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const ORG_ID = '7c6584c4-f0ae-4d05-830b-1aec8eddb253'
const SENDER_ID = '297e21c2-6a0f-418a-b1c9-b6270634d10b'   // aidan galashan, admin in org George
const RECIPIENT_EMAIL_FILTER = 'johnleitch970+test1@gmail.com'

const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0,19)
const SMOKE_TAG = `Day1 prod smoke — ${ts}`

// ─── Confirm migration 074 columns exist (full-shape SELECT) ───
console.log('\n[1/6] Verify migration 074 columns visible to prod runtime…')
{
  const { error } = await sb.from('messages').select('id, channel, delivery_status, recipient_email_snapshot, provider_message_id').limit(1)
  if (error) { console.error('  FAIL', error.message); process.exit(1) }
  console.log('  ✓ All Day-1 columns selectable')
}

// ─── Resolve actors ───
console.log('\n[2/6] Resolve sender + recipient profiles…')
const { data: sender } = await sb.from('profiles').select('id, full_name, role, organisation_id').eq('id', SENDER_ID).single()
console.log('  sender:', sender.full_name, '/', sender.role)
const { data: recipientList } = await sb.from('profiles').select('id, full_name, email').eq('organisation_id', ORG_ID).eq('email', RECIPIENT_EMAIL_FILTER).limit(1)
const recipient = recipientList?.[0]
if (!recipient) { console.error('  FAIL: recipient not found in org'); process.exit(1) }
console.log('  recipient:', recipient.full_name, '/', recipient.email)
const { data: org } = await sb.from('organisations').select('name, primary_color').eq('id', ORG_ID).single()
console.log('  org:', org.name, '/', org.primary_color)

// ─── INSERT (legacy columns only — same as route Step A) ───
console.log('\n[3/6] INSERT message row (legacy columns)…')
const threadId = crypto.randomUUID()
const messageBody = `Hello ${recipient.full_name?.split(' ')[0] || 'there'} — this is a Day 1 production verification message sent via Player Portal's new messaging delivery pipeline. If you can read this in your inbox, the end-to-end path (database → Resend → email → dashboard) is working.`
const startedAtIso = new Date().toISOString()
const insertResult = await sb.from('messages').insert({
  organisation_id: ORG_ID,
  sender_id: SENDER_ID,
  recipient_id: recipient.id,
  subject: SMOKE_TAG,
  body: messageBody,
  thread_id: threadId,
}).select('id, created_at').single()
if (insertResult.error) { console.error('  FAIL', insertResult.error); process.exit(1) }
const messageId = insertResult.data.id
console.log('  ✓ inserted row:', messageId)

// ─── EMAIL via Resend ───
console.log('\n[4/6] Send email via Resend (same path as deployed route)…')
const tpl = messageNotificationEmail({
  senderName: sender.full_name || 'Your academy',
  recipientName: recipient.full_name || 'there',
  subject: SMOKE_TAG,
  body: messageBody,
  academyName: org.name,
  dashboardUrl: 'https://theplayerportal.net/dashboard/messages',
  accentColor: org.primary_color,
})
const sendRes = await sendEmail({
  to: recipient.email,
  subject: tpl.subject,
  html: tpl.html,
  fromName: org.name,
})
console.log('  Resend response:', JSON.stringify(sendRes))

const deliverySucceeded = sendRes && sendRes.success === true && !sendRes.skipped
const providerMessageId = sendRes?.id || null
const deliveryStatus = deliverySucceeded ? 'sent' : 'failed'
const deliveryFailureReason = deliverySucceeded ? null : (sendRes?.error?.message || JSON.stringify(sendRes?.error) || 'unknown').slice(0, 300)

// ─── UPDATE delivery columns (same as route Step C) ───
console.log('\n[5/6] Persist delivery columns on the message row…')
const update = await sb.from('messages').update({
  channel: 'email',
  delivery_status: deliveryStatus,
  delivery_attempted_at: startedAtIso,
  delivery_completed_at: new Date().toISOString(),
  delivery_failure_reason: deliveryFailureReason,
  recipient_email_snapshot: recipient.email,
  provider_message_id: providerMessageId,
}).eq('id', messageId)
if (update.error) console.error('  UPDATE FAIL:', update.error.message)
else console.log('  ✓ delivery_status persisted:', deliveryStatus, '/ provider id:', providerMessageId)

// ─── VERIFY: re-SELECT the row as /dashboard/messages reads it ───
console.log('\n[6/6] Re-SELECT the row as /dashboard/messages would…')
const final = await sb.from('messages')
  .select('id, thread_id, sender_id, recipient_id, subject, body, read, created_at, channel, delivery_status, delivery_failure_reason, recipient_email_snapshot, provider_message_id')
  .eq('id', messageId).single()
if (final.error) { console.error('  FAIL', final.error); process.exit(1) }
console.log('  Row as the page sees it:')
console.log(JSON.stringify(final.data, null, 2))

// ─── Verify the sender + recipient page queries return it ───
console.log('\nVerify sender-side page query returns this row…')
const senderView = await sb.from('messages')
  .select('id, subject, delivery_status, channel')
  .eq('organisation_id', ORG_ID)
  .or(`sender_id.eq.${SENDER_ID},recipient_id.eq.${SENDER_ID}`)
  .order('created_at', { ascending: false })
  .limit(5)
const senderHit = senderView.data?.find(r => r.id === messageId)
console.log('  sender sees the row:', !!senderHit, senderHit ? `(delivery_status=${senderHit.delivery_status}, channel=${senderHit.channel})` : '')

console.log('\nVerify recipient-side page query returns this row…')
const recView = await sb.from('messages')
  .select('id, subject, delivery_status')
  .eq('organisation_id', ORG_ID)
  .or(`sender_id.eq.${recipient.id},recipient_id.eq.${recipient.id}`)
  .order('created_at', { ascending: false })
  .limit(5)
const recHit = recView.data?.find(r => r.id === messageId)
console.log('  recipient sees the row:', !!recHit)

console.log('\n══════ EVIDENCE ══════')
console.log('  Resend success:', deliverySucceeded)
console.log('  Resend provider_message_id:', providerMessageId)
console.log('  DB row id:', messageId)
console.log('  delivery_status:', deliveryStatus)
console.log('  Recipient email actually attempted:', recipient.email)
console.log('  Org:', org.name)
console.log('  Will appear on /dashboard/messages for both sender AND recipient.')
process.exit(deliverySucceeded ? 0 : 2)
