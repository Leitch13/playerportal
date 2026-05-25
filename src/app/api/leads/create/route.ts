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

  return NextResponse.json({ ok: true, id: inserted.id })
}
