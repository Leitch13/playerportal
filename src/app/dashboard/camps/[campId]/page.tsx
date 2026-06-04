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

function fmtDateRange(start: string, end: string): string {
  const s = new Date(start + 'T00:00:00Z')
  const e = new Date(end + 'T00:00:00Z')
  const sameDay = start === end
  if (sameDay) {
    return s.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  }
  return `${s.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })} → ${e.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}`
}

function fmtBookedAt(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
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

  // Roster — newest first
  type BookingRow = {
    id: string
    child_name: string | null
    parent_name: string | null
    parent_email: string | null
    parent_phone: string | null
    amount_paid: number | null
    payment_status: string
    booking_source: string | null
    created_at: string
  }
  // Sprint 9: SELECT may fail with 42703 (undefined_column) before
  // migration 081 lands the `booking_source` column. Fall back to the
  // legacy column set so the page still renders during the rollout
  // window — the "Added by admin" badge just renders as "Online booking"
  // for everyone until the migration is in.
  let bookingsRaw: unknown[] | null = null
  const firstAttempt = await supabase
    .from('camp_bookings')
    .select('id, child_name, parent_name, parent_email, parent_phone, amount_paid, payment_status, booking_source, created_at')
    .eq('camp_id', campId)
    .eq('organisation_id', orgId)
    .order('created_at', { ascending: false })
  if (firstAttempt.error && (firstAttempt.error as { code?: string }).code === '42703') {
    const legacy = await supabase
      .from('camp_bookings')
      .select('id, child_name, parent_name, parent_email, parent_phone, amount_paid, payment_status, created_at')
      .eq('camp_id', campId)
      .eq('organisation_id', orgId)
      .order('created_at', { ascending: false })
    bookingsRaw = (legacy.data || []) as unknown[]
  } else {
    bookingsRaw = (firstAttempt.data || []) as unknown[]
  }
  const bookings = (bookingsRaw || []) as BookingRow[]

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

      {/* Roster table */}
      <div className="rounded-xl border border-white/[0.08] bg-[#141414] overflow-hidden" data-testid="camp-roster">
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-white/70">Booked players</h2>
          <span className="text-[11px] text-white/40">{bookings.length} entr{bookings.length === 1 ? 'y' : 'ies'}</span>
        </div>

        {bookings.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="text-3xl mb-2">🏕️</div>
            <p className="text-sm text-white/55">No bookings yet for this camp.</p>
            <p className="text-xs text-white/40 mt-1">
              Share the booking link or use <span className="text-white">Add player</span> to enter one manually.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/[0.02]">
                  <th className="text-left px-6 py-3 text-[10px] uppercase tracking-wider text-white/40 font-bold">Child</th>
                  <th className="text-left px-6 py-3 text-[10px] uppercase tracking-wider text-white/40 font-bold">Parent</th>
                  <th className="text-left px-6 py-3 text-[10px] uppercase tracking-wider text-white/40 font-bold">Contact</th>
                  <th className="text-left px-6 py-3 text-[10px] uppercase tracking-wider text-white/40 font-bold">Booked</th>
                  <th className="text-right px-6 py-3 text-[10px] uppercase tracking-wider text-white/40 font-bold">Amount</th>
                  <th className="text-left px-6 py-3 text-[10px] uppercase tracking-wider text-white/40 font-bold">Status</th>
                  <th className="text-left px-6 py-3 text-[10px] uppercase tracking-wider text-white/40 font-bold">Source</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr
                    key={b.id}
                    data-testid="camp-roster-row"
                    data-booking-id={b.id}
                    className="border-t border-white/[0.04] hover:bg-white/[0.02]"
                  >
                    <td className="px-6 py-3 text-white font-medium">{b.child_name || '—'}</td>
                    <td className="px-6 py-3 text-white/70">{b.parent_name || '—'}</td>
                    <td className="px-6 py-3 text-white/55 text-xs">
                      {b.parent_email && (
                        <div className="truncate max-w-[200px]">
                          <a href={`mailto:${b.parent_email}`} className="text-[#4ecde6] hover:underline">{b.parent_email}</a>
                        </div>
                      )}
                      {b.parent_phone && <div>{b.parent_phone}</div>}
                    </td>
                    <td className="px-6 py-3 text-white/55 text-xs">{fmtBookedAt(b.created_at)}</td>
                    <td className="px-6 py-3 text-right">
                      {Number(b.amount_paid || 0) > 0 ? (
                        <span className="text-emerald-400 font-semibold">£{Number(b.amount_paid).toFixed(2)}</span>
                      ) : (
                        <span className="text-white/30">£0.00</span>
                      )}
                    </td>
                    <td className="px-6 py-3">
                      <PaymentStatusPill status={b.payment_status} />
                    </td>
                    <td className="px-6 py-3 text-[11px]">
                      {b.booking_source === 'admin_created' ? (
                        <span className="px-2 py-0.5 rounded-full bg-[#4ecde6]/10 text-[#4ecde6] border border-[#4ecde6]/20 font-semibold">Added by admin</span>
                      ) : (
                        <span className="text-white/40">Online booking</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
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

function PaymentStatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    paid:      { label: 'Paid',      cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
    pending:   { label: 'Pending',   cls: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
    failed:    { label: 'Failed',    cls: 'bg-red-500/20 text-red-300 border-red-500/30' },
    refunded:  { label: 'Refunded',  cls: 'bg-violet-500/20 text-violet-300 border-violet-500/30' },
    cancelled: { label: 'Cancelled', cls: 'bg-white/10 text-white/60 border-white/15' },
  }
  const m = map[status] || { label: status, cls: 'bg-white/10 text-white/60 border-white/15' }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${m.cls}`}>
      {m.label}
    </span>
  )
}
