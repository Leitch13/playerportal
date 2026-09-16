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
  const initial = free.slice(0, 60).map((f) => ({
    date: f.date, startMinutes: f.startMinutes, coachId: f.coachId, coach: first(f.coachId), venueId: f.venueId, venue: venues.find((v) => v.id === f.venueId)?.name || '',
  }))

  let booked: { childName: string; date: string; startMinutes: number; coach: string; venue: string } | null = null
  if (sp.booked === '1' && sp.session) {
    const { data: s } = await admin.from('coaching_sessions').select('guest_child_name, session_date, start_minutes, coach_id, venue_id, status').eq('id', sp.session).eq('organisation_id', org.id).maybeSingle()
    if (s) booked = { childName: s.guest_child_name || 'Your child', date: s.session_date, startMinutes: s.start_minutes, coach: first(s.coach_id), venue: venues.find((v) => v.id === s.venue_id)?.name || '' }
  }
  const primary = (org.primary_color as string) || '#4ecde6'

  return (
    <main className="min-h-screen bg-[#080e18] text-white">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
        <header className="mb-6 flex items-center gap-3">
          {org.logo_url ? <img src={org.logo_url as string} alt="" className="h-12 w-12 rounded-xl object-cover bg-[#0f1a2b]" /> : <div className="h-12 w-12 rounded-xl" style={{ background: primary }} />}
          <div>
            <div className="text-xs uppercase tracking-wide text-white/45">{org.name}</div>
            <h1 className="text-xl font-bold">Book a 1-to-1 session</h1>
          </div>
        </header>
        <BookSessions
          slug={slug}
          academy={org.name as string}
          primary={primary}
          pricePence={settings.one_to_one_price_pence}
          durationMinutes={settings.session_minutes}
          venues={venues.filter((v) => v.is_active).map((v) => ({ id: v.id, name: v.name, address: v.address }))}
          initial={initial}
          booked={booked}
          cancelled={sp.cancelled === '1'}
          priceLabel={gbp(settings.one_to_one_price_pence)}
        />
      </div>
    </main>
  )
}
