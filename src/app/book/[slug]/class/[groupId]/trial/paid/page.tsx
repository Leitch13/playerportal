import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import PaidTrialForm from './PaidTrialForm'

export default async function PaidTrialPage({
  params,
}: {
  params: Promise<{ slug: string; groupId: string }>
}) {
  const { slug, groupId } = await params
  const supabase = await createClient()

  const { data: org } = await supabase
    .from('organisations')
    .select('id, name, slug, primary_color, logo_url')
    .ilike('slug', slug)
    .single()

  if (!org) notFound()

  const { data: group } = await supabase
    .from('training_groups')
    .select('id, name, day_of_week, time_slot, location, trial_price, age_group, class_type')
    .eq('id', groupId)
    .eq('organisation_id', org.id)
    .single()

  if (!group) notFound()

  const trialPrice = Number(group.trial_price || 0)
  if (trialPrice <= 0) {
    // Class doesn't offer a paid trial — bounce them to the free trial flow
    return notFound()
  }

  const primaryColor = (org.primary_color as string) || '#4ecde6'

  return (
    <div className="min-h-screen bg-[#060606] text-white">
      <div
        className="absolute inset-x-0 top-0 h-64 opacity-30 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at top, ${primaryColor}40 0%, transparent 60%)` }}
      />
      <div className="relative max-w-xl mx-auto px-4 py-6 sm:py-12">
        <div className="text-center mb-5 sm:mb-8">
          {org.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={org.logo_url as string} alt={org.name as string} className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl object-cover mx-auto mb-2 sm:mb-3 bg-[#1a1a1a]" />
          ) : null}
          <h1 className="text-xl sm:text-3xl font-extrabold mb-0.5 sm:mb-1">{org.name}</h1>
          <p className="text-xs sm:text-sm text-white/60">Book your trial session</p>
        </div>

        <div className="bg-[#141414] border border-white/[0.08] rounded-2xl p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="min-w-0 flex-1">
              <h2 className="text-base sm:text-lg font-bold leading-tight">{group.name}</h2>
              <p className="text-[11px] sm:text-xs text-white/60 mt-1">
                {group.day_of_week} {group.time_slot ? `· ${group.time_slot}` : ''}
                {group.location ? ` · ${group.location}` : ''}
              </p>
            </div>
            <div className="text-right shrink-0">
              <div className="text-xl sm:text-2xl font-extrabold" style={{ color: primaryColor }}>
                &pound;{trialPrice.toFixed(2)}
              </div>
              <div className="text-[9px] sm:text-[10px] uppercase tracking-wider text-white/40 mt-0.5">
                Trial session
              </div>
            </div>
          </div>
          <p className="text-[11px] sm:text-xs text-white/40 mt-2.5 sm:mt-3 pt-2.5 sm:pt-3 border-t border-white/[0.06] leading-snug">
            One-off payment for a single trial session. No subscription, no commitment.
            If you love it, you can subscribe afterwards.
          </p>
        </div>

        <PaidTrialForm
          slug={slug}
          groupId={groupId}
          groupName={group.name as string}
          orgName={org.name as string}
          trialPrice={trialPrice}
          primaryColor={primaryColor}
          dayOfWeek={(group.day_of_week as string | null) || null}
          timeSlot={(group.time_slot as string | null) || null}
        />
      </div>
    </div>
  )
}
