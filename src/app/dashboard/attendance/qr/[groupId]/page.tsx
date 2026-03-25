import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import QRDisplay from './QRDisplay'

export default async function QRCodePage({
  params,
}: {
  params: Promise<{ groupId: string }>
}) {
  const { groupId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')

  // Verify the user is a coach or admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'coach' && profile.role !== 'admin')) {
    redirect('/dashboard')
  }

  // Load the training group
  const { data: group } = await supabase
    .from('training_groups')
    .select('id, name, day_of_week, time_slot, coach_id')
    .eq('id', groupId)
    .single()

  if (!group) redirect('/dashboard/groups')

  // Get coach name
  let coachName: string | null = null
  if (group.coach_id) {
    const { data: coach } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', group.coach_id)
      .single()
    coachName = coach?.full_name || null
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <QRDisplay
        groupId={group.id}
        groupName={group.name}
        coachName={coachName}
        timeSlot={group.time_slot}
        dayOfWeek={group.day_of_week}
      />
    </div>
  )
}
