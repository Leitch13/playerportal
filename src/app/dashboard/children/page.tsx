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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Children</h1>
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
                    className="text-sm text-accent hover:underline"
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
                        className="text-base font-semibold hover:text-accent transition-colors"
                      >
                        {player.first_name} {player.last_name}
                      </Link>
                    </div>
                  </div>

                  {/* Badges row */}
                  <div className="flex flex-wrap gap-1.5">
                    {player.age_group && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                        {player.age_group}
                      </span>
                    )}
                    {player.position && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent font-medium">
                        {player.position}
                      </span>
                    )}
                    {player.kit_size && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-surface-dark font-medium">
                        Kit: {player.kit_size}
                      </span>
                    )}
                  </div>

                  {/* Key info */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {player.date_of_birth && (
                      <div>
                        <span className="text-text-light">DOB:</span>{' '}
                        {new Date(player.date_of_birth).toLocaleDateString()}
                      </div>
                    )}
                    {player.school && (
                      <div>
                        <span className="text-text-light">School:</span>{' '}
                        {player.school}
                      </div>
                    )}
                  </div>

                  {/* Medical alert */}
                  {player.medical_info && (
                    <div className="flex items-start gap-2 p-2 rounded-lg bg-danger/5 border border-danger/10">
                      <span className="text-danger text-xs">⚠️</span>
                      <p className="text-xs text-danger">
                        {player.medical_info}
                      </p>
                    </div>
                  )}

                  {/* Emergency contact */}
                  {player.emergency_contact_name && (
                    <div className="text-xs text-text-light">
                      <span className="font-medium text-text">
                        Emergency:
                      </span>{' '}
                      {player.emergency_contact_name}
                      {player.emergency_contact_phone &&
                        ` — ${player.emergency_contact_phone}`}
                    </div>
                  )}

                  {player.notes && (
                    <p className="text-xs text-text-light">
                      <span className="font-medium text-text">Notes:</span>{' '}
                      {player.notes}
                    </p>
                  )}

                  {/* Training groups */}
                  {activeGroups.length > 0 && (
                    <div className="pt-3 border-t border-border">
                      <p className="font-medium text-xs mb-2 text-text-light uppercase tracking-wide">
                        Sessions
                      </p>
                      <div className="space-y-1.5">
                        {activeGroups.map((e) => (
                          <div
                            key={e.id}
                            className="flex items-center justify-between rounded-lg bg-surface p-2"
                          >
                            <div>
                              <span className="text-xs font-medium">
                                {e.group?.name}
                              </span>
                              {e.group?.day_of_week && (
                                <span className="text-xs text-text-light ml-1">
                                  — {e.group.day_of_week}
                                </span>
                              )}
                            </div>
                            {e.group?.time_slot && (
                              <span className="text-xs font-bold text-accent">
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
  )
}
