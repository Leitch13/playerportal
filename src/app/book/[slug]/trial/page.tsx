import { createClient } from '@/lib/supabase/server'
import TrialBookingForm from './TrialBookingForm'

export default async function TrialBookingPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: org } = await supabase
    .from('organisations')
    .select('id, name, primary_color, description')
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
    .select('id, name, day_of_week, time_slot')
    .eq('organisation_id', org.id)
    .order('name')

  const primaryColor = org.primary_color || '#4ecde6'

  return (
    <div className="min-h-screen" style={{ background: '#0a0a0a' }}>
      {/* Hero */}
      <div
        className="py-16 px-6 text-center text-white"
        style={{ background: `linear-gradient(135deg, #0a0a0a 0%, ${primaryColor}33 100%)` }}
      >
        <div className="max-w-xl mx-auto">
          <span
            className="inline-block px-3 py-1 rounded-full text-xs font-semibold mb-4"
            style={{ backgroundColor: `${primaryColor}22`, color: primaryColor, border: `1px solid ${primaryColor}44` }}
          >
            FREE TRIAL
          </span>
          <h1 className="text-3xl md:text-4xl font-bold mb-3">{org.name}</h1>
          <p className="text-white/70">
            Book a free taster session for your child. No commitment, no payment — just come and try!
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-lg mx-auto px-6 -mt-4 pb-16">
        <TrialBookingForm
          orgId={org.id}
          groups={(groups || []).map((g) => ({
            id: g.id,
            name: g.name,
            day: g.day_of_week,
            time: g.time_slot,
          }))}
          primaryColor={primaryColor}
          slug={slug}
          academyName={org.name}
        />
      </div>
    </div>
  )
}
