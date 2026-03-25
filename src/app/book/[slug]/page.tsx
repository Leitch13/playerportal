import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import PricingToggle from './PricingToggle'

export default async function PublicBookingPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()

  // Get org by slug (public - no auth needed)
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

  // Get active classes for this org
  const { data: groups } = await supabase
    .from('training_groups')
    .select('id, name, day_of_week, time_slot, location, max_capacity, coach:profiles!training_groups_coach_id_fkey(full_name)')
    .eq('organisation_id', org.id)
    .order('name')

  // Get active enrolment counts
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

  // Get subscription plans
  const { data: plans } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('organisation_id', org.id)
    .eq('active', true)
    .order('sort_order')

  // Get upcoming events
  const today = new Date().toISOString().split('T')[0]
  const { data: events } = await supabase
    .from('events')
    .select('*')
    .eq('organisation_id', org.id)
    .eq('active', true)
    .gte('end_date', today)
    .order('start_date')

  const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  const sortedGroups = [...(groups || [])].sort((a, b) => {
    const dayA = DAY_ORDER.indexOf(a.day_of_week || '')
    const dayB = DAY_ORDER.indexOf(b.day_of_week || '')
    return (dayA === -1 ? 99 : dayA) - (dayB === -1 ? 99 : dayB)
  })

  const primaryColor = org.primary_color || '#4ecde6'

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <div
        className="relative py-20 px-6 text-center text-white"
        style={{ background: `linear-gradient(135deg, #0a0a0a 0%, ${primaryColor} 100%)` }}
      >
        {org.hero_image_url && (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-20"
            style={{ backgroundImage: `url(${org.hero_image_url})` }}
          />
        )}
        <div className="relative z-10 max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{org.name}</h1>
          {org.description && (
            <p className="text-lg text-white/80 mb-6">{org.description}</p>
          )}
          <Link
            href={`/auth/signup?org=${slug}`}
            className="inline-block px-8 py-3 rounded-full text-lg font-semibold transition-transform hover:scale-105"
            style={{ backgroundColor: primaryColor, color: '#0a0a0a' }}
          >
            Join Now &rarr;
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-12 space-y-16">
        {/* Plans */}
        {(plans || []).length > 0 && (
          <section>
            <h2 className="text-2xl font-bold text-center mb-2">Our Plans</h2>
            <p className="text-center text-gray-500 mb-8">Choose the plan that works for your child</p>
            <PricingToggle
              plans={(plans || []).map(plan => ({
                id: plan.id,
                name: plan.name,
                description: plan.description as string | null,
                amount: Number(plan.amount),
                sessions_per_week: plan.sessions_per_week,
              }))}
              slug={slug}
              primaryColor={primaryColor}
            />
          </section>
        )}

        {/* Classes */}
        <section>
          <h2 className="text-2xl font-bold text-center mb-2">Weekly Classes</h2>
          <p className="text-center text-gray-500 mb-8">Our regular training schedule</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedGroups.map((group) => {
              const count = countByGroup.get(group.id) || 0
              const capacity = (group as unknown as { max_capacity: number }).max_capacity || 20
              const spotsLeft = capacity - count
              const coach = group.coach as unknown as { full_name: string } | null

              return (
                <Link key={group.id} href={`/book/${slug}/class/${group.id}`} className="block rounded-xl border border-gray-200 p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-bold">{group.name}</h3>
                    {spotsLeft <= 3 && spotsLeft > 0 && (
                      <span className="text-xs font-medium text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full">
                        {spotsLeft} left
                      </span>
                    )}
                    {spotsLeft <= 0 && (
                      <span className="text-xs font-medium text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
                        Full
                      </span>
                    )}
                  </div>
                  <div className="space-y-1.5 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold" style={{ color: primaryColor }}>
                        {group.day_of_week || 'TBA'}
                      </span>
                      {group.time_slot && <span>{group.time_slot}</span>}
                    </div>
                    {group.location && <div>📍 {group.location}</div>}
                    {coach?.full_name && <div>👤 Coach {coach.full_name}</div>}
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, (count / capacity) * 100)}%`,
                          backgroundColor: spotsLeft <= 3 ? '#f97316' : primaryColor,
                        }}
                      />
                    </div>
                    <span className="text-xs text-gray-500">{count}/{capacity}</span>
                  </div>
                  <div className="mt-3 text-xs font-medium text-center py-2 rounded-lg" style={{ color: primaryColor, backgroundColor: `${primaryColor}10` }}>
                    View &amp; Book &rarr;
                  </div>
                </Link>
              )
            })}
          </div>
        </section>

        {/* Events / Holiday Camps */}
        {(events || []).length > 0 && (
          <section>
            <h2 className="text-2xl font-bold text-center mb-2">Upcoming Events</h2>
            <p className="text-center text-gray-500 mb-8">Holiday camps, tournaments & more</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(events || []).map((event) => (
                <div key={event.id} className="rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 capitalize">
                        {(event.event_type as string).replace('_', ' ')}
                      </span>
                      <h3 className="font-bold mt-2">{event.name}</h3>
                    </div>
                    {Number(event.price) > 0 && (
                      <span className="text-lg font-bold" style={{ color: primaryColor }}>
                        &pound;{Number(event.price).toFixed(0)}
                      </span>
                    )}
                  </div>
                  {event.description && (
                    <p className="text-sm text-gray-500 mb-2">{event.description}</p>
                  )}
                  <div className="space-y-1 text-sm text-gray-600">
                    <div>
                      📅 {new Date(event.start_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                      {event.start_date !== event.end_date && (
                        <> — {new Date(event.end_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</>
                      )}
                    </div>
                    {event.start_time && <div>🕐 {event.start_time}{event.end_time && ` — ${event.end_time}`}</div>}
                    {event.location && <div>📍 {event.location}</div>}
                  </div>
                  <Link
                    href={`/auth/signup?org=${slug}`}
                    className="mt-4 block w-full text-center py-2 rounded-lg font-medium text-white transition-opacity hover:opacity-90"
                    style={{ backgroundColor: primaryColor }}
                  >
                    Book Now
                  </Link>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Free Trial Banner */}
        <section className="relative overflow-hidden rounded-2xl p-8 text-center text-white" style={{ background: `linear-gradient(135deg, #0a0a0a 0%, ${primaryColor} 100%)` }}>
          <div className="relative z-10">
            <span className="text-3xl block mb-2">⚽</span>
            <h2 className="text-2xl font-bold mb-2">Not sure yet? Try a free session!</h2>
            <p className="text-white/70 mb-5 max-w-md mx-auto">Book a free taster session for your child — no commitment, no payment needed.</p>
            <Link
              href={`/book/${slug}/trial`}
              className="inline-block px-8 py-3 rounded-full font-semibold transition-transform hover:scale-105"
              style={{ backgroundColor: 'white', color: '#0a0a0a' }}
            >
              Book Free Trial &rarr;
            </Link>
          </div>
        </section>

        {/* Contact / CTA */}
        <section className="text-center py-12 rounded-2xl" style={{ backgroundColor: `${primaryColor}10` }}>
          <h2 className="text-2xl font-bold mb-2">Ready to get started?</h2>
          <p className="text-gray-600 mb-6">Sign up today and book your child&apos;s first class</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link
              href={`/auth/signup?org=${slug}`}
              className="px-8 py-3 rounded-full font-semibold text-white transition-transform hover:scale-105"
              style={{ backgroundColor: primaryColor }}
            >
              Sign Up Free
            </Link>
            <Link
              href={`/auth/signup?org=${slug}&trial=1`}
              className="px-8 py-3 rounded-full font-semibold border-2 transition-transform hover:scale-105"
              style={{ borderColor: primaryColor, color: primaryColor }}
            >
              Book a Free Trial
            </Link>
          </div>
          {(org.contact_email || org.contact_phone) && (
            <div className="mt-6 flex flex-wrap gap-4 justify-center text-sm text-gray-500">
              {org.contact_email && <span>✉️ {org.contact_email}</span>}
              {org.contact_phone && <span>📞 {org.contact_phone}</span>}
            </div>
          )}
          {(org.social_facebook || org.social_instagram) && (
            <div className="mt-3 flex gap-4 justify-center text-sm">
              {org.social_facebook && (
                <a href={org.social_facebook} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-600">
                  Facebook
                </a>
              )}
              {org.social_instagram && (
                <a href={org.social_instagram} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-600">
                  Instagram
                </a>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-6 text-center text-xs text-gray-400">
        Powered by Player Portal
      </footer>
    </div>
  )
}
