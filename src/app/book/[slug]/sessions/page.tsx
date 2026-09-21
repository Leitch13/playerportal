import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { adminClient, getCoaches, getSettings, getVenues, loadAvailability, gbp } from '@/lib/one-to-one/db'
import { freeSessions } from '@/lib/one-to-one/availability'
import { addDays, todayLondon } from '@/lib/one-to-one/time'
import BookSessions from './BookSessions'

export const dynamic = 'force-dynamic'

// Public: book a genuinely free 1-2-1 session at this academy. No login.
// Regulars never appear here; the engine subtracts them before render.

async function loadOrg(slug: string) {
  const admin = adminClient()
  const { data: org } = await admin.from('organisations').select('id, name, slug, logo_url, primary_color, is_published, pilot').eq('slug', slug).maybeSingle()
  if (!org || (org.is_published === false && !org.pilot)) return null
  return { admin, org }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const loaded = await loadOrg(slug)
  return { title: loaded ? `Book a 1-to-1 · ${loaded.org.name}` : 'Not found' }
}

export default async function SessionsPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ booked?: string; session?: string; cancelled?: string }> }) {
  const { slug } = await params
  const sp = await searchParams
  const loaded = await loadOrg(slug)
  if (!loaded) notFound()
  const { admin, org } = loaded
  const today = todayLondon()
  const [settings, venues, coaches, input] = await Promise.all([
    getSettings(admin, org.id), getVenues(admin, org.id), getCoaches(admin, org.id), loadAvailability(admin, org.id, today, addDays(today, 27)),
  ])
  const free = freeSessions(input)
  const first = (id: string) => coaches.find((c) => c.id === id)?.full_name?.split(' ')[0] || 'Coach'
  // Four weeks of free time. The old cap of 60 cut the later weeks off for any academy with two coaches.
  const initial = free.slice(0, 800).map((f) => ({
    date: f.date, startMinutes: f.startMinutes, coachId: f.coachId, coach: first(f.coachId), venueId: f.venueId, venue: venues.find((v) => v.id === f.venueId)?.name || '',
  }))

  let booked: { childName: string; date: string; startMinutes: number; coach: string; venue: string } | null = null
  if (sp.booked === '1' && sp.session) {
    const { data: s } = await admin.from('coaching_sessions').select('guest_child_name, session_date, start_minutes, coach_id, venue_id, status').eq('id', sp.session).eq('organisation_id', org.id).maybeSingle()
    if (s) booked = { childName: s.guest_child_name || 'Your child', date: s.session_date, startMinutes: s.start_minutes, coach: first(s.coach_id), venue: venues.find((v) => v.id === s.venue_id)?.name || '' }
  }
  const primary = (org.primary_color as string) || '#4ecde6'

  return (
    <main className="min-h-screen bg-[#080e18] text-white" style={{ backgroundImage: `radial-gradient(60rem 28rem at 50% -8rem, ${primary}24, transparent 70%)` }}>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <header className="mb-6">
          <div className="flex items-center gap-3.5">
            {org.logo_url ? <img src={org.logo_url as string} alt="" className="h-14 w-14 rounded-2xl object-cover ring-1 ring-white/10" /> : <div className="h-14 w-14 rounded-2xl" style={{ background: primary }} />}
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold uppercase tracking-[0.08em] text-white/50">{org.name}</div>
              <h1 className="text-2xl font-bold leading-tight sm:text-3xl">Book a 1-to-1</h1>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5 text-xs">
            <span className="rounded-full border border-white/[0.12] bg-white/[0.04] px-3 py-1 font-semibold text-white/85">{gbp(settings.one_to_one_price_pence)} a session</span>
            <span className="rounded-full border border-white/[0.12] bg-white/[0.04] px-3 py-1 text-white/70">{settings.session_minutes} minutes</span>
            <span className="rounded-full border border-white/[0.12] bg-white/[0.04] px-3 py-1 text-white/70">Pick a time, pay online, done</span>
          </div>
        </header>
        <BookSessions
          slug={slug}
          academy={org.name as string}
          primary={primary}
          durationMinutes={settings.session_minutes}
          venues={venues.filter((v) => v.is_active).map((v) => ({ id: v.id, name: v.name, address: v.address }))}
          initial={initial}
          today={today}
          booked={booked}
          cancelled={sp.cancelled === '1'}
          priceLabel={gbp(settings.one_to_one_price_pence)}
        />
      </div>
    </main>
  )
}
