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
      <div className="relative max-w-xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          {org.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={org.logo_url as string} alt={org.name as string} className="w-14 h-14 rounded-xl object-cover mx-auto mb-3 bg-[#1a1a1a]" />
          ) : null}
          <h1 className="text-3xl font-extrabold mb-1">{org.name}</h1>
          <p className="text-sm text-white/60">Book your trial session</p>
        </div>

        <div className="bg-[#141414] border border-white/[0.08] rounded-2xl p-6 mb-6">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h2 className="text-lg font-bold">{group.name}</h2>
              <p className="text-xs text-white/60 mt-1">
                {group.day_of_week} {group.time_slot ? `· ${group.time_slot}` : ''}
                {group.location ? ` · ${group.location}` : ''}
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-extrabold" style={{ color: primaryColor }}>
                &pound;{trialPrice.toFixed(2)}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-white/40 mt-0.5">
                Trial session
              </div>
            </div>
          </div>
          <p className="text-xs text-white/40 mt-3 pt-3 border-t border-white/[0.06]">
            One-off payment for a single trial session. No subscription, no commitment.
            If you love it, you can subscribe afterwards.
          </p>
        </div>

        <PaidTrialForm
          slug={slug}
          groupId={groupId}
          groupName={group.name as string}
          trialPrice={trialPrice}
          primaryColor={primaryColor}
          dayOfWeek={(group.day_of_week as string | null) || null}
          timeSlot={(group.time_slot as string | null) || null}
        />
      </div>
    </div>
  )
}
