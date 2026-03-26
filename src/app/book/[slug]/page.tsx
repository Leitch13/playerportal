import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import PricingToggle from './PricingToggle'

const CLASS_TYPE_CONFIG: Record<string, { label: string; gradient: string; color: string; icon: string }> = {
  group: { label: 'Group', gradient: 'from-blue-600 to-blue-900', color: '#3b82f6', icon: '&#9917;' },
  small_group: { label: 'Small Group', gradient: 'from-purple-600 to-purple-900', color: '#a855f7', icon: '&#127942;' },
  '1-2-1': { label: '1-2-1', gradient: 'from-amber-500 to-amber-800', color: '#f59e0b', icon: '&#11088;' },
  '2-1': { label: '2-1 Pair', gradient: 'from-orange-500 to-orange-800', color: '#f97316', icon: '&#129309;' },
  gk: { label: 'Goalkeeper', gradient: 'from-yellow-500 to-yellow-800', color: '#eab308', icon: '&#129349;' },
  soccer_tots: { label: 'Soccer Tots', gradient: 'from-pink-500 to-pink-800', color: '#ec4899', icon: '&#127880;' },
  academy: { label: 'Academy', gradient: 'from-indigo-600 to-indigo-900', color: '#6366f1', icon: '&#127941;' },
  accelerator: { label: 'Accelerator', gradient: 'from-rose-600 to-rose-900', color: '#f43f5e', icon: '&#128640;' },
  elite: { label: 'Elite', gradient: 'from-violet-600 to-violet-900', color: '#8b5cf6', icon: '&#128081;' },
  camp: { label: 'Camp', gradient: 'from-green-600 to-green-900', color: '#22c55e', icon: '&#127957;' },
  trial: { label: 'Trial', gradient: 'from-cyan-600 to-cyan-900', color: '#06b6d4', icon: '&#127919;' },
  girls: { label: 'Girls Only', gradient: 'from-fuchsia-600 to-fuchsia-900', color: '#d946ef', icon: '&#9734;' },
  adults: { label: 'Adults', gradient: 'from-slate-600 to-slate-800', color: '#64748b', icon: '&#127939;' },
}

export default async function PublicBookingPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: org } = await supabase
    .from('organisations')
    .select('*')
    .ilike('slug', slug)
    .single()

  if (!org) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Academy Not Found</h1>
          <p className="text-text-light">This booking page doesn&apos;t exist.</p>
        </div>
      </div>
    )
  }

  const { data: groups } = await supabase
    .from('training_groups')
    .select('id, name, day_of_week, time_slot, location, max_capacity, coach:profiles!training_groups_coach_id_fkey(full_name), class_type, is_featured, price_per_session, age_group, short_description')
    .eq('organisation_id', org.id)
    .order('name')

  const groupIds = (groups || []).map((g) => g.id)
  const { data: enrolments } = groupIds.length > 0
    ? await supabase
        .from('enrolments')
        .select('group_id')
        .in('group_id', groupIds)
        .eq('status', 'active')
    : { data: [] as { group_id: string }[] }

  const countByGroup = new Map<string, number>()
  for (const e of enrolments || []) {
    countByGroup.set(e.group_id, (countByGroup.get(e.group_id) || 0) + 1)
  }

  const { data: plans } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('organisation_id', org.id)
    .eq('active', true)
    .order('sort_order')

  const today = new Date().toISOString().split('T')[0]
  const { data: camps } = await supabase
    .from('camps')
    .select('id')
    .eq('organisation_id', org.id)
    .eq('is_published', true)
    .gte('end_date', today)
    .limit(1)

  const hasCamps = (camps || []).length > 0

  const { data: events } = await supabase
    .from('events')
    .select('*')
    .eq('organisation_id', org.id)
    .eq('active', true)
    .gte('end_date', today)
    .order('start_date')

  const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  const sortedGroups = [...(groups || [])].sort((a, b) => {
    const aFeat = (a.is_featured as boolean) ? 0 : 1
    const bFeat = (b.is_featured as boolean) ? 0 : 1
    if (aFeat !== bFeat) return aFeat - bFeat
    const dayA = DAY_ORDER.indexOf(a.day_of_week || '')
    const dayB = DAY_ORDER.indexOf(b.day_of_week || '')
    return (dayA === -1 ? 99 : dayA) - (dayB === -1 ? 99 : dayB)
  })

  const primaryColor = org.primary_color || '#4ecde6'

  // Convert hex to r,g,b for CSS variable
  const hexToRgb = (hex: string) => {
    const h = hex.replace('#', '')
    const num = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16)
    return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`
  }

  return (
    <div
      className="min-h-screen bg-white"
      style={{ '--brand-primary': primaryColor, '--brand-primary-rgb': hexToRgb(primaryColor), '--color-accent': primaryColor } as React.CSSProperties}
    >
      <div className="relative py-12 sm:py-20 px-4 sm:px-6 text-center text-white" style={{ background: `linear-gradient(135deg, #0a0a0a 0%, ${primaryColor} 100%)` }}>
        {org.hero_image_url && (<div className="absolute inset-0 bg-cover bg-center opacity-20" style={{ backgroundImage: `url(${org.hero_image_url})` }} />)}
        <div className="relative z-10 max-w-3xl mx-auto">
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold mb-4">{org.name}</h1>
          {org.description && <p className="text-lg text-white/80 mb-6">{org.description}</p>}
          <Link href={`/auth/signup?org=${slug}`} className="inline-block px-8 py-3 rounded-full text-lg font-semibold transition-transform hover:scale-105" style={{ backgroundColor: primaryColor, color: '#0a0a0a' }}>Join Now &rarr;</Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-10 sm:space-y-16">
        {(plans || []).length > 0 && (
          <section>
            <h2 className="text-2xl font-bold text-center mb-2">Our Plans</h2>
            <p className="text-center text-gray-500 mb-8">Choose the plan that works for your child</p>
            <PricingToggle plans={(plans || []).map(plan => ({ id: plan.id, name: plan.name, description: plan.description as string | null, amount: Number(plan.amount), sessions_per_week: plan.sessions_per_week }))} slug={slug} primaryColor={primaryColor} />
          </section>
        )}

        <section>
          <h2 className="text-2xl font-bold text-center mb-2">Weekly Classes</h2>
          <p className="text-center text-gray-500 mb-8">Our regular training schedule</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {sortedGroups.map((group) => {
              const count = countByGroup.get(group.id) || 0
              const capacity = (group as unknown as { max_capacity: number }).max_capacity || 20
              const spotsLeft = capacity - count
              const isFull = spotsLeft <= 0
              const coach = group.coach as unknown as { full_name: string } | null
              const classType = (group.class_type as string) || 'group'
              const typeConfig = CLASS_TYPE_CONFIG[classType] || CLASS_TYPE_CONFIG.group
              const isFeatured = group.is_featured as boolean
              const price = group.price_per_session as number | null
              const ageGroup = group.age_group as string | null
              const shortDesc = group.short_description as string | null

              return (
                <div key={group.id} className={`relative rounded-2xl overflow-hidden border transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${isFeatured ? 'border-2 shadow-lg' : 'border-gray-200 hover:border-gray-300'}`} style={isFeatured ? { borderColor: `${primaryColor}60`, boxShadow: `0 0 0 1px ${primaryColor}20` } : undefined}>
                  <div className={`relative h-28 bg-gradient-to-br ${typeConfig.gradient} flex items-end p-4`}>
                    <div className="absolute top-3 right-3 w-16 h-16 rounded-full bg-white/10 blur-xl" />
                    <div className="absolute top-2 right-4 text-2xl opacity-30" dangerouslySetInnerHTML={{ __html: typeConfig.icon }} />
                    {isFeatured && (
                      <div className="absolute top-3 left-3 flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white text-[10px] font-bold uppercase tracking-wider">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                        Featured
                      </div>
                    )}
                    <div className="relative z-10 flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/20 backdrop-blur-md text-white border border-white/20">{typeConfig.label}</span>
                      {ageGroup && <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/20 backdrop-blur-md text-white border border-white/20">{ageGroup}</span>}
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-bold text-base leading-tight">{group.name}</h3>
                      {price != null && Number(price) > 0 && (
                        <span className="shrink-0 text-lg font-extrabold whitespace-nowrap" style={{ color: primaryColor }}>&pound;{Number(price).toFixed(0)}<span className="text-xs font-medium text-gray-400">/session</span></span>
                      )}
                    </div>
                    {shortDesc && <p className="text-xs text-gray-500 mb-3 line-clamp-2">{shortDesc}</p>}
                    <div className="space-y-1.5 text-sm text-gray-600 mb-4">
                      <div className="flex items-center gap-2">
                        <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                        <span className="font-semibold" style={{ color: primaryColor }}>{group.day_of_week || 'TBA'}</span>
                        {group.time_slot && <span className="text-gray-400">{group.time_slot}</span>}
                      </div>
                      {group.location && (
                        <div className="flex items-center gap-2">
                          <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                          <span>{group.location}</span>
                        </div>
                      )}
                      {coach?.full_name && (
                        <div className="flex items-center gap-2">
                          <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                          <span>Coach {coach.full_name}</span>
                        </div>
                      )}
                    </div>
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-1.5">
                        {isFull ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">Class Full</span>
                        ) : spotsLeft <= 3 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full animate-pulse">Only {spotsLeft} spot{spotsLeft !== 1 ? 's' : ''} left!</span>
                        ) : (
                          <span className="text-xs text-gray-400">{spotsLeft} spots available</span>
                        )}
                        <span className="text-xs text-gray-400">{count}/{capacity}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full transition-all" style={{ width: `${Math.min(100, (count / capacity) * 100)}%`, backgroundColor: isFull ? '#ef4444' : spotsLeft <= 3 ? '#f97316' : primaryColor }} />
                      </div>
                    </div>
                    <Link href={`/book/${slug}/class/${group.id}`} className="block w-full text-center py-3 rounded-xl font-bold text-sm transition-all hover:scale-[1.02] hover:shadow-md active:scale-[0.98]" style={{ backgroundColor: isFull ? '#f1f5f9' : primaryColor, color: isFull ? '#64748b' : '#0a0a0a' }}>
                      {isFull ? 'Join Waitlist' : 'Book Now'} &rarr;
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {(events || []).length > 0 && (
          <section>
            <h2 className="text-2xl font-bold text-center mb-2">Upcoming Events</h2>
            <p className="text-center text-gray-500 mb-8">Holiday camps, tournaments & more</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(events || []).map((event) => (
                <div key={event.id} className="rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 capitalize">{(event.event_type as string).replace('_', ' ')}</span>
                      <h3 className="font-bold mt-2">{event.name}</h3>
                    </div>
                    {Number(event.price) > 0 && <span className="text-lg font-bold" style={{ color: primaryColor }}>&pound;{Number(event.price).toFixed(0)}</span>}
                  </div>
                  {event.description && <p className="text-sm text-gray-500 mb-2">{event.description}</p>}
                  <div className="space-y-1 text-sm text-gray-600">
                    <div><span className="inline-block mr-1.5">&#128197;</span>{new Date(event.start_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}{event.start_date !== event.end_date && (<> — {new Date(event.end_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</>)}</div>
                    {event.start_time && <div><span className="inline-block mr-1.5">&#128336;</span>{event.start_time}{event.end_time && ` — ${event.end_time}`}</div>}
                    {event.location && <div><span className="inline-block mr-1.5">&#128205;</span>{event.location}</div>}
                  </div>
                  <Link href={`/auth/signup?org=${slug}`} className="mt-4 block w-full text-center py-2 rounded-lg font-medium text-white transition-opacity hover:opacity-90" style={{ backgroundColor: primaryColor }}>Book Now</Link>
                </div>
              ))}
            </div>
          </section>
        )}

        {hasCamps && (
          <section className="relative overflow-hidden rounded-2xl p-5 sm:p-8 text-center text-white" style={{ background: `linear-gradient(135deg, #065f46 0%, ${primaryColor} 100%)` }}>
            <div className="relative z-10">
              <span className="text-3xl block mb-2">&#127945;</span>
              <h2 className="text-2xl font-bold mb-2">Football Camps</h2>
              <p className="text-white/70 mb-5 max-w-md mx-auto">Holiday camps with full-day sessions, games, tournaments &amp; more.</p>
              <Link href={`/book/${slug}/camps`} className="inline-block px-8 py-3 rounded-full font-semibold transition-transform hover:scale-105" style={{ backgroundColor: 'white', color: '#0a0a0a' }}>View Camps &rarr;</Link>
            </div>
          </section>
        )}

        <section className="relative overflow-hidden rounded-2xl p-5 sm:p-8 text-center text-white" style={{ background: `linear-gradient(135deg, #0a0a0a 0%, ${primaryColor} 100%)` }}>
          <div className="relative z-10">
            <span className="text-3xl block mb-2">&#9917;</span>
            <h2 className="text-2xl font-bold mb-2">Not sure yet? Try a free session!</h2>
            <p className="text-white/70 mb-5 max-w-md mx-auto">Book a free taster session for your child — no commitment, no payment needed.</p>
            <Link href={`/book/${slug}/trial`} className="inline-block px-8 py-3 rounded-full font-semibold transition-transform hover:scale-105" style={{ backgroundColor: 'white', color: '#0a0a0a' }}>Book Free Trial &rarr;</Link>
          </div>
        </section>

        <section className="text-center py-8 sm:py-12 px-4 rounded-2xl" style={{ backgroundColor: `${primaryColor}10` }}>
          <h2 className="text-2xl font-bold mb-2">Ready to get started?</h2>
          <p className="text-gray-600 mb-6">Sign up today and book your child&apos;s first class</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href={`/auth/signup?org=${slug}`} className="px-8 py-3 rounded-full font-semibold text-white transition-transform hover:scale-105" style={{ backgroundColor: primaryColor }}>Sign Up Free</Link>
            <Link href={`/auth/signup?org=${slug}&trial=1`} className="px-8 py-3 rounded-full font-semibold border-2 transition-transform hover:scale-105" style={{ borderColor: primaryColor, color: primaryColor }}>Book a Free Trial</Link>
          </div>
          {(org.contact_email || org.contact_phone) && (
            <div className="mt-6 flex flex-wrap gap-4 justify-center text-sm text-gray-500">
              {org.contact_email && <span>&#9993;&#65039; {org.contact_email}</span>}
              {org.contact_phone && <span>&#128222; {org.contact_phone}</span>}
            </div>
          )}
          {(org.social_facebook || org.social_instagram) && (
            <div className="mt-3 flex gap-4 justify-center text-sm">
              {org.social_facebook && <a href={org.social_facebook} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-600">Facebook</a>}
              {org.social_instagram && <a href={org.social_instagram} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-600">Instagram</a>}
            </div>
          )}
        </section>
      </div>

      <footer className="border-t border-gray-100 py-6 text-center text-xs text-gray-400">Powered by Player Portal</footer>
    </div>
  )
}
