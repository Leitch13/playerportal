import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import ShareButton from './ShareButton'

const CLASS_TYPE_CONFIG: Record<string, { label: string; gradient: string; color: string }> = {
  group: { label: 'Group Session', gradient: 'from-blue-600/30 via-blue-900/20 to-transparent', color: '#3b82f6' },
  small_group: { label: 'Small Group', gradient: 'from-purple-600/30 via-purple-900/20 to-transparent', color: '#a855f7' },
  '1-2-1': { label: '1-2-1 Individual', gradient: 'from-amber-600/30 via-amber-900/20 to-transparent', color: '#f59e0b' },
  '2-1': { label: '2-1 Pair Training', gradient: 'from-orange-600/30 via-orange-900/20 to-transparent', color: '#f97316' },
  gk: { label: 'Goalkeeper Training', gradient: 'from-yellow-600/30 via-yellow-900/20 to-transparent', color: '#eab308' },
  soccer_tots: { label: 'Soccer Tots', gradient: 'from-pink-600/30 via-pink-900/20 to-transparent', color: '#ec4899' },
  academy: { label: 'Academy Programme', gradient: 'from-indigo-600/30 via-indigo-900/20 to-transparent', color: '#6366f1' },
  accelerator: { label: 'Accelerator Programme', gradient: 'from-rose-600/30 via-rose-900/20 to-transparent', color: '#f43f5e' },
  elite: { label: 'Elite Development', gradient: 'from-violet-600/30 via-violet-900/20 to-transparent', color: '#8b5cf6' },
  camp: { label: 'Football Camp', gradient: 'from-green-600/30 via-green-900/20 to-transparent', color: '#22c55e' },
  trial: { label: 'Trial Session', gradient: 'from-cyan-600/30 via-cyan-900/20 to-transparent', color: '#06b6d4' },
  girls: { label: 'Girls Only', gradient: 'from-fuchsia-600/30 via-fuchsia-900/20 to-transparent', color: '#d946ef' },
  adults: { label: 'Adult Session', gradient: 'from-slate-600/30 via-slate-900/20 to-transparent', color: '#64748b' },
}

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

  // Get the specific class with new fields
  const { data: group } = await supabase
    .from('training_groups')
    .select('id, name, day_of_week, time_slot, location, max_capacity, age_group, description, price_per_session, class_type, short_description, long_description, benefits, suitable_for, what_to_bring, image_url, is_featured, coach:profiles!training_groups_coach_id_fkey(full_name)')
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

  // Get plans specific to this class first, then fall back to class_type plans, then org-wide
  const { data: classPlans } = await supabase
    .from('subscription_plans')
    .select('id, name, amount, interval, sessions_per_week, is_active, training_group_id, class_type')
    .eq('organisation_id', org.id)
    .eq('is_active', true)
    .eq('training_group_id', groupId)
    .order('amount', { ascending: true })

  let plans = classPlans && classPlans.length > 0 ? classPlans : null

  // If no class-specific plans, try class_type plans
  if (!plans || plans.length === 0) {
    const classType = (group.class_type as string) || 'group'
    const { data: typePlans } = await supabase
      .from('subscription_plans')
      .select('id, name, amount, interval, sessions_per_week, is_active, training_group_id, class_type')
      .eq('organisation_id', org.id)
      .eq('is_active', true)
      .eq('class_type', classType)
      .is('training_group_id', null)
      .order('amount', { ascending: true })

    plans = typePlans && typePlans.length > 0 ? typePlans : null
  }

  // Fall back to org-wide plans (no group or type link)
  if (!plans || plans.length === 0) {
    const { data: orgPlans } = await supabase
      .from('subscription_plans')
      .select('id, name, amount, interval, sessions_per_week, is_active, training_group_id, class_type')
      .eq('organisation_id', org.id)
      .eq('is_active', true)
      .is('training_group_id', null)
      .is('class_type', null)
      .order('amount', { ascending: true })

    plans = orgPlans
  }

  const enrolled = count || 0
  const capacity = group.max_capacity || 20
  const spotsLeft = capacity - enrolled
  const isFull = spotsLeft <= 0
  const coach = group.coach as unknown as { full_name: string } | null
  const primaryColor = org.primary_color || '#4ecde6'
  const price = group.price_per_session as number | null
  const classType = (group.class_type as string) || 'group'
  const typeConfig = CLASS_TYPE_CONFIG[classType] || CLASS_TYPE_CONFIG.group
  const shortDesc = group.short_description as string | null
  const longDesc = group.long_description as string | null
  const benefits = group.benefits as string[] | null
  const suitableFor = group.suitable_for as string | null
  const whatToBring = group.what_to_bring as string | null
  const imageUrl = group.image_url as string | null
  const description = longDesc || (group.description as string | null)

  return (
    <div className="min-h-screen bg-[#060606] text-white">
      {/* Nav */}
      <nav className="glass-dark border-b border-white/[0.06] sticky top-0 z-50 backdrop-blur-md bg-[#060606]/80">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href={`/book/${slug}`} className="flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            All Classes
          </Link>
          <div className="flex items-center gap-3">
            <ShareButton name={group.name} />
            <span className="text-sm font-semibold" style={{ color: primaryColor }}>{org.name}</span>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="relative overflow-hidden">
        {/* Background image or gradient */}
        {imageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-[#060606]/70 via-[#060606]/60 to-[#060606]" />
          </>
        ) : (
          <>
            <div className="absolute inset-0 bg-gradient-to-br from-[#060606] via-[#0f172a] to-[#060606]" />
            <div className={`absolute inset-0 bg-gradient-to-br ${typeConfig.gradient}`} />
            <div className="absolute top-10 left-1/4 w-[400px] h-[400px] rounded-full blur-[150px]" style={{ background: `${primaryColor}15` }} />
          </>
        )}

        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 pt-16 pb-12 text-center">
          {/* Class type badge */}
          <div className="inline-flex items-center gap-2 mb-4">
            <span
              className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider border"
              style={{ borderColor: `${typeConfig.color}50`, color: typeConfig.color, background: `${typeConfig.color}15` }}
            >
              {typeConfig.label}
            </span>
            {group.age_group && (
              <span
                className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider border"
                style={{ borderColor: `${primaryColor}40`, color: primaryColor, background: `${primaryColor}10` }}
              >
                {group.age_group as string}
              </span>
            )}
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-3">{group.name}</h1>

          {shortDesc && (
            <p className="text-lg text-white/60 max-w-xl mx-auto leading-relaxed mb-4">{shortDesc}</p>
          )}

          {/* Quick info pills */}
          <div className="flex flex-wrap items-center justify-center gap-3 text-white/50 text-sm">
            {group.day_of_week && (
              <span className="flex items-center gap-1.5 bg-white/[0.06] px-3 py-1.5 rounded-full">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                <span className="font-medium text-white/70">{group.day_of_week}</span>
              </span>
            )}
            {group.time_slot && (
              <span className="flex items-center gap-1.5 bg-white/[0.06] px-3 py-1.5 rounded-full">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                <span className="font-medium text-white/70">{group.time_slot}</span>
              </span>
            )}
            {group.location && (
              <span className="flex items-center gap-1.5 bg-white/[0.06] px-3 py-1.5 rounded-full">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                <span className="font-medium text-white/70">{group.location}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-20">
        {/* Details Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-10">
          {group.day_of_week && (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
              <div className="text-[10px] uppercase tracking-wider text-white/30 mb-1">Day &amp; Time</div>
              <div className="text-sm font-bold">{group.day_of_week}</div>
              {group.time_slot && <div className="text-xs text-white/50 mt-0.5">{group.time_slot}</div>}
            </div>
          )}
          {group.location && (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
              <div className="text-[10px] uppercase tracking-wider text-white/30 mb-1">Location</div>
              <div className="text-sm font-bold">{group.location}</div>
            </div>
          )}
          {group.age_group && (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
              <div className="text-[10px] uppercase tracking-wider text-white/30 mb-1">Age Group</div>
              <div className="text-sm font-bold">{group.age_group as string}</div>
            </div>
          )}
          {coach?.full_name && (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
              <div className="text-[10px] uppercase tracking-wider text-white/30 mb-1">Coach</div>
              <div className="text-sm font-bold">{coach.full_name}</div>
            </div>
          )}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
            <div className="text-[10px] uppercase tracking-wider text-white/30 mb-1">Capacity</div>
            <div className="text-sm font-bold" style={{ color: isFull ? '#ef4444' : spotsLeft <= 3 ? '#f97316' : primaryColor }}>
              {isFull ? 'FULL' : `${spotsLeft} spots left`}
            </div>
            <div className="text-xs text-white/40 mt-0.5">{enrolled}/{capacity} enrolled</div>
          </div>
          {price != null && Number(price) > 0 && (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
              <div className="text-[10px] uppercase tracking-wider text-white/30 mb-1">Price</div>
              <div className="text-sm font-bold" style={{ color: primaryColor }}>
                &pound;{Number(price).toFixed(2)}
              </div>
              <div className="text-xs text-white/40 mt-0.5">per session</div>
            </div>
          )}
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

        {/* Full Description */}
        {description && (
          <div className="mb-10">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <svg className="w-5 h-5" style={{ color: primaryColor }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              About This Class
            </h2>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
              <div className="text-white/70 leading-relaxed whitespace-pre-line">{description}</div>
            </div>
          </div>
        )}

        {/* Key Benefits */}
        {benefits && benefits.length > 0 && (
          <div className="mb-10">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <svg className="w-5 h-5" style={{ color: primaryColor }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Key Benefits
            </h2>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
              <ul className="space-y-3">
                {benefits.map((benefit, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <svg className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: primaryColor }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-white/70">{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Suitable For */}
        {suitableFor && (
          <div className="mb-10">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <svg className="w-5 h-5" style={{ color: primaryColor }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
              Suitable For
            </h2>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
              <p className="text-white/70 leading-relaxed">{suitableFor}</p>
            </div>
          </div>
        )}

        {/* What to Bring */}
        {whatToBring && (
          <div className="mb-10">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <svg className="w-5 h-5" style={{ color: primaryColor }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
              What to Bring
            </h2>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
              <p className="text-white/70 leading-relaxed">{whatToBring}</p>
            </div>
          </div>
        )}

        {/* Pricing Plans */}
        {plans && plans.length > 0 && (
          <div className="mb-10">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <svg className="w-5 h-5" style={{ color: primaryColor }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Pricing Plans
            </h2>
            <div className="grid gap-3">
              {plans.map((plan, i) => {
                const amount = Number(plan.amount)
                const quarterlyAmount = Math.round(amount * 3 * 0.9 * 100) / 100
                const quarterlySaving = Math.round(amount * 3 * 0.1 * 100) / 100
                const isPopular = i === Math.floor(plans.length / 2)
                return (
                  <div
                    key={plan.id}
                    className={`relative bg-white/[0.03] border rounded-2xl p-5 transition-all hover:bg-white/[0.05] ${
                      isPopular ? 'border-[color:var(--accent)] ring-1 ring-[color:var(--accent)]/20' : 'border-white/[0.08]'
                    }`}
                    style={isPopular ? { borderColor: `${primaryColor}60`, ['--accent' as string]: primaryColor } : undefined}
                  >
                    {isPopular && (
                      <span
                        className="absolute -top-2.5 left-4 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                        style={{ backgroundColor: primaryColor, color: '#0a0a0a' }}
                      >
                        Most Popular
                      </span>
                    )}
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-base">{plan.name}</h3>
                        {plan.sessions_per_week && (
                          <p className="text-xs text-white/40 mt-0.5">
                            {plan.sessions_per_week === 'unlimited' ? 'Unlimited sessions' : `${plan.sessions_per_week} session${plan.sessions_per_week === '1' ? '' : 's'} per week`}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-extrabold" style={{ color: primaryColor }}>&pound;{amount.toFixed(0)}</span>
                          <span className="text-xs text-white/40">/month</span>
                        </div>
                        <p className="text-[10px] text-green-400 mt-0.5">
                          or &pound;{quarterlyAmount.toFixed(0)} quarterly (save &pound;{quarterlySaving.toFixed(0)})
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="text-center text-xs text-white/30 mt-3">
              Pay monthly or save 10% with quarterly billing
            </p>
          </div>
        )}

        {/* CTAs */}
        <div className="space-y-3 mb-10">
          <Link
            href={isFull ? `/auth/signup?org=${slug}&class=${groupId}` : `/book/${slug}/class/${groupId}/quick-book`}
            className="block w-full text-center py-4 rounded-2xl font-bold text-lg transition-all hover:scale-[1.01] hover:shadow-lg"
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
        <div className="pt-8 border-t border-white/[0.06] text-center">
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
              {org.contact_email && (
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  {org.contact_email}
                </span>
              )}
              {org.contact_phone && (
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                  {org.contact_phone}
                </span>
              )}
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
