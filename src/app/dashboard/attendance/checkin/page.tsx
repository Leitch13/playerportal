import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Card from '@/components/Card'
import CheckInForm from './CheckInForm'

export default async function CheckInPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; group?: string }>
}) {
  const { token, group: groupId } = await searchParams

  if (!token || !groupId) {
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center">
        <Card>
          <div className="py-8">
            <div className="text-5xl mb-4">&#128683;</div>
            <h2 className="text-lg font-semibold text-text">Invalid QR Code</h2>
            <p className="text-sm text-text-light mt-1">
              This check-in link is invalid or has expired. Please scan the QR code again.
            </p>
          </div>
        </Card>
      </div>
    )
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/auth/signin?redirect=/dashboard/attendance/checkin?token=${token}&group=${groupId}`)

  // Load the training group
  const { data: group } = await supabase
    .from('training_groups')
    .select('id, name, organisation_id')
    .eq('id', groupId)
    .single()

  if (!group) {
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center">
        <Card>
          <div className="py-8">
            <div className="text-5xl mb-4">&#128528;</div>
            <h2 className="text-lg font-semibold text-text">Group Not Found</h2>
            <p className="text-sm text-text-light mt-1">
              This training group could not be found. Please ask your coach for a new QR code.
            </p>
          </div>
        </Card>
      </div>
    )
  }

  // Get this parent's children who are enrolled in this group
  const { data: players } = await supabase
    .from('players')
    .select('id, first_name, last_name')
    .eq('parent_id', user.id)

  const playerIds = (players || []).map((p) => p.id)

  let enrolledChildren: { id: string; first_name: string; last_name: string }[] = []

  if (playerIds.length > 0) {
    const { data: enrolments } = await supabase
      .from('enrolments')
      .select('player_id')
      .eq('training_group_id', groupId)
      .in('player_id', playerIds)
      .eq('status', 'active')

    const enrolledIds = new Set((enrolments || []).map((e) => e.player_id))
    enrolledChildren = (players || []).filter((p) => enrolledIds.has(p.id))
  }

  const sessionDate = new Date().toISOString().split('T')[0]

  return (
    <div className="max-w-md mx-auto py-8 px-4">
      <Card>
        <CheckInForm
          children={enrolledChildren}
          groupId={groupId}
          groupName={group.name}
          sessionDate={sessionDate}
          orgId={group.organisation_id}
        />
      </Card>
    </div>
  )
}
