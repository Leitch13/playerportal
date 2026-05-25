import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'
import { waitlistAcceptedEmail } from '@/lib/email-templates'

export async function POST(request: NextRequest) {
  try {
    const { id } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'Waitlist entry id is required' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Fetch the waitlist entry
    const { data: entry, error: fetchError } = await supabase
      .from('waitlist')
      .select(`
        id, player_id, parent_id, training_group_id, organisation_id, status, expires_at,
        player:players(id, full_name, first_name, last_name),
        parent:profiles!waitlist_parent_id_fkey(full_name, email),
        group:training_groups!waitlist_training_group_id_fkey(id, name)
      `)
      .eq('id', id)
      .single()

    if (fetchError || !entry) {
      return NextResponse.json({ error: 'Waitlist entry not found' }, { status: 404 })
    }

    if (entry.status !== 'offered') {
      return NextResponse.json({ error: `Cannot accept — current status is "${entry.status}"` }, { status: 400 })
    }

    // Check if the offer has expired
    if (entry.expires_at && new Date(entry.expires_at) < new Date()) {
      await supabase.from('waitlist').update({ status: 'expired' }).eq('id', id)
      return NextResponse.json({ error: 'This offer has expired' }, { status: 410 })
    }

    // Create the enrolment
    const { error: enrolError } = await supabase
      .from('enrolments')
      .insert({
        player_id: entry.player_id,
        group_id: entry.training_group_id,
        status: 'active',
        organisation_id: entry.organisation_id,
      })

    if (enrolError) {
      return NextResponse.json({ error: 'Failed to create enrolment' }, { status: 500 })
    }

    // Update waitlist entry to accepted
    await supabase.from('waitlist').update({ status: 'accepted' }).eq('id', id)

    // Send confirmation email
    const parent = entry.parent as unknown as { full_name: string; email: string } | null
    const player = entry.player as unknown as { full_name?: string; first_name?: string; last_name?: string } | null
    const group = entry.group as unknown as { name: string } | null

    if (parent?.email) {
      const parentName = parent.full_name?.split(' ')[0] || 'there'
      const childName = player?.full_name || `${player?.first_name || ''} ${player?.last_name || ''}`.trim() || 'your child'
      const className = group?.name || 'the class'

      const template = waitlistAcceptedEmail({ parentName, childName, className })
      await sendEmail({ to: parent.email, ...template })
    }

    return NextResponse.json({ success: true, enrolment_created: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Also support GET for email link clicks — redirect to dashboard after processing
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://theplayerportal.net'

  if (!id) {
    return NextResponse.redirect(`${appUrl}/dashboard/waitlist?error=missing_id`)
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Fetch the waitlist entry
  const { data: entry } = await supabase
    .from('waitlist')
    .select(`
      id, player_id, parent_id, training_group_id, organisation_id, status, expires_at,
      player:players(id, full_name, first_name, last_name),
      parent:profiles!waitlist_parent_id_fkey(full_name, email),
      group:training_groups!waitlist_training_group_id_fkey(id, name)
    `)
    .eq('id', id)
    .single()

  if (!entry) {
    return NextResponse.redirect(`${appUrl}/dashboard/waitlist?error=not_found`)
  }

  if (entry.status !== 'offered') {
    return NextResponse.redirect(`${appUrl}/dashboard/waitlist?error=status_${entry.status}`)
  }

  if (entry.expires_at && new Date(entry.expires_at) < new Date()) {
    await supabase.from('waitlist').update({ status: 'expired' }).eq('id', id)
    return NextResponse.redirect(`${appUrl}/dashboard/waitlist?error=expired`)
  }

  // Create enrolment
  await supabase.from('enrolments').insert({
    player_id: entry.player_id,
    group_id: entry.training_group_id,
    status: 'active',
    organisation_id: entry.organisation_id,
  })

  // Update waitlist
  await supabase.from('waitlist').update({ status: 'accepted' }).eq('id', id)

  // Send confirmation email
  const parent = entry.parent as unknown as { full_name: string; email: string } | null
  const player = entry.player as unknown as { full_name?: string; first_name?: string; last_name?: string } | null
  const group = entry.group as unknown as { name: string } | null

  if (parent?.email) {
    const { waitlistAcceptedEmail } = await import('@/lib/email-templates')
    const template = waitlistAcceptedEmail({
      parentName: parent.full_name?.split(' ')[0] || 'there',
      childName: player?.full_name || `${player?.first_name || ''} ${player?.last_name || ''}`.trim() || 'your child',
      className: group?.name || 'the class',
    })
    await sendEmail({ to: parent.email, ...template })
  }

  return NextResponse.redirect(`${appUrl}/dashboard/waitlist?accepted=true`)
}
