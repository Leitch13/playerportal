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
    const sentCount = formattedAnnouncements.filter(a => a.status !== 'draft').length
    const totalReads = formattedAnnouncements.reduce((s, a) => s + a.readCount, 0)
    const avgReach = sentCount > 0 && (parentCount || 0) > 0
      ? Math.round((totalReads / (sentCount * (parentCount || 1))) * 100)
      : 0
    return (
      <div className="bg-[#0a0a0a] -m-6 lg:-m-8 p-6 lg:p-8 min-h-screen text-white">
      <div className="space-y-6">
        {/* Hero */}
        <div className="flex items-start gap-3">
          <span className="w-11 h-11 rounded-xl bg-[#4ecde6]/15 border border-[#4ecde6]/30 flex items-center justify-center text-2xl shrink-0" aria-hidden>📢</span>
          <div>
            <h1 className="text-2xl font-bold text-white">Announcements</h1>
            <p className="text-white/60 text-sm mt-0.5">Broadcast news, updates and alerts to your parents.</p>
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-4">
            <p className="text-xs text-white/50">Published</p>
            <p className="text-2xl font-bold mt-0.5">{sentCount}</p>
          </div>
          <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-4">
            <p className="text-xs text-white/50">Parents reached</p>
            <p className="text-2xl font-bold mt-0.5 text-[#4ecde6]">{parentCount || 0}</p>
          </div>
          <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-4">
            <p className="text-xs text-white/50">Avg. read rate</p>
            <p className="text-2xl font-bold mt-0.5">{avgReach}%</p>
          </div>
        </div>

        <AnnouncementComposer
          orgId={orgId}
          authorId={user?.id || ''}
          groups={(groups || []).map(g => ({ id: g.id, name: g.name }))}
        />

        <div className="space-y-3">
          {formattedAnnouncements.map(a => {
            const urgent = a.priority === 'urgent'
            const important = a.priority === 'important'
            const total = parentCount || 0
            const pct = total > 0 ? Math.min(100, Math.round((a.readCount / total) * 100)) : 0
            return (
            <div key={a.id} className={`relative overflow-hidden bg-white/[0.05] backdrop-blur-xl rounded-2xl border p-5 transition-all hover:bg-white/[0.07] ${
              urgent ? 'border-l-4 border-l-red-500 border-white/[0.08]' :
              important ? 'border-l-4 border-l-orange-500 border-white/[0.08]' :
              'border-white/[0.08]'
            } ${a.status === 'draft' ? 'opacity-75' : ''}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <h3 className="font-bold text-white">{a.title}</h3>
                    {a.status === 'draft' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-white/[0.08] text-white/60 border border-white/[0.12]">Draft</span>
                    )}
                    {a.priority !== 'normal' && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                        urgent ? 'bg-red-500/15 text-red-300 border-red-500/30' : 'bg-orange-500/15 text-orange-300 border-orange-500/30'
                      }`}>
                        {a.priority}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-white/80 whitespace-pre-wrap leading-relaxed">{a.body}</p>
                  <div className="flex items-center gap-2.5 mt-3 text-xs text-white/45">
                    <span>By {a.authorName}</span>
                    {a.groupName && <span className="px-2 py-0.5 rounded-full bg-[#4ecde6]/10 text-[#4ecde6] border border-[#4ecde6]/25 font-medium">{a.groupName}</span>}
                    <span>{new Date(a.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
                {a.status !== 'draft' && (
                  <div className="shrink-0 w-24 text-right">
                    <p className="text-sm font-bold text-white">{a.readCount}<span className="text-white/40 font-medium">/{total}</span></p>
                    <p className="text-[10px] text-white/40 mb-1.5">read</p>
                    <div className="h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                      <div className="h-full rounded-full bg-[#4ecde6] transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )}
              </div>
            </div>
            )
          })}
          {formattedAnnouncements.length === 0 && (
            <div className="bg-white/[0.05] backdrop-blur-xl rounded-2xl border border-white/[0.08] p-12 text-center">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-[#4ecde6]/15 border border-[#4ecde6]/30 flex items-center justify-center text-2xl mb-3" aria-hidden>📢</div>
              <p className="font-semibold text-white">No announcements yet</p>
              <p className="text-sm text-white/50 mt-1">Create your first announcement above.</p>
            </div>
          )}
        </div>
      </div>
      </div>
    )
  }

  // Parent view
  return (
    <div className="bg-[#0a0a0a] -m-6 lg:-m-8 p-6 lg:p-8 min-h-screen text-white">
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <span className="w-11 h-11 rounded-xl bg-[#4ecde6]/15 border border-[#4ecde6]/30 flex items-center justify-center text-2xl shrink-0" aria-hidden>📢</span>
        <div>
          <h1 className="text-2xl font-bold text-white">Announcements</h1>
          <p className="text-white/60 text-sm mt-0.5">News and updates from your academy.</p>
        </div>
      </div>
      <AnnouncementFeed
        announcements={formattedAnnouncements}
        userId={user?.id || ''}
      />
    </div>
    </div>
  )
}
