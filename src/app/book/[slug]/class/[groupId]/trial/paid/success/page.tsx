import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function PaidTrialSuccessPage({
  params,
}: {
  params: Promise<{ slug: string; groupId: string }>
}) {
  const { slug, groupId } = await params
  const supabase = await createClient()

  const { data: org } = await supabase
    .from('organisations')
    .select('name, primary_color, logo_url')
    .ilike('slug', slug)
    .single()

  const { data: group } = await supabase
    .from('training_groups')
    .select('name, day_of_week, time_slot, location')
    .eq('id', groupId)
    .single()

  const primaryColor = (org?.primary_color as string) || '#4ecde6'

  return (
    <div className="min-h-screen bg-[#060606] text-white flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div
          className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center"
          style={{ background: `${primaryColor}20`, border: `2px solid ${primaryColor}` }}
        >
          <svg className="w-10 h-10" fill="none" stroke={primaryColor} strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-3xl font-extrabold mb-2">Trial Booked!</h1>
        <p className="text-white/60 mb-6">
          Payment received. Your trial session is booked.
        </p>

        <div className="bg-[#141414] border border-white/[0.08] rounded-2xl p-5 mb-6 text-left">
          <p className="text-xs uppercase tracking-wider text-white/40 mb-2">Session</p>
          <p className="font-bold text-lg">{group?.name || 'Trial Session'}</p>
          <p className="text-sm text-white/60 mt-1">
            {group?.day_of_week} {group?.time_slot ? `· ${group.time_slot}` : ''}
            {group?.location ? ` · ${group.location}` : ''}
          </p>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6 text-left">
          <p className="text-sm font-medium text-amber-300 mb-1">What happens next</p>
          <p className="text-xs text-amber-200/80">
            We&apos;ve emailed you a receipt. The coach at <strong>{org?.name || 'the academy'}</strong> will be in touch to confirm your session time.
          </p>
        </div>

        <Link
          href={`/book/${slug}`}
          className="inline-block px-6 py-3 rounded-full text-sm font-semibold transition-all"
          style={{ background: primaryColor, color: '#0a0a0a' }}
        >
          Back to {org?.name || 'Academy'}
        </Link>
      </div>
    </div>
  )
}
