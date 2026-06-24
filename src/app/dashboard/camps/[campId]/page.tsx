/**
 * Sprint 9 — Camp detail / roster page.
 *
 * Admin-only page that lists every player booked onto one specific camp,
 * with summary stats (booked / capacity / revenue) and the manual
 * "Add player" entry point.
 *
 * Read-only on the server side: every mutation goes through the
 * client component + the /api/admin/camps/[campId]/add-player route.
 *
 * No subscription / capacity-RPC / trial / Stripe-fee logic is touched.
 * Read-only SELECTs on camps, camp_bookings, players, profiles.
 */
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireFeature } from '@/lib/features'
import AddPlayerToCamp, { type RosterPlayer } from './AddPlayerToCamp'
import RosterClient, { type CampRosterBooking } from './RosterClient'

function fmtDateRange(start: string, end: string): string {
  const s = new Date(start + 'T00:00:00Z')
  const e = new Date(end + 'T00:00:00Z')
  const sameDay = start === end
  if (sameDay) {
    return s.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  }
  return `${s.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })} → ${e.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}`
}

export default async function CampDetailPage({
  params,
}: {
  params: Promise<{ campId: string }>
}) {
  const { campId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')
  await requireFeature('camps')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, organisation_id')
    .eq('id', user.id)
    .single()
  if (!profile || !['admin', 'coach'].includes(profile.role as string)) {
    redirect('/dashboard')
  }
  const orgId = profile.organisation_id as string

  // Camp + cross-tenant guard
  const { data: camp } = await supabase
    .from('camps')
    .select('id, organisation_id, name, start_date, end_date, location, max_capacity, price, is_published')
    .eq('id', campId)
    .maybeSingle()
  if (!camp || camp.organisation_id !== orgId) {
    redirect('/dashboard/camps')
  }

  // Roster — newest first. Sprint 10: also pulls medical_info + child_age
  // for the workspace's safety badge + age column. Forward-compatible with
  // the Sprint 9 booking_source column (catches 42703).
  type BookingRow = {
    id: string
    child_name: string | null
    child_age: number | null
    parent_name: string | null
    parent_email: string | null
    parent_phone: string | null
    medical_info: string | null
    amount_paid: number | null
    payment_status: string
    booking_source: string | null
    created_at: string
  }
  let bookingsRaw: unknown[] | null = null
  const firstAttempt = await supabase
    .from('camp_bookings')
    .select('id, child_name, child_age, parent_name, parent_email, parent_phone, medical_info, amount_paid, payment_status, booking_source, created_at')
    .eq('camp_id', campId)
    .eq('organisation_id', orgId)
    .order('created_at', { ascending: false })
  if (firstAttempt.error && (firstAttempt.error as { code?: string }).code === '42703') {
    const legacy = await supabase
      .from('camp_bookings')
      .select('id, child_name, child_age, parent_name, parent_email, parent_phone, medical_info, amount_paid, payment_status, created_at')
      .eq('camp_id', campId)
      .eq('organisation_id', orgId)
      .order('created_at', { ascending: false })
    bookingsRaw = (legacy.data || []) as unknown[]
  } else {
    bookingsRaw = (firstAttempt.data || []) as unknown[]
  }
  const bookings = (bookingsRaw || []) as BookingRow[]

  // Sprint 10 — resolve parent profile IDs by email for the Send-to-all
  // deep-link. Same iLIKE-equivalent semantics as the webhook handler.
  const parentEmails = Array.from(
    new Set(
      bookings
        .map((b) => (b.parent_email || '').toLowerCase().trim())
        .filter((v) => v && !v.endsWith('@theplayerportal.net')),
    ),
  )
  const parentProfileIdByEmail = new Map<string, string>()
  if (parentEmails.length > 0) {
    const { data: parentProfiles } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('organisation_id', orgId)
      .in('email', parentEmails)
    for (const p of parentProfiles || []) {
      const e = ((p as { email?: string | null }).email || '').toLowerCase()
      if (e) parentProfileIdByEmail.set(e, (p as { id: string }).id)
    }
  }

  // Academy display name for the WhatsApp templates.
  const { data: orgRow } = await supabase
    .from('organisations')
    .select('name')
    .eq('id', orgId)
    .maybeSingle()
  const academyName = (orgRow as { name?: string | null } | null)?.name || 'this academy'

  // Build the RosterClient input.
  const rosterBookings: CampRosterBooking[] = bookings.map((b) => ({
    id: b.id,
    child_name: b.child_name,
    child_age: b.child_age,
    parent_name: b.parent_name,
    parent_email: b.parent_email,
    parent_phone: b.parent_phone,
    parent_profile_id: parentProfileIdByEmail.get((b.parent_email || '').toLowerCase()) || null,
    medical_info: b.medical_info,
    amount_paid: b.amount_paid,
    payment_status: b.payment_status,
    booking_source: b.booking_source,
    created_at: b.created_at,
  }))

  // Move Camp Booking Phase 1 — load every other published, future camp in
  // the org with capacity remaining, plus its current booked count, so the
  // RosterClient modal can show a clean target-camp picker. The server
  // route re-validates everything; this list is purely a UX hint.
  const todayISO = new Date().toISOString().split('T')[0]
  const { data: otherCamps } = await supabase
    .from('camps')
    .select('id, name, start_date, end_date, location, max_capacity, price, early_bird_price, early_bird_deadline')
    .eq('organisation_id', orgId)
    .eq('is_published', true)
    .neq('id', campId)
    .gte('start_date', todayISO)
    .order('start_date', { ascending: true })
  const targetCampIds = (otherCamps || []).map((c) => c.id as string)
  const targetBookedCounts = new Map<string, number>()
  if (targetCampIds.length > 0) {
    const { data: targetBookings } = await supabase
      .from('camp_bookings')
      .select('camp_id, payment_status')
      .in('camp_id', targetCampIds)
      .in('payment_status', ['pending', 'paid'])
    for (const b of targetBookings || []) {
      const cid = (b as { camp_id: string }).camp_id
      targetBookedCounts.set(cid, (targetBookedCounts.get(cid) || 0) + 1)
    }
  }
  const eligibleTargetCamps = (otherCamps || []).map((c) => {
    const earlyBirdActive =
      (c.early_bird_price as number | null) != null &&
      (c.early_bird_deadline as string | null) != null &&
      todayISO <= (c.early_bird_deadline as string)
    const effectivePrice = earlyBirdActive
      ? Number(c.early_bird_price)
      : Number((c.price as number | null) ?? 0)
    const cap = (c.max_capacity as number | null) ?? 0
    const bookedCount = targetBookedCounts.get(c.id as string) ?? 0
    return {
      id: c.id as string,
      name: c.name as string,
      start_date: c.start_date as string | null,
      end_date: c.end_date as string | null,
      location: c.location as string | null,
      capacity: cap,
      booked: bookedCount,
      effective_price: Math.round(effectivePrice * 100) / 100,
    }
  })

  // Stats — exclude cancelled, count pending+paid as "booked"
  const booked = bookings.filter((b) => ['pending', 'paid'].includes(b.payment_status))
  const paid = bookings.filter((b) => b.payment_status === 'paid')
  const revenue = paid.reduce((sum, b) => sum + Number(b.amount_paid || 0), 0)
  const capacity = (camp.max_capacity as number) || 0
  const remaining = capacity > 0 ? Math.max(0, capacity - booked.length) : null

  // Player picker — every player in the org NOT already booked onto this
  // camp (by child-name match). The picker also stays useful for academies
  // with hundreds of players because the client-side filter trims as you type.
  const bookedChildNames = new Set(
    bookings.map((b) => (b.child_name || '').trim()).filter(Boolean),
  )
  const { data: allPlayers } = await supabase
    .from('players')
    .select('id, first_name, last_name, parent_id')
    .eq('organisation_id', orgId)
    .order('first_name')
  const parentIds = Array.from(
    new Set((allPlayers || []).map((p) => (p as { parent_id?: string | null }).parent_id).filter((v): v is string => !!v)),
  )
  const parentNameById = new Map<string, string>()
  if (parentIds.length > 0) {
    const { data: parents } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', parentIds)
    for (const p of parents || []) {
      parentNameById.set(p.id as string, (p as { full_name?: string | null }).full_name || 'Parent')
    }
  }
  const availablePlayers: RosterPlayer[] = (allPlayers || [])
    .map((p) => ({
      id: p.id as string,
      first_name: (p as { first_name?: string }).first_name || '',
      last_name: (p as { last_name?: string }).last_name || '',
      parentName: (p as { parent_id?: string | null }).parent_id ? parentNameById.get((p as { parent_id: string }).parent_id) || null : null,
    }))
    .filter((p) => !bookedChildNames.has(`${p.first_name} ${p.last_name}`.trim()))

  return (
    <div className="space-y-6 p-6 lg:p-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-white/50">
        <Link href="/dashboard/camps" className="hover:text-[#4ecde6] transition-colors">Camps</Link>
        <span>/</span>
        <span className="text-white/80">{camp.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">{camp.name}</h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-white/55 flex-wrap">
            <span>{fmtDateRange(camp.start_date as string, camp.end_date as string)}</span>
            {camp.location && <span>· {camp.location}</span>}
            {camp.price != null && <span>· £{Number(camp.price).toFixed(0)} per place</span>}
            {!camp.is_published && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300">Draft</span>
            )}
          </div>
        </div>
        <AddPlayerToCamp
          campId={camp.id as string}
          campName={camp.name as string}
          players={availablePlayers}
        />
      </div>

      {/* Stats — 4 cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-testid="camp-roster-stats">
        <StatCard label="Booked players" value={String(booked.length)} tone="white" testId="stat-booked" />
        <StatCard label="Total booked" value={String(bookings.length)} tone="muted" testId="stat-total" />
        <StatCard label="Remaining spaces" value={remaining === null ? '—' : String(remaining)} tone={remaining === 0 ? 'red' : 'cyan'} testId="stat-remaining" />
        <StatCard label="Revenue collected" value={`£${revenue.toFixed(2)}`} tone="green" testId="stat-revenue" />
      </div>

      {/* Sprint 10 — Roster Workspace.
          Search · Send-to-all · Print · CSV · WhatsApp · Resend confirmation.
          All client-side interactivity lives in RosterClient. */}
      <RosterClient
        campId={camp.id as string}
        campName={camp.name as string}
        academyName={academyName}
        bookings={rosterBookings}
        eligibleTargetCamps={eligibleTargetCamps}
        sourceCampPrice={(camp.price as number | null) ?? 0}
        callerIsAdmin={profile.role === 'admin'}
      />
    </div>
  )
}

function StatCard({
  label,
  value,
  tone,
  testId,
}: {
  label: string
  value: string
  tone: 'white' | 'green' | 'cyan' | 'red' | 'muted'
  testId: string
}) {
  const toneClass: Record<typeof tone, string> = {
    white: 'text-white',
    green: 'text-emerald-400',
    cyan: 'text-[#4ecde6]',
    red: 'text-red-400',
    muted: 'text-white/60',
  } as Record<typeof tone, string>
  return (
    <div
      className="rounded-xl border border-white/[0.08] bg-[#141414] p-4"
      data-testid={testId}
    >
      <div className="text-[10px] text-white/40 uppercase tracking-wider font-bold">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${toneClass[tone]}`}>{value}</div>
    </div>
  )
}

