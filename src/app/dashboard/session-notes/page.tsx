import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Card from '@/components/Card'
import EmptyState from '@/components/EmptyState'
import type { UserRole } from '@/lib/types'
import SessionNoteForm from './SessionNoteForm'

export default async function SessionNotesPage({
  searchParams,
}: {
  searchParams: Promise<{ add?: string; group?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, organisation_id')
    .eq('id', user.id)
    .single()

  const role = (profile?.role || 'parent') as UserRole
  const isStaff = role === 'admin' || role === 'coach'
  const orgId = profile?.organisation_id || ''

  // Fetch session notes
  let query = supabase
    .from('session_notes')
    .select('*, group:training_groups(name), coach:profiles!session_notes_coach_id_fkey(full_name)')
    .order('session_date', { ascending: false })
    .limit(50)

  if (params.group) {
    query = query.eq('group_id', params.group)
  }

  const { data: notes } = await query

  // Get groups for filter + form
  const { data: groups } = await supabase
    .from('training_groups')
    .select('id, name')
    .order('name')

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Session Notes</h1>

      {/* Add note form (staff only) */}
      {isStaff && (
        <SessionNoteForm
          groups={groups || []}
          coachId={user.id}
          autoOpen={params.add === '1'}
          orgId={orgId}
        />
      )}

      {/* Group filter */}
      {(groups || []).length > 1 && (
        <div className="flex flex-wrap gap-2">
          <a
            href="/dashboard/session-notes"
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              !params.group ? 'bg-primary text-white' : 'bg-surface-dark text-text-light hover:bg-border'
            }`}
          >
            All Groups
          </a>
          {(groups || []).map((g) => (
            <a
              key={g.id}
              href={`/dashboard/session-notes?group=${g.id}`}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                params.group === g.id ? 'bg-primary text-white' : 'bg-surface-dark text-text-light hover:bg-border'
              }`}
            >
              {g.name}
            </a>
          ))}
        </div>
      )}

      {/* Notes list */}
      {(notes || []).length === 0 ? (
        <EmptyState message="No session notes yet." />
      ) : (
        <div className="space-y-3">
          {(notes || []).map((note) => (
            <Card key={note.id}>
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-sm">{note.title || 'Session Note'}</h3>
                    <div className="flex flex-wrap gap-2 mt-0.5">
                      <span className="px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary">
                        {(note.group as unknown as { name: string })?.name}
                      </span>
                      <span className="text-xs text-text-light">
                        {new Date(note.session_date).toLocaleDateString()}
                      </span>
                      <span className="text-xs text-text-light">
                        by {(note.coach as unknown as { full_name: string })?.full_name}
                      </span>
                    </div>
                  </div>
                </div>

                <p className="text-sm whitespace-pre-wrap">{note.notes}</p>

                {note.focus_areas && (
                  <div className="text-sm">
                    <span className="font-medium text-accent">Focus Areas:</span>{' '}
                    <span className="text-text-light">{note.focus_areas}</span>
                  </div>
                )}

                {note.players_of_note && (
                  <div className="text-sm">
                    <span className="font-medium text-primary">Players of Note:</span>{' '}
                    <span className="text-text-light">{note.players_of_note}</span>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
