import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import SubscriptionSuccessConfetti from './SubscriptionSuccessConfetti'

/**
 * Cinematic celebration page shown right after a parent completes Stripe
 * Checkout for a subscription. Replaces dumping them onto the generic
 * payments page with just a banner.
 *
 * Shows what they just bought, when their first session is, and what
 * happens next — turns a payment confirmation into an emotional moment.
 */
export default async function SubscriptionSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ billing?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')

  // Pull the parent's most recent subscription + linked plan + class info
  const { data: latestSub } = await supabase
    .from('subscriptions')
    .select(`
      id, status, current_period_end, created_at,
      plan:subscription_plans(name, amount, interval, sessions_per_week),
      player:players(first_name, last_name)
    `)
    .eq('parent_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Get academy for branding
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, organisation_id')
    .eq('id', user.id)
    .single()

  const { data: org } = profile?.organisation_id
    ? await supabase
        .from('organisations')
        .select('name, logo_url, primary_color')
        .eq('id', profile.organisation_id)
        .single()
    : { data: null }

  const firstName = (profile?.full_name || '').split(' ')[0] || 'there'
  const brandColor = (org?.primary_color as string) || '#4ecde6'
  const academyName = (org?.name as string) || 'your academy'
  const plan = latestSub?.plan as unknown as { name: string; amount: number; interval: string; sessions_per_week: number } | null
  const player = latestSub?.player as unknown as { first_name: string; last_name: string } | null
  const isQuarterly = params.billing === 'quarterly'

  // Find the player's next session date
  let nextSessionLabel: string | null = null
  if (player) {
    const { data: enrolments } = await supabase
      .from('enrolments')
      .select('group:training_groups(day_of_week, time_slot, name)')
      .eq('parent_id', user.id)
      .eq('status', 'active')
      .order('enrolled_at', { ascending: false })
      .limit(1)
    if (enrolments && enrolments[0]) {
      const grp = enrolments[0].group as unknown as { day_of_week: string; time_slot: string; name: string } | null
      if (grp?.day_of_week) {
        nextSessionLabel = `${grp.day_of_week}${grp.time_slot ? ` at ${grp.time_slot}` : ''}${grp.name ? ` — ${grp.name}` : ''}`
      }
    }
  }

  return (
    <div className="min-h-screen bg-[#060606] text-white -m-6 lg:-m-8 relative overflow-hidden">
      <SubscriptionSuccessConfetti color={brandColor} />

      {/* Ambient brand glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full blur-[180px] opacity-30 pointer-events-none animate-success-glow"
        style={{ background: brandColor }}
      />
      <div
        className="absolute inset-0 opacity-[0.025] pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />

      <div className="relative max-w-2xl mx-auto px-4 py-16 sm:py-24 text-center">
        {/* Big celebration check */}
        <div className="relative inline-flex items-center justify-center mb-8 animate-success-pop">
          <div
            className="absolute inset-0 rounded-full blur-2xl opacity-60 animate-pulse-slow"
            style={{ background: brandColor }}
          />
          <div
            className="relative w-24 h-24 rounded-full flex items-center justify-center border-2"
            style={{
              background: `linear-gradient(135deg, ${brandColor}, ${brandColor}cc)`,
              borderColor: '#ffffff',
              boxShadow: `0 0 60px ${brandColor}90, 0 0 0 8px ${brandColor}20`,
            }}
          >
            <svg className="w-12 h-12 text-black" fill="none" stroke="currentColor" strokeWidth={3.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>

        {/* Headline */}
        <h1
          className="text-4xl sm:text-5xl md:text-6xl font-black mb-3 tracking-tight animate-fade-up"
          style={{
            background: `linear-gradient(180deg, #ffffff 0%, ${brandColor} 100%)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          You&apos;re in, {firstName}!
        </h1>

        <p className="text-base sm:text-lg text-white/60 mb-10 max-w-md mx-auto animate-fade-up" style={{ animationDelay: '0.1s' }}>
          Welcome to {academyName}. {player ? `${player.first_name}'s` : 'Your child\'s'} subscription is active.
        </p>

        {/* What just happened card */}
        {plan && (
          <div className="rounded-2xl border border-white/[0.08] bg-[#141414] p-6 sm:p-7 mb-8 text-left max-w-md mx-auto animate-fade-up" style={{ animationDelay: '0.2s' }}>
            <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-3">
              Subscription confirmed
            </p>
            <div className="flex items-baseline justify-between gap-2 mb-1">
              <span className="text-lg font-bold text-white">{plan.name}</span>
              <span className="text-xl font-extrabold" style={{ color: brandColor }}>
                £{Number(plan.amount).toFixed(0)}<span className="text-xs text-white/40">/{isQuarterly ? '3mo' : 'mo'}</span>
              </span>
            </div>
            {player && (
              <p className="text-sm text-white/50">For {player.first_name} {player.last_name}</p>
            )}
            {nextSessionLabel && (
              <div className="mt-4 pt-4 border-t border-white/[0.06]">
                <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-1.5">
                  Next session
                </p>
                <p className="text-sm font-semibold text-white">{nextSessionLabel}</p>
              </div>
            )}
          </div>
        )}

        {/* What happens next */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 sm:p-6 mb-10 text-left max-w-md mx-auto animate-fade-up" style={{ animationDelay: '0.3s' }}>
          <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-4">
            What happens next
          </p>
          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: `${brandColor}20`, color: brandColor }}>1</span>
              <span className="text-white/70">We&apos;ve emailed you a receipt and welcome pack with everything you need.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: `${brandColor}20`, color: brandColor }}>2</span>
              <span className="text-white/70">Your dashboard shows {player?.first_name || 'your child'}&apos;s schedule, progress and payments — all in one place.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: `${brandColor}20`, color: brandColor }}>3</span>
              <span className="text-white/70">After the first session, the coach will share progress notes and a skills snapshot.</span>
            </li>
          </ul>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center animate-fade-up" style={{ animationDelay: '0.4s' }}>
          <Link
            href="/dashboard"
            className="inline-block px-8 py-3.5 rounded-full font-bold text-base transition-all hover:scale-[1.03] active:scale-[0.98]"
            style={{
              background: 'white',
              color: '#0a0a0a',
              boxShadow: `0 0 40px ${brandColor}50, 0 0 0 3px ${brandColor}20`,
            }}
          >
            Go to your dashboard &rarr;
          </Link>
          <Link
            href="/dashboard/schedule"
            className="inline-block px-8 py-3.5 rounded-full font-semibold text-base text-white/70 hover:text-white border border-white/[0.12] hover:border-white/25 transition-all"
          >
            See the schedule
          </Link>
        </div>

        <p className="text-xs text-white/30 mt-12 animate-fade-up" style={{ animationDelay: '0.5s' }}>
          Need help? Reach out to {academyName} from your dashboard — they&apos;ll get back to you.
        </p>
      </div>

      <style>{`
        @keyframes success-pop {
          0% { transform: scale(0); opacity: 0; }
          50% { transform: scale(1.15); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.15); }
        }
        @keyframes success-glow {
          0%, 100% { opacity: 0.25; }
          50% { opacity: 0.4; }
        }
        .animate-success-pop { animation: success-pop 0.7s cubic-bezier(0.34, 1.56, 0.64, 1); }
        .animate-fade-up { animation: fade-up 0.6s ease-out both; }
        .animate-pulse-slow { animation: pulse-slow 3s ease-in-out infinite; }
        .animate-success-glow { animation: success-glow 4s ease-in-out infinite; }
      `}</style>
    </div>
  )
}
