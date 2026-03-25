import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Card from '@/components/Card'
import EmptyState from '@/components/EmptyState'
import type { UserRole } from '@/lib/types'
import DocumentManager from './DocumentManager'

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ player?: string; folder?: string; add?: string }>
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

  // Build query
  let query = supabase
    .from('documents')
    .select('*, player:players(first_name, last_name), uploader:profiles!documents_uploaded_by_fkey(full_name)')
    .order('created_at', { ascending: false })

  if (params.player) {
    query = query.eq('player_id', params.player)
  }
  if (params.folder && params.folder !== 'all') {
    query = query.eq('folder', params.folder)
  }

  const { data: documents } = await query

  // Get unique folders for filter
  const { data: allDocs } = await supabase
    .from('documents')
    .select('folder')

  const folders = [...new Set((allDocs || []).map((d) => d.folder as string))].filter(Boolean).sort()
  const activeFolder = params.folder || 'all'

  // Get players and parents for the form
  const { data: players } = isStaff
    ? await supabase.from('players').select('id, first_name, last_name, parent_id').order('first_name')
    : { data: await supabase.from('players').select('id, first_name, last_name, parent_id').eq('parent_id', user.id).order('first_name').then(r => r.data) }

  const docTypeIcons: Record<string, string> = {
    canva: '🎨',
    pdf: '📄',
    image: '🖼️',
    video: '🎥',
    link: '🔗',
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Documents</h1>

      {/* Add document form (staff only) */}
      {isStaff && (
        <DocumentManager
          players={players || []}
          userId={user.id}
          autoOpen={params.add === '1'}
          defaultPlayerId={params.player || ''}
          orgId={orgId}
        />
      )}

      {/* Folder filter */}
      {folders.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <a
            href="/dashboard/documents"
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              activeFolder === 'all' ? 'bg-primary text-white' : 'bg-surface-dark text-text-light hover:bg-border'
            }`}
          >
            All
          </a>
          {folders.map((f) => (
            <a
              key={f}
              href={`/dashboard/documents?folder=${encodeURIComponent(f)}`}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                activeFolder === f ? 'bg-primary text-white' : 'bg-surface-dark text-text-light hover:bg-border'
              }`}
            >
              {f}
            </a>
          ))}
        </div>
      )}

      {/* Documents list */}
      {(documents || []).length === 0 ? (
        <EmptyState message="No documents yet." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(documents || []).map((doc) => (
            <Card key={doc.id}>
              <div className="flex items-start gap-3">
                <span className="text-2xl">{docTypeIcons[doc.doc_type as string] || '📁'}</span>
                <div className="flex-1 min-w-0">
                  <a
                    href={doc.url as string}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-sm text-primary hover:underline block truncate"
                  >
                    {doc.title}
                  </a>
                  {doc.description && <p className="text-xs text-text-light mt-0.5">{doc.description as string}</p>}
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    <span className="px-2 py-0.5 rounded-full text-xs bg-surface-dark text-text-light">{doc.folder as string}</span>
                    {(doc.player as unknown as { first_name: string; last_name: string }) && (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary">
                        {(doc.player as unknown as { first_name: string; last_name: string }).first_name}{' '}
                        {(doc.player as unknown as { first_name: string; last_name: string }).last_name}
                      </span>
                    )}
                    <span className="text-xs text-text-light">{new Date(doc.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
