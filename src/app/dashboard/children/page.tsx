import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import Card from '@/components/Card'
import EmptyState from '@/components/EmptyState'
import AddChildForm from './AddChildForm'
import ChildEditor from '../account/ChildEditor'
import PhotoUpload from '@/components/PhotoUpload'

export default async function ChildrenPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')

  const { data: profile } = await supabase
    .from('profiles')
    .select('organisation_id')
    .eq('id', user.id)
    .single()

  const orgId = profile?.organisation_id || ''

  const { data: players } = await supabase
    .from('players')
    .select(`
      id, first_name, last_name, date_of_birth, age_group, position, kit_size, school,
      photo_url, medical_info, emergency_contact_name, emergency_contact_phone, notes,
      enrolments(id, status, group:training_groups(name, day_of_week, time_slot, location))
    `)
    .eq('parent_id', user.id)
    .order('first_name')

  type EnrolmentRow = {
    id: string
    status: string
    group: {
      name: string
      day_of_week: string | null
      time_slot: string | null
      location: string | null
    } | null
  }

  return (
    <div className="bg-[#0a0a0a] -m-6 lg:-m-8 p-4 sm:p-6 lg:p-8 min-h-screen text-white">
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">My Children</h1>
      </div>

      <AddChildForm orgId={orgId} />

      {(players || []).length === 0 ? (
        <EmptyState message="No children added yet. Use the form above to add your first child." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(players || []).map((player) => {
            const enrolments =
              (player.enrolments as unknown as EnrolmentRow[]) || []
            const activeGroups = enrolments.filter(
              (e) => e.status === 'active'
            )

            return (
              <Card
                key={player.id}
                action={
                  <Link
                    href={`/dashboard/players/${player.id}`}
                    className="text-sm text-[#4ecde6] hover:underline"
                  >
                    View Profile
                  </Link>
                }
              >
                <div className="space-y-3 text-sm">
                  {/* Photo + Name */}
                  <div className="flex items-center gap-3">
                    <PhotoUpload
                      playerId={player.id}
                      currentPhotoUrl={player.photo_url}
                      firstName={player.first_name}
                      lastName={player.last_name}
                      size="lg"
                    />
                    <div>
                      <Link
                        href={`/dashboard/players/${player.id}`}
                        className="text-base font-semibold hover:text-[#4ecde6] transition-colors"
                      >
                        {player.first_name} {player.last_name}
                      </Link>
                    </div>
                  </div>

                  {/* Badges row */}
                  <div className="flex flex-wrap gap-1.5">
                    {player.age_group && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[#4ecde6]/10 text-[#4ecde6] font-medium">
                        {player.age_group}
                      </span>
                    )}
                    {player.position && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[#4ecde6]/10 text-[#4ecde6] font-medium">
                        {player.position}
                      </span>
                    )}
                    {player.kit_size && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-white/[0.06] text-white/60 font-medium">
                        Kit: {player.kit_size}
                      </span>
                    )}
                  </div>

                  {/* Key info */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {player.date_of_birth && (
                      <div>
                        <span className="text-white/40">DOB:</span>{' '}
                        {new Date(player.date_of_birth).toLocaleDateString()}
                      </div>
                    )}
                    {player.school && (
                      <div>
                        <span className="text-white/40">School:</span>{' '}
                        {player.school}
                      </div>
                    )}
                  </div>

                  {/* Medical alert */}
                  {player.medical_info && (
                    <div className="flex items-start gap-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                      <span className="text-red-400 text-xs">&#9888;&#65039;</span>
                      <p className="text-xs text-red-400">
                        {player.medical_info}
                      </p>
                    </div>
                  )}

                  {/* Emergency contact */}
                  {player.emergency_contact_name && (
                    <div className="text-xs text-white/40">
                      <span className="font-medium text-white">
                        Emergency:
                      </span>{' '}
                      {player.emergency_contact_name}
                      {player.emergency_contact_phone &&
                        ` — ${player.emergency_contact_phone}`}
                    </div>
                  )}

                  {player.notes && (
                    <p className="text-xs text-white/40">
                      <span className="font-medium text-white">Notes:</span>{' '}
                      {player.notes}
                    </p>
                  )}

                  {/* Training groups */}
                  {activeGroups.length > 0 && (
                    <div className="pt-3 border-t border-[#1e1e1e]">
                      <p className="font-medium text-xs mb-2 text-white/40 uppercase tracking-wide">
                        Sessions
                      </p>
                      <div className="space-y-1.5">
                        {activeGroups.map((e) => (
                          <div
                            key={e.id}
                            className="flex items-center justify-between rounded-lg bg-white/[0.04] p-2"
                          >
                            <div>
                              <span className="text-xs font-medium">
                                {e.group?.name}
                              </span>
                              {e.group?.day_of_week && (
                                <span className="text-xs text-white/40 ml-1">
                                  — {e.group.day_of_week}
                                </span>
                              )}
                            </div>
                            {e.group?.time_slot && (
                              <span className="text-xs font-bold text-[#4ecde6]">
                                {e.group.time_slot}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Inline edit for parent-managed fields */}
                  <ChildEditor child={player} />
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
    </div>
  )
}
