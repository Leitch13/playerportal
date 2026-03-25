import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function ClassBookingPage({
  params,
}: {
  params: Promise<{ slug: string; groupId: string }>
}) {
  const { slug, groupId } = await params
  const supabase = await createClient()

  // Get org
  const { data: org } = await supabase
    .from('organisations')
    .select('*')
    .ilike('slug', slug)
    .single()

  if (!org) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#060606] text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Academy Not Found</h1>
          <p className="text-white/50">This page doesn&apos;t exist.</p>
        </div>
      </div>
    )
  }

  // Get the specific class
  const { data: group } = await supabase
    .from('training_groups')
    .select('id, name, day_of_week, time_slot, location, max_capacity, age_group, description, price_per_session, coach:profiles!training_groups_coach_id_fkey(full_name)')
    .eq('id', groupId)
    .eq('organisation_id', org.id)
    .single()

  if (!group) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#060606] text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Class Not Found</h1>
          <p className="text-white/50 mb-4">This class doesn&apos;t exist or has been removed.</p>
          <Link href={`/book/${slug}`} className="text-[#4ecde6] underline">
            View all classes &rarr;
          </Link>
        </div>
      </div>
    )
  }

  // Get enrolment count
  const { count } = await supabase
    .from('enrolments')
    .select('id', { count: 'exact', head: true })
    .eq('group_id', groupId)
    .eq('status', 'active')

  const enrolled = count || 0
  const capacity = group.max_capacity || 20
  const spotsLeft = capacity - enrolled
  const isFull = spotsLeft <= 0
  const coach = group.coach as unknown as { full_name: string } | null
  const primaryColor = org.primary_color || '#4ecde6'
  const price = (group as unknown as { price_per_session: number | null }).price_per_session

  return (
    <div className="min-h-screen bg-[#060606] text-white">
      {/* Nav */}
      <nav className="glass-dark border-b border-white/[0.06] sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href={`/book/${slug}`} className="flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            All Classes
          </Link>
          <span className="text-sm font-semibold" style={{ color: primaryColor }}>{org.name}</span>
        </div>
      </nav>

      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#060606] via-[#0f172a] to-[#060606]" />
        <div className="absolute top-10 left-1/4 w-[400px] h-[400px] rounded-full blur-[150px] animate-glow" style={{ background: `${primaryColor}15` }} />

        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 pt-16 pb-12 text-center">
          {/* Age group badge */}
          {(group as unknown as { age_group: string | null }).age_group && (
            <div className="inline-flex px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-4 border" style={{ borderColor: `${primaryColor}40`, color: primaryColor, background: `${primaryColor}10` }}>
              {(group as unknown as { age_group: string }).age_group}
            </div>
          )}

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-3">{group.name}</h1>

          <div className="flex flex-wrap items-center justify-center gap-4 text-white/50 text-sm mb-6">
            <span className="flex items-center gap-1.5" style={{ color: primaryColor }}>
              <span className="font-semibold">{group.day_of_week || 'TBA'}</span>
            </span>
            {group.time_slot && <span>{group.time_slot}</span>}
            {group.location && <span>📍 {group.location}</span>}
            {coach?.full_name && <span>👤 {coach.full_name}</span>}
          </div>

          {(group as unknown as { description: string | null }).description && (
            <p className="text-white/40 max-w-xl mx-auto leading-relaxed mb-8">
              {(group as unknown as { description: string }).description}
            </p>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-20">
        {/* Stats cards */}
        <div className="grid grid-cols-3 gap-3 mb-10">
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 text-center">
            <div className="text-2xl font-extrabold" style={{ color: isFull ? '#ef4444' : primaryColor }}>
              {isFull ? 'FULL' : spotsLeft}
            </div>
            <div className="text-xs text-white/40 mt-1">{isFull ? 'Waitlist open' : 'Spots left'}</div>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 text-center">
            <div className="text-2xl font-extrabold">{enrolled}</div>
            <div className="text-xs text-white/40 mt-1">Enrolled</div>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 text-center">
            <div className="text-2xl font-extrabold">{capacity}</div>
            <div className="text-xs text-white/40 mt-1">Max capacity</div>
          </div>
        </div>

        {/* Capacity bar */}
        <div className="mb-10">
          <div className="flex items-center justify-between text-xs text-white/40 mb-2">
            <span>{enrolled} of {capacity} places filled</span>
            <span>{Math.round((enrolled / capacity) * 100)}%</span>
          </div>
          <div className="w-full bg-white/[0.06] rounded-full h-3">
            <div
              className="h-3 rounded-full transition-all"
              style={{
                width: `${Math.min(100, (enrolled / capacity) * 100)}%`,
                backgroundColor: isFull ? '#ef4444' : spotsLeft <= 3 ? '#f97316' : primaryColor,
              }}
            />
          </div>
        </div>

        {/* Price */}
        {price && Number(price) > 0 && (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 mb-8 text-center">
            <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Price per session</div>
            <div className="text-3xl font-extrabold" style={{ color: primaryColor }}>
              &pound;{Number(price).toFixed(2)}
            </div>
          </div>
        )}

        {/* CTAs */}
        <div className="space-y-3">
          <Link
            href={isFull ? `/auth/signup?org=${slug}&class=${groupId}` : `/book/${slug}/class/${groupId}/quick-book`}
            className="block w-full text-center py-4 rounded-2xl font-bold text-lg transition-all hover:scale-[1.01]"
            style={{
              backgroundColor: isFull ? '#1e293b' : primaryColor,
              color: isFull ? '#94a3b8' : '#0a0a0a',
            }}
          >
            {isFull ? 'Join Waitlist' : 'Sign Up & Book This Class'} &rarr;
          </Link>

          <Link
            href={`/book/${slug}/trial`}
            className="block w-full text-center py-4 rounded-2xl font-semibold text-lg border border-white/15 text-white/70 hover:bg-white/5 hover:text-white transition-all"
          >
            Book a Free Trial First
          </Link>
        </div>

        {/* Academy info */}
        <div className="mt-12 pt-8 border-t border-white/[0.06] text-center">
          <p className="text-white/30 text-sm mb-3">Part of</p>
          <Link
            href={`/book/${slug}`}
            className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors"
          >
            <span className="text-lg font-bold">{org.name}</span>
            <span className="text-xs">&rarr;</span>
          </Link>
          {(org.contact_email || org.contact_phone) && (
            <div className="flex flex-wrap gap-4 justify-center mt-3 text-xs text-white/30">
              {org.contact_email && <span>✉️ {org.contact_email}</span>}
              {org.contact_phone && <span>📞 {org.contact_phone}</span>}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-6 text-center text-xs text-white/20">
        Powered by Player Portal
      </footer>
    </div>
  )
}
