import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email'
import { bookingConfirmationEmail } from '@/lib/email-templates'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { playerId, groupId } = await request.json()
  if (!playerId || !groupId) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  // Get player + parent
  const { data: player } = await supabase
    .from('players')
    .select('first_name, last_name, parent_id')
    .eq('id', playerId)
    .single()

  // Get parent profile
  const { data: parent } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', user.id)
    .single()

  // Get class details
  const { data: group } = await supabase
    .from('training_groups')
    .select('name, day_of_week, time_slot, location, organisation_id')
    .eq('id', groupId)
    .single()

  // Get org name
  const { data: org } = group?.organisation_id
    ? await supabase.from('organisations').select('name').eq('id', group.organisation_id).single()
    : { data: null }

  if (!parent?.email || !player || !group) {
    return NextResponse.json({ error: 'Data not found' }, { status: 404 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  const template = bookingConfirmationEmail({
    parentName: parent.full_name?.split(' ')[0] || 'there',
    childName: `${player.first_name} ${player.last_name}`,
    className: group.name,
    dayTime: `${group.day_of_week || 'TBA'} ${group.time_slot || ''}`.trim(),
    location: group.location || 'TBA',
    academyName: org?.name || 'Your Academy',
    dashboardUrl: `${appUrl}/dashboard/schedule`,
  })

  const result = await sendEmail({ to: parent.email, ...template })

  // Also create in-app notification
  await supabase.from('notifications').insert({
    profile_id: user.id,
    organisation_id: group.organisation_id,
    type: 'booking',
    title: `${player.first_name} booked into ${group.name}`,
    body: `${group.day_of_week || ''} ${group.time_slot || ''} at ${group.location || 'TBA'}`,
    link: '/dashboard/schedule',
  })

  // Check if this is their only enrolment — if so, schedule "add another class" upsell
  const { count: enrolCount } = await supabase
    .from('enrolments')
    .select('id', { count: 'exact', head: true })
    .eq('player_id', playerId)
    .eq('status', 'active')

  if ((enrolCount || 0) === 1) {
    // Only in 1 class — create upsell notification for 2 days from now
    await supabase.from('notifications').insert({
      profile_id: user.id,
      organisation_id: group.organisation_id,
      type: 'upsell',
      title: `Add another class for ${player.first_name}?`,
      body: `${player.first_name} is doing great in ${group.name}! Add a second class and get 15% off.`,
      link: '/dashboard/schedule',
    })
  }

  return NextResponse.json({ sent: true, emailResult: result })
}
