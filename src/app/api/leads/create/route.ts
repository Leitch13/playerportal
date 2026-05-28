import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

/**
 * Public endpoint for creating a lead. Uses the service role key to bypass RLS
 * so unauthenticated visitors (booking page, embed widget) can create leads
 * for an academy.
 *
 * Body shape:
 * {
 *   organisation_id: string (required),
 *   first_name: string (required),
 *   last_name?: string,
 *   email?: string,
 *   phone?: string,
 *   child_name?: string,
 *   child_age?: number,
 *   interested_in?: string,
 *   source?: 'website' | 'facebook' | 'phone' | 'walk_in' | 'referral' | 'manual',
 *   status?: 'new' | 'contacted' | 'trial_booked' | 'trial_attended' | 'enrolled' | 'lost',
 *   notes?: string,
 * }
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const organisation_id = body.organisation_id as string
  const first_name = body.first_name as string

  if (!organisation_id || !first_name) {
    return NextResponse.json(
      { error: 'organisation_id and first_name are required' },
      { status: 400 }
    )
  }

  const source = (body.source as string) || 'website'
  const allowedSources = ['manual', 'facebook', 'website', 'phone', 'walk_in', 'referral']
  if (!allowedSources.includes(source)) {
    return NextResponse.json({ error: 'Invalid source' }, { status: 400 })
  }

  const status = (body.status as string) || 'new'
  const allowedStatuses = ['new', 'contacted', 'trial_booked', 'trial_attended', 'enrolled', 'lost']
  if (!allowedStatuses.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Verify organisation exists (prevents random UUIDs being used to spam-create leads)
  const { data: org, error: orgErr } = await supabase
    .from('organisations')
    .select('id')
    .eq('id', organisation_id)
    .single()

  if (orgErr || !org) {
    return NextResponse.json({ error: 'Organisation not found' }, { status: 404 })
  }

  // De-dupe: if a lead with this email or phone already exists in the last 7 days
  // for the same org, skip creating a duplicate.
  const email = (body.email as string | undefined)?.trim().toLowerCase()
  const phone = (body.phone as string | undefined)?.trim()
  if (email || phone) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    let dupeQuery = supabase
      .from('leads')
      .select('id')
      .eq('organisation_id', organisation_id)
      .gte('created_at', sevenDaysAgo)
      .not('status', 'in', '(enrolled,lost)')
      .limit(1)
    if (email) dupeQuery = dupeQuery.ilike('email', email)
    else if (phone) dupeQuery = dupeQuery.eq('phone', phone)
    const { data: existing } = await dupeQuery
    if (existing && existing.length > 0) {
      return NextResponse.json({ ok: true, deduped: true, id: existing[0].id })
    }
  }

  const { data: inserted, error } = await supabase
    .from('leads')
    .insert({
      organisation_id,
      first_name: first_name.trim(),
      last_name: (body.last_name as string | undefined)?.trim() || null,
      email: email || null,
      phone: phone || null,
      child_name: (body.child_name as string | undefined)?.trim() || null,
      child_age: typeof body.child_age === 'number' ? body.child_age : null,
      interested_in: (body.interested_in as string | undefined)?.trim() || null,
      source,
      status,
      notes: (body.notes as string | undefined)?.trim() || null,
    })
    .select('id')
    .single()

  if (error) {
    console.error('Lead create failed:', error)
    return NextResponse.json({ error: 'Failed to create lead' }, { status: 500 })
  }

  // ── Speed-to-lead alert ──────────────────────────────────────────────────
  // The single biggest driver of conversion is replying fast. Notify staff the
  // instant an inbound enquiry lands — in-app + email — so they can reach out
  // while interest is hot. Skipped for 'manual' (an admin typing in a lead
  // doesn't need to be alerted about their own entry). Best-effort: never block
  // or fail the lead creation on a notification error.
  if (source !== 'manual') {
    try {
      const [{ data: orgInfo }, { data: admins }] = await Promise.all([
        supabase.from('organisations').select('name, contact_email').eq('id', organisation_id).maybeSingle(),
        supabase.from('profiles').select('id, email').eq('organisation_id', organisation_id).eq('role', 'admin'),
      ])

      const leadName = [first_name, body.last_name as string | undefined].filter(Boolean).join(' ').trim() || first_name
      const childName = (body.child_name as string | undefined)?.trim() || undefined
      const interestedIn = (body.interested_in as string | undefined)?.trim() || undefined

      // In-app notification to every admin
      for (const a of (admins || []) as { id: string; email: string | null }[]) {
        await supabase.from('notifications').insert({
          profile_id: a.id,
          organisation_id,
          type: 'lead',
          title: `New enquiry: ${leadName}`,
          body: `${childName ? `${childName} — ` : ''}${interestedIn || 'General enquiry'}. Reply fast to win the booking.`,
          link: '/dashboard/leads',
          is_read: false,
        })
      }

      // Email the academy (contact email if set, else each admin)
      const { newLeadEmail } = await import('@/lib/email-templates')
      const { sendEmail } = await import('@/lib/email')
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://theplayerportal.net'
      const template = newLeadEmail({
        academyName: (orgInfo?.name as string | undefined) || 'your academy',
        leadName,
        email: email || undefined,
        phone: phone || undefined,
        childName,
        interestedIn,
        source,
        dashboardUrl: appUrl,
      })
      const recipients = orgInfo?.contact_email
        ? [orgInfo.contact_email as string]
        : ((admins || []) as { email: string | null }[]).map(a => a.email).filter(Boolean) as string[]
      for (const to of recipients) {
        await sendEmail({ to, ...template, fromName: (orgInfo?.name as string | undefined) || undefined })
      }
    } catch (e) {
      console.error('New-lead alert failed (non-critical):', e)
    }
  }

  return NextResponse.json({ ok: true, id: inserted.id })
}
