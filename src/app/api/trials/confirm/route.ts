import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimit } from '@/lib/rate-limit'
import { clientIpOf } from '@/lib/booking-guard'
import { alertAcademyOfTrial } from '@/lib/trial-alerts'
import { CONFIRMED_ACTION, findPending, linkExpired, datePassed } from '@/lib/trial-email-confirm'

export const dynamic = 'force-dynamic'

/**
 * The parent pressed "Confirm my trial" on the page their email link opened.
 * Only now is the trial booked, the academy told, the lead made and the
 * "you're booked" email sent. See src/lib/trial-email-confirm.ts.
 *
 * Answers: { state: 'confirmed' | 'already' | 'expired' | 'date_passed' | 'full' | 'not_found' }
 */
const db = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

export async function POST(request: NextRequest) {
  const ip = clientIpOf(request.headers)
  if (!rateLimit(`trial-confirm:${ip}`, 20, 3600000).success) {
    return NextResponse.json({ error: 'Too many tries. Please wait a few minutes.' }, { status: 429 })
  }
  let token = ''
  try {
    token = String((await request.json())?.token || '')
  } catch {
    return NextResponse.json({ state: 'not_found' }, { status: 400 })
  }

  const sb = db()
  const pending = await findPending(sb, token)
  if (!pending) return NextResponse.json({ state: 'not_found' }, { status: 404 })
  if (pending.confirmedTrialId) return NextResponse.json({ state: 'already', trialId: pending.confirmedTrialId })
  if (linkExpired(pending.createdAt)) return NextResponse.json({ state: 'expired' })
  const t = pending.trial
  if (datePassed(t.sessionDate)) return NextResponse.json({ state: 'date_passed' })

  // Same parent, child and class already booked (e.g. they booked twice and tapped both emails).
  if (t.groupId) {
    const { data: existing } = await sb
      .from('trial_bookings')
      .select('id')
      .eq('organisation_id', t.orgId)
      .eq('training_group_id', t.groupId)
      .ilike('parent_email', t.email)
      .ilike('child_name', t.childName)
      .in('status', ['confirmed', 'pending', 'attended'])
      .limit(1)
      .maybeSingle()
    if (existing) {
      await markConfirmed(sb, pending.hash, existing.id as string, t.orgId)
      return NextResponse.json({ state: 'already', trialId: existing.id })
    }
  }

  const { data: row, error } = await sb
    .from('trial_bookings')
    .insert({
      organisation_id: t.orgId,
      training_group_id: t.groupId,
      parent_name: t.parentName,
      parent_email: t.email,
      parent_phone: t.phone,
      child_name: t.childName,
      child_age: t.childAge,
      preferred_date: t.sessionDate,
      notes: t.notes,
      terms_accepted_at: t.termsAcceptedAt,
      terms_version_hash: t.termsVersionHash,
      trial_source: t.trialSource,
      source_detail: t.sourceDetail,
      referrer_url: t.referrerUrl,
    })
    .select('id')
    .single()

  if (error) {
    // The database refuses a trial for a full day (supabase/123_trial_needs_a_place.sql).
    if (/class_full/.test(error.message)) return NextResponse.json({ state: 'full' })
    console.error('[trials/confirm] insert failed', error.message)
    return NextResponse.json({ error: 'We couldn’t confirm your trial just now. Please try again.' }, { status: 500 })
  }

  // Record the tap first, so a double tap can never make two trials.
  await markConfirmed(sb, pending.hash, row.id as string, t.orgId)
  try {
    await sb.from('audit_log').insert({
      organisation_id: t.orgId,
      action: 'trial.booked',
      entity_type: 'trial_booking',
      entity_id: row.id,
      ip_address: t.ip,
      details: { confirmed_by_email: true, confirm_ip: ip === 'unknown' ? null : ip },
    })
  } catch { /* the booking stands */ }

  // The academy is told now, not before (John's rule: the academy is always told).
  try {
    await alertAcademyOfTrial(sb, row.id as string)
  } catch (e) {
    console.error('[trials/confirm] academy alert failed', e)
  }

  // The parent's "you're booked" email.
  try {
    const { sendEmail } = await import('@/lib/email')
    const { trialConfirmationEmail } = await import('@/lib/email-templates')
    await sendEmail({
      to: t.email,
      fromName: t.orgName,
      ...trialConfirmationEmail({ parentName: t.parentName, childName: t.childName, academyName: t.orgName, className: t.className ?? undefined, date: t.sessionDate ?? undefined }),
    })
  } catch (e) {
    console.error('[trials/confirm] booked email failed', e)
  }

  // The lead, for the academy's pipeline.
  try {
    const [firstName, ...rest] = t.parentName.split(/\s+/)
    const since = new Date(Date.now() - 7 * 86400000).toISOString()
    const { data: dupe } = await sb.from('leads').select('id').eq('organisation_id', t.orgId).gte('created_at', since)
      .not('status', 'in', '(enrolled,lost)').ilike('email', t.email).limit(1)
    if (!dupe || dupe.length === 0) {
      await sb.from('leads').insert({
        organisation_id: t.orgId,
        first_name: firstName,
        last_name: rest.join(' ') || null,
        email: t.email,
        phone: t.phone,
        child_name: t.childName,
        child_age: t.childAge,
        interested_in: t.className,
        source: 'website',
        status: 'trial_booked',
        notes: t.notes,
      })
    }
  } catch (e) {
    console.error('[trials/confirm] lead row failed', e)
  }

  return NextResponse.json({ state: 'confirmed', trialId: row.id })
}

async function markConfirmed(sb: ReturnType<typeof db>, hash: string, trialId: string, orgId: string) {
  try {
    await sb.from('audit_log').insert({
      organisation_id: orgId,
      action: CONFIRMED_ACTION,
      entity_type: 'trial_booking',
      entity_id: trialId,
      details: { token_hash: hash },
    })
  } catch { /* the booking stands */ }
}
