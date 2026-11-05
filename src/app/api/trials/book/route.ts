import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimit } from '@/lib/rate-limit'
import { checkLeadEmail } from '@/lib/lead-email-checks'
import { checkSignupIp } from '@/lib/ip-reputation'
import { checkBookingDetails, clientIpOf } from '@/lib/booking-guard'

/**
 * Every free trial from a booking page is saved here, on the server, after the
 * door checks. Before 5 Nov 2026 the form saved straight from the browser and a
 * fake "A / a@gmail.com" trial reached Pro Football Coaching (the same pattern
 * hit Talent on 7 Sep and WLFA on 7 Oct). See src/lib/booking-guard.ts.
 *
 * Refused attempts are written to the audit log (trial.refused, with the IP)
 * and John is emailed, so whoever is probing can be seen.
 */

const ALERTS_TO = 'johnleitch970@gmail.com'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PER_IP_PER_HOUR = 3

const db = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

const s = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

async function refuse(
  sb: ReturnType<typeof db>,
  orgId: string | null,
  orgName: string,
  ip: string,
  reason: string,
  message: string,
  body: Record<string, string>,
  extra: Record<string, unknown> = {},
) {
  try {
    await sb.from('audit_log').insert({
      organisation_id: orgId,
      action: 'trial.refused',
      entity_type: 'trial_booking',
      ip_address: ip === 'unknown' ? null : ip,
      details: { reason, ...body, ...extra },
    })
  } catch { /* never change the answer because logging failed */ }
  try {
    const { sendEmail } = await import('@/lib/email')
    const esc = (x: string) => x.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]!))
    await sendEmail({
      to: ALERTS_TO,
      subject: `Blocked trial booking at ${orgName}: ${reason}`,
      html: `<p>A trial booking was turned away before it was saved.</p>
<ul>
<li>Academy: <strong>${esc(orgName)}</strong></li>
<li>Parent: ${esc(body.parentName || '—')} · ${esc(body.email || '—')} · ${esc(body.phone || '—')}</li>
<li>Child: ${esc(body.childName || '—')}</li>
<li>Why: ${esc(reason)}</li>
<li>IP: ${esc(ip)}${extra.isp ? ` (${esc(String(extra.isp))}, ${esc(String(extra.country || '?'))})` : ''}</li>
</ul>
<p>Nothing reached the academy. The person was shown: “${esc(message)}”</p>`,
    })
  } catch (e) {
    console.error('[trials/book] alert failed', e)
  }
  return NextResponse.json({ error: message }, { status: 400 })
}

export async function POST(request: NextRequest) {
  const ip = clientIpOf(request.headers)
  if (!rateLimit(`trial-book:${ip}`, 6, 3600000).success) {
    return NextResponse.json({ error: 'Too many bookings from this connection. Please try again later.' }, { status: 429 })
  }

  let raw: Record<string, unknown>
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }

  const orgId = s(raw.orgId, 40)
  const groupId = s(raw.groupId, 40) || null
  if (!UUID.test(orgId) || (groupId && !UUID.test(groupId))) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }
  const body = {
    parentName: s(raw.parentName, 120),
    email: s(raw.parentEmail, 200).toLowerCase(),
    phone: s(raw.phone, 40),
    childName: s(raw.childName, 120),
  }
  const childAge = Number.isFinite(Number(raw.childAge)) && s(String(raw.childAge ?? '')) ? Math.round(Number(raw.childAge)) : null
  const sessionDate = s(raw.sessionDate, 10)
  if (sessionDate && !/^\d{4}-\d{2}-\d{2}$/.test(sessionDate)) {
    return NextResponse.json({ error: 'Please pick a date for the trial.' }, { status: 400 })
  }
  if (raw.agreedToTerms !== true) {
    return NextResponse.json({ error: 'Please tick to confirm you’ve read the Terms & Conditions.' }, { status: 400 })
  }
  // Hidden field a person never sees; a script that fills every box fills it.
  if (s(raw.website)) {
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 400 })
  }

  const sb = db()
  const { data: org } = await sb.from('organisations').select('id,name,is_published,terms_text').eq('id', orgId).maybeSingle()
  if (!org || !org.is_published) return NextResponse.json({ error: 'This academy isn’t taking bookings.' }, { status: 404 })
  if (groupId) {
    const { data: g } = await sb.from('training_groups').select('id').eq('id', groupId).eq('organisation_id', orgId).maybeSingle()
    if (!g) return NextResponse.json({ error: 'That class isn’t available. Please pick another.' }, { status: 400 })
  }
  const orgName = String(org.name || 'an academy')

  // 1. The details themselves.
  const detailProblem = checkBookingDetails(body)
  if (detailProblem) return refuse(sb, orgId, orgName, ip, 'details look fake', detailProblem, body)

  // 2. Throwaway inboxes, typo domains, domains with no mail server.
  const emailProblem = await checkLeadEmail(body.email, 'your booking confirmation')
  if (emailProblem) return refuse(sb, orgId, orgName, ip, 'email can’t receive mail', emailProblem, body)

  // 3. VPN / datacentre connections (fails open on lookup trouble).
  const verdict = await checkSignupIp(ip)
  if (verdict.block) {
    return refuse(
      sb, orgId, orgName, ip, `booked through a ${verdict.reason}`,
      'It looks like you’re booking through a VPN or a hosting network. Please turn it off and try again.',
      body, { isp: verdict.isp, country: verdict.country },
    )
  }

  // 4. Several bookings from one connection in an hour (survives server restarts).
  if (ip !== 'unknown') {
    const { count } = await sb
      .from('audit_log')
      .select('id', { count: 'exact', head: true })
      .eq('action', 'trial.booked')
      .eq('ip_address', ip)
      .gte('created_at', new Date(Date.now() - 3600000).toISOString())
    if ((count ?? 0) >= PER_IP_PER_HOUR) {
      return refuse(sb, orgId, orgName, ip, 'too many bookings from one connection',
        'Too many bookings from this connection. Please try again later, or contact the academy.', body,
        { isp: verdict.isp, country: verdict.country })
    }
  }

  // 5. The same child booked onto the same class trial already.
  if (groupId) {
    const { data: existing } = await sb
      .from('trial_bookings')
      .select('id')
      .eq('organisation_id', orgId)
      .eq('training_group_id', groupId)
      .ilike('parent_email', body.email)
      .ilike('child_name', body.childName)
      .in('status', ['confirmed', 'pending', 'attended'])
      .limit(1)
      .maybeSingle()
    if (existing) return NextResponse.json({ error: "You've already booked this trial — check your email for the confirmation." }, { status: 409 })
  }

  // Which version of the academy's terms they accepted (same hash the form used to make).
  const txt = (org.terms_text as string | null) || ''
  let h = 5381
  for (let i = 0; i < txt.length; i++) h = ((h << 5) + h) ^ txt.charCodeAt(i)
  const versionHash = (h >>> 0).toString(16) + '-' + txt.length

  const { data: row, error } = await sb
    .from('trial_bookings')
    .insert({
      organisation_id: orgId,
      training_group_id: groupId,
      parent_name: body.parentName,
      parent_email: body.email,
      parent_phone: body.phone,
      child_name: body.childName,
      child_age: childAge,
      preferred_date: sessionDate || null,
      notes: s(raw.notes, 2000) || null,
      terms_accepted_at: new Date().toISOString(),
      terms_version_hash: versionHash,
      trial_source: s(raw.trialSource, 60) || null,
      source_detail: s(raw.sourceDetail, 300) || null,
      referrer_url: s(raw.referrerUrl, 500) || null,
    })
    .select('id')
    .single()

  if (error) {
    // The database refuses a trial for a full day (supabase/123_trial_needs_a_place.sql).
    const msg = /class_full/.test(error.message)
      ? 'Sorry, that day is now full. Please pick another date, or join the class waiting list.'
      : 'We couldn’t save your booking. Please try again.'
    if (!/class_full/.test(error.message)) console.error('[trials/book] insert failed', error.message)
    return NextResponse.json({ error: msg }, { status: /class_full/.test(error.message) ? 409 : 500 })
  }

  try {
    await sb.from('audit_log').insert({
      organisation_id: orgId,
      action: 'trial.booked',
      entity_type: 'trial_booking',
      entity_id: row.id,
      ip_address: ip === 'unknown' ? null : ip,
      details: { country: verdict.country ?? null, isp: verdict.isp ?? null },
    })
  } catch { /* the booking stands */ }

  return NextResponse.json({ ok: true, id: row.id })
}
