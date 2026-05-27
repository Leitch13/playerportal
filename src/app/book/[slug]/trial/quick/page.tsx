import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import TrialForm from './TrialForm'

export default async function QuickTrialPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ class?: string }>
}) {
  const { slug } = await params
  const { class: preselectedClassId } = await searchParams
  const supabase = await createClient()

  const { data: org } = await supabase
    .from('organisations')
    .select('id, name, primary_color, description, contact_email, contact_phone')
    .ilike('slug', slug)
    .single()

  if (!org) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#060606] text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Academy Not Found</h1>
          <p className="text-white/50">This booking page doesn&apos;t exist.</p>
        </div>
      </div>
    )
  }

  const { data: groups } = await supabase
    .from('training_groups')
    .select('id, name, day_of_week, time_slot, location, age_group, class_type')
    .eq('organisation_id', org.id)
    .order('name')

  const primaryColor = org.primary_color || '#4ecde6'

  return (
    <div className="min-h-screen bg-[#060606] text-white">
      {/* Nav */}
      <nav className="border-b border-white/[0.06] sticky top-0 z-50 backdrop-blur-md bg-[#060606]/80">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <Link
            href={`/book/${slug}`}
            className="flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </Link>
          <span className="text-sm font-semibold" style={{ color: primaryColor }}>
            {org.name}
          </span>
        </div>
      </nav>

      {/* Compact Hero */}
      <div
        className="py-10 px-4 text-center"
        style={{ background: `linear-gradient(135deg, #060606 0%, ${primaryColor}22 100%)` }}
      >
        <div className="max-w-lg mx-auto">
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4"
            style={{ backgroundColor: `${primaryColor}15`, color: primaryColor, border: `1px solid ${primaryColor}30` }}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            100% Free &middot; No commitment
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2">
            Book a Free Trial
          </h1>
          <p className="text-white/50 text-sm">
            Try a session with {org.name} &mdash; takes 20 seconds
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-lg mx-auto px-4 -mt-2 pb-16">
        <TrialForm
          orgId={org.id}
          // When the parent came from a specific class page (?class=...),
          // scope the trial booking to that class only. They're not browsing,
          // they've already chosen — showing all classes again is confusing.
          groups={(groups || [])
            .filter((g) => !preselectedClassId || g.id === preselectedClassId)
            .map((g) => ({
              id: g.id,
              name: g.name,
              day: g.day_of_week,
              time: g.time_slot,
              location: g.location,
              ageGroup: g.age_group as string | null,
            }))}
          preselectedGroupId={preselectedClassId || null}
          primaryColor={primaryColor}
          slug={slug}
          academyName={org.name}
        />
      </div>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-6 text-center text-xs text-white/20">
        Powered by Player Portal
      </footer>
    </div>
  )
}
