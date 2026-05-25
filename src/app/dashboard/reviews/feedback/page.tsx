import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireFeature } from '@/lib/features'

export default async function ReviewFeedbackPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')
  await requireFeature('progress_reviews')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, organisation_id')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  const orgId = profile.organisation_id

  // Fetch all review prompts for this org
  const { data: prompts } = await supabase
    .from('review_prompts')
    .select('id, status, rating, feedback, created_at, player:players(first_name, last_name), parent:profiles(full_name, email)')
    .eq('organisation_id', orgId)
    .order('created_at', { ascending: false })

  const allPrompts = prompts || []
  const total = allPrompts.length
  const happy = allPrompts.filter((p) => p.status === 'happy' || p.status === 'reviewed').length
  const unhappy = allPrompts.filter((p) => p.status === 'unhappy').length
  const reviewed = allPrompts.filter((p) => p.status === 'reviewed').length
  const dismissed = allPrompts.filter((p) => p.status === 'dismissed').length
  const pending = allPrompts.filter((p) => p.status === 'pending').length

  const happyPct = total > 0 ? Math.round((happy / total) * 100) : 0
  const unhappyPct = total > 0 ? Math.round((unhappy / total) * 100) : 0
  const reviewedPct = total > 0 ? Math.round((reviewed / total) * 100) : 0

  const unhappyFeedback = allPrompts.filter((p) => p.status === 'unhappy' && p.feedback)

  // Check if google_review_url is set
  const { data: org } = await supabase
    .from('organisations')
    .select('google_review_url')
    .eq('id', orgId)
    .single()

  const hasGoogleUrl = !!org?.google_review_url

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Review Prompts</h1>
          <p className="text-[#888] text-sm mt-1">Track parent satisfaction and Google reviews</p>
        </div>
        {!hasGoogleUrl && (
          <Link
            href="/dashboard/settings"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 text-amber-400 text-sm font-semibold border border-amber-500/20 hover:bg-amber-500/20 transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Set Google Review URL in Settings
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total Prompted', value: total, color: 'text-[#4ecde6]' },
          { label: 'Happy', value: `${happyPct}%`, color: 'text-green-400' },
          { label: 'Unhappy', value: `${unhappyPct}%`, color: 'text-red-400' },
          { label: 'Left Review', value: `${reviewedPct}%`, color: 'text-amber-400' },
          { label: 'Pending', value: pending, color: 'text-white/60' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-[#141414] border border-[#1e1e1e] rounded-2xl p-4"
          >
            <p className="text-xs text-white/40 font-medium">{stat.label}</p>
            <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Unhappy Feedback to Action */}
      {unhappyFeedback.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-red-400 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Feedback Requiring Attention
          </h2>
          <div className="space-y-2">
            {unhappyFeedback.map((p) => {
              const player = p.player as unknown as { first_name: string; last_name: string } | null
              const parent = p.parent as unknown as { full_name: string; email: string } | null
              return (
                <div
                  key={p.id}
                  className="bg-[#141414] border border-red-500/20 rounded-2xl p-5 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {parent?.full_name || 'Parent'} — re: {player?.first_name} {player?.last_name}
                      </p>
                      <p className="text-xs text-white/40 mt-0.5">
                        Rating: {p.rating}/5 &middot;{' '}
                        {new Date(p.created_at).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                    {parent?.email && (
                      <a
                        href={`mailto:${parent.email}`}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#4ecde6]/10 text-[#4ecde6] hover:bg-[#4ecde6]/20 transition-colors"
                      >
                        Reply
                      </a>
                    )}
                  </div>
                  <p className="text-sm text-white/70 bg-[#1a1a1a] rounded-xl p-3 border border-[#2a2a2a]">
                    {p.feedback}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* All Prompts Table */}
      <div className="bg-[#141414] border border-[#1e1e1e] rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-[#1e1e1e]">
          <h2 className="font-bold text-sm">All Review Prompts</h2>
        </div>
        {allPrompts.length === 0 ? (
          <div className="p-8 text-center text-white/40 text-sm">
            No review prompts yet. Prompts are automatically created after a child completes 10 sessions.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1e1e1e] text-left text-xs text-white/40">
                  <th className="p-3 font-medium">Parent</th>
                  <th className="p-3 font-medium">Child</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3 font-medium">Rating</th>
                  <th className="p-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {allPrompts.map((p) => {
                  const player = p.player as unknown as { first_name: string; last_name: string } | null
                  const parent = p.parent as unknown as { full_name: string; email: string } | null
                  const statusColors: Record<string, string> = {
                    pending: 'bg-white/[0.05] text-white/50',
                    happy: 'bg-green-500/20 text-green-400',
                    unhappy: 'bg-red-500/20 text-red-400',
                    reviewed: 'bg-amber-500/20 text-amber-400',
                    dismissed: 'bg-white/[0.05] text-white/30',
                  }
                  return (
                    <tr key={p.id} className="border-b border-[#1e1e1e] hover:bg-[#1a1a1a] transition-colors">
                      <td className="p-3 text-white/80">{parent?.full_name || '—'}</td>
                      <td className="p-3 text-white/80">{player?.first_name} {player?.last_name}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${statusColors[p.status] || ''}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="p-3 text-white/60">{p.rating ? `${p.rating}/5` : '—'}</td>
                      <td className="p-3 text-white/40 text-xs">
                        {new Date(p.created_at).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
