import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AnnouncementComposer from './AnnouncementComposer'
import AnnouncementFeed from './AnnouncementFeed'

export default async function AnnouncementsPage() {
  const supabase = await createClient()
  const { data: role } = await supabase.rpc('get_my_role')
  if (!role) redirect('/dashboard')

  const { data: orgId } = await supabase.rpc('get_my_org')
  const isAdmin = ['admin', 'coach'].includes(role)

  const { data: { user } } = await supabase.auth.getUser()

  // Fetch announcements
  const query = supabase
    .from('announcements')
    .select('*, author:profiles!announcements_author_id_fkey(full_name), group:training_groups(name)')
    .eq('organisation_id', orgId)
    .order('created_at', { ascending: false })

  if (!isAdmin) {
    query.eq('status', 'sent')
  }

  const { data: announcements } = await query

  // Fetch read status for current user
  const { data: reads } = await supabase
    .from('announcement_reads')
    .select('announcement_id')
    .eq('profile_id', user?.id || '')

  const readSet = new Set((reads || []).map(r => r.announcement_id))

  // Fetch read counts for admin
  let readCounts = new Map<string, number>()
  if (isAdmin) {
    const { data: allReads } = await supabase
      .from('announcement_reads')
      .select('announcement_id')

    for (const r of allReads || []) {
      readCounts.set(r.announcement_id, (readCounts.get(r.announcement_id) || 0) + 1)
    }
  }

  // Get parent count for read stats
  const { count: parentCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('organisation_id', orgId)
    .eq('role', 'parent')

  // Get groups for targeting
  const { data: groups } = await supabase
    .from('training_groups')
    .select('id, name')
    .eq('organisation_id', orgId)
    .order('name')

  const formattedAnnouncements = (announcements || []).map(a => ({
    id: a.id,
    title: a.title,
    body: a.body,
    audience: a.audience,
    groupName: (a.group as unknown as { name: string } | null)?.name || null,
    priority: a.priority,
    status: a.status,
    sentAt: a.sent_at,
    createdAt: a.created_at,
    authorName: (a.author as unknown as { full_name: string } | null)?.full_name || 'Unknown',
    isRead: readSet.has(a.id),
    readCount: readCounts.get(a.id) || 0,
  }))

  if (isAdmin) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Announcements</h1>
            <p className="text-text-light text-sm mt-1">Communicate with parents</p>
          </div>
        </div>

        <AnnouncementComposer
          orgId={orgId}
          authorId={user?.id || ''}
          groups={(groups || []).map(g => ({ id: g.id, name: g.name }))}
        />

        <div className="space-y-3">
          {formattedAnnouncements.map(a => (
            <div key={a.id} className={`bg-white rounded-2xl border p-5 ${
              a.priority === 'urgent' ? 'border-l-4 border-l-red-500 border-border' :
              a.priority === 'important' ? 'border-l-4 border-l-orange-500 border-border' :
              'border-border'
            }`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold">{a.title}</h3>
                    {a.status === 'draft' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500">DRAFT</span>
                    )}
                    {a.priority !== 'normal' && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                        a.priority === 'urgent' ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600'
                      }`}>
                        {a.priority}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-text-light whitespace-pre-wrap">{a.body}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-text-light">
                    <span>By {a.authorName}</span>
                    {a.groupName && <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">{a.groupName}</span>}
                    <span>{new Date(a.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-primary">{a.readCount}/{parentCount || 0}</p>
                  <p className="text-[10px] text-text-light">read</p>
                </div>
              </div>
            </div>
          ))}
          {formattedAnnouncements.length === 0 && (
            <div className="bg-white rounded-2xl border border-border p-12 text-center">
              <p className="text-4xl mb-3">📢</p>
              <p className="font-semibold">No announcements yet</p>
              <p className="text-sm text-text-light mt-1">Create your first announcement above</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Parent view
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Announcements</h1>
        <p className="text-text-light text-sm mt-1">News and updates from your academy</p>
      </div>
      <AnnouncementFeed
        announcements={formattedAnnouncements}
        userId={user?.id || ''}
      />
    </div>
  )
}
