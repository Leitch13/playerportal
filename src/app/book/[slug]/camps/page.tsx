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
  early_bird_price: number | null
  early_bird_deadline: string | null
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
        className="relative overflow-hidden py-12 sm:py-20 px-5 sm:px-6 text-center text-white"
        style={{ background: `linear-gradient(160deg, #060606 0%, #0a0a0a 40%, ${primaryColor}40 100%)` }}
      >
        {/* Brand glow */}
        <div
          className="absolute -top-24 left-1/2 -translate-x-1/2 w-[30rem] h-[30rem] rounded-full blur-[140px] opacity-25 pointer-events-none"
          style={{ background: primaryColor }}
        />
        <div className="relative z-10 max-w-3xl mx-auto">
          <Link
            href={`/book/${slug}`}
            className="inline-flex items-center gap-1.5 mb-5 sm:mb-7 text-sm text-white/60 hover:text-white transition-colors"
          >
            &larr; Back to {org.name}
          </Link>
          {org.logo_url ? (
            <div className="flex justify-center mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={org.logo_url as string} alt={org.name as string} className="w-14 h-14 rounded-2xl object-cover bg-white/10 ring-1 ring-white/15" />
            </div>
          ) : null}
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] sm:text-[11px] font-bold uppercase tracking-wider mb-3 backdrop-blur-sm"
            style={{ backgroundColor: `${primaryColor}22`, color: '#fff', border: `1px solid ${primaryColor}55` }}
          >
            Camps &amp; Events
          </span>
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight mb-2 sm:mb-3 leading-[1.05]">Football Camps</h1>
          <p className="text-sm sm:text-lg text-white/60">
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
            {(camps as Camp[]).map((camp) => {
              const days = getDurationDays(camp.start_date, camp.end_date)
              const isEarlyBird = camp.early_bird_price != null && camp.early_bird_deadline != null && today <= camp.early_bird_deadline
              const displayPrice = isEarlyBird ? Number(camp.early_bird_price) : (camp.price != null ? Number(camp.price) : null)
              return (
                <Link
                  key={camp.id}
                  href={`/book/${slug}/camps/${camp.id}`}
                  className="group block rounded-2xl overflow-hidden border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm transition-all duration-300 hover:-translate-y-1.5"
                  style={{ ['--tw-ring-color' as string]: primaryColor }}
                >
                  {/* Image / Gradient with bottom scrim */}
                  <div
                    className="h-44 sm:h-52 relative"
                    style={
                      camp.image_url
                        ? { backgroundImage: `url(${camp.image_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                        : { background: `linear-gradient(135deg, #060606 0%, ${primaryColor}66 100%)` }
                    }
                  >
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                    {/* Top badges */}
                    <div className="absolute top-3 left-3 right-3 flex items-start justify-between gap-2">
                      {isEarlyBird ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-green-500 text-white shadow-lg">
                          Early Bird
                        </span>
                      ) : <span />}
                      {camp.age_group && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-semibold bg-black/50 text-white backdrop-blur-sm">
                          Ages {camp.age_group}
                        </span>
                      )}
                    </div>
                    <div className="absolute bottom-3.5 left-4 right-4">
                      <h3 className="text-lg sm:text-xl font-extrabold text-white drop-shadow-lg leading-tight">
                        {camp.name}
                      </h3>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="p-4 sm:p-5 space-y-2.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/80 font-medium">
                        {formatDateRange(camp.start_date, camp.end_date)}
                      </span>
                      <span className="text-xs text-white/40">
                        {days} day{days !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {camp.location && (
                      <div className="text-sm text-white/45">📍 {camp.location}</div>
                    )}

                    <div className="flex items-center justify-between pt-2.5 border-t border-white/[0.06]">
                      {displayPrice != null && (
                        <span className="flex items-baseline gap-1.5">
                          <span className="text-2xl font-extrabold" style={{ color: primaryColor }}>
                            &pound;{displayPrice.toFixed(0)}
                          </span>
                          {isEarlyBird && camp.price != null && (
                            <span className="text-sm text-white/30 line-through">&pound;{Number(camp.price).toFixed(0)}</span>
                          )}
                          <span className="text-xs font-normal text-white/40">/ week</span>
                        </span>
                      )}
                      <span
                        className="px-4 py-2 rounded-full text-sm font-bold transition-transform group-hover:scale-105"
                        style={{ backgroundColor: primaryColor, color: '#0a0a0a' }}
                      >
                        Book Now &rarr;
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
