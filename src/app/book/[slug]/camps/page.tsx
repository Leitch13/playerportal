import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

type Camp = {
  id: string
  name: string
  description: string | null
  start_date: string
  end_date: string
  daily_start_time: string | null
  daily_end_time: string | null
  location: string | null
  age_group: string | null
  price: number | null
  max_capacity: number | null
  image_url: string | null
  is_published: boolean
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  const sDay = s.getDate()
  const eDay = e.getDate()
  const month = s.toLocaleDateString('en-GB', { month: 'long' })
  const year = s.getFullYear()
  if (s.getMonth() === e.getMonth()) {
    return `${sDay}-${eDay} ${month} ${year}`
  }
  const eMonth = e.toLocaleDateString('en-GB', { month: 'long' })
  return `${sDay} ${month} - ${eDay} ${eMonth} ${year}`
}

function getDurationDays(start: string, end: string): number {
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  return Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1
}

export default async function CampsListingPage({
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
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Academy Not Found</h1>
          <p className="text-white/60">This booking page doesn&apos;t exist.</p>
        </div>
      </div>
    )
  }

  const today = new Date().toISOString().split('T')[0]
  const { data: camps } = await supabase
    .from('camps')
    .select('*')
    .eq('organisation_id', org.id)
    .eq('is_published', true)
    .gte('end_date', today)
    .order('start_date')

  const primaryColor = org.primary_color || '#4ecde6'

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Hero */}
      <div
        className="relative py-16 px-6 text-center text-white"
        style={{ background: `linear-gradient(135deg, #0a0a0a 0%, ${primaryColor}40 100%)` }}
      >
        <div className="relative z-10 max-w-3xl mx-auto">
          <Link
            href={`/book/${slug}`}
            className="inline-block mb-6 text-sm text-white/60 hover:text-white transition-colors"
          >
            &larr; Back to {org.name}
          </Link>
          <h1 className="text-4xl md:text-5xl font-bold mb-3">Football Camps</h1>
          <p className="text-lg text-white/70">
            Holiday camps, intensive training weeks &amp; more
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-12">
        {(!camps || camps.length === 0) ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">&#9917;</div>
            <h2 className="text-xl font-semibold text-white mb-2">No upcoming camps</h2>
            <p className="text-white/50">Check back soon for new camp dates!</p>
            <Link
              href={`/book/${slug}`}
              className="inline-block mt-6 px-6 py-2 rounded-full text-sm font-medium border border-white/20 text-white/70 hover:text-white hover:border-white/40 transition-colors"
            >
              View Weekly Classes
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {(camps as Camp[]).map((camp) => {
              const days = getDurationDays(camp.start_date, camp.end_date)
              return (
                <Link
                  key={camp.id}
                  href={`/book/${slug}/camps/${camp.id}`}
                  className="group block rounded-2xl overflow-hidden border border-white/10 bg-white/5 backdrop-blur-sm hover:border-white/20 transition-all hover:-translate-y-1"
                >
                  {/* Image / Gradient */}
                  <div
                    className="h-48 relative"
                    style={
                      camp.image_url
                        ? { backgroundImage: `url(${camp.image_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                        : { background: `linear-gradient(135deg, #065f46 0%, ${primaryColor} 100%)` }
                    }
                  >
                    <div className="absolute inset-0 bg-black/30" />
                    <div className="absolute bottom-4 left-4 right-4">
                      <h3 className="text-xl font-bold text-white drop-shadow-lg">
                        {camp.name}
                      </h3>
                    </div>
                    {camp.age_group && (
                      <div className="absolute top-4 right-4">
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-black/50 text-white backdrop-blur-sm">
                          {camp.age_group}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-white/80 text-sm">
                        {formatDateRange(camp.start_date, camp.end_date)}
                      </span>
                      <span className="text-xs text-white/50">
                        {days} day{days !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {camp.location && (
                      <div className="text-sm text-white/50">
                        {camp.location}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-white/10">
                      {camp.price != null && (
                        <span className="text-2xl font-bold" style={{ color: primaryColor }}>
                          &pound;{Number(camp.price).toFixed(0)}
                          <span className="text-sm font-normal text-white/40 ml-1">per week</span>
                        </span>
                      )}
                      <span
                        className="px-4 py-2 rounded-full text-sm font-semibold transition-transform group-hover:scale-105"
                        style={{ backgroundColor: primaryColor, color: '#0a0a0a' }}
                      >
                        Book Now
                      </span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-white/10 py-6 text-center text-xs text-white/30">
        Powered by Player Portal
      </footer>
    </div>
  )
}
