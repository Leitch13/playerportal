import { redirect } from 'next/navigation'
import Link from 'next/link'
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
    <div className="bg-[#0a0a0a] -m-6 lg:-m-8 p-4 sm:p-6 lg:p-8 min-h-screen text-white max-w-2xl mx-auto">
      {/* Sprint 11a — Back to live register link. Hidden in fullscreen
          via the .no-print + QRDisplay's own fullscreen background. */}
      <div className="no-print mb-3" data-testid="qr-back-to-live-register">
        <Link
          href={`/dashboard/attendance/register/${group.id}`}
          className="inline-flex items-center gap-2 text-sm text-white/65 hover:text-white transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to live register
        </Link>
      </div>
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
