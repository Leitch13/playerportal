/**
 * Sprint 11a — Live Register (default landing from a class card).
 *
 * Before Sprint 11a, this URL rendered the printable monthly report.
 * That report has moved to `./report/page.tsx` (reachable via the Tabs
 * strip or directly at /dashboard/attendance/register/[groupId]/report).
 *
 * Server-side responsibilities:
 *   • Auth + admin/coach gate (parents bounce to /dashboard/attendance)
 *   • Pull the group + active enrolments + pitch-side player fields
 *     (photo_url, date_of_birth, medical_info, emergency_contact_*)
 *   • Pull trial guests for the chosen session date
 *   • Hand the data to LiveRegisterClient
 *
 * The client component owns: date picker, per-row ✓/✗ toggles, bulk
 * actions, sticky save bar, existing-attendance pre-fill.
 *
 * No protected system touched. No schema change. No Stripe / RLS /
 * capacity / messaging code in this diff.
 */
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/lib/types'
import LiveRegisterClient, {
  type LiveRegisterPlayer,
  type LiveRegisterTrial,
} from './LiveRegisterClient'
import RegisterTabs from './Tabs'

function todayIso(): string {
  return new Date().toISOString().split('T')[0]
}

function fmtPretty(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

export default async function RegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>
  searchParams: Promise<{ date?: string }>
}) {
  const { groupId } = await params
  const sp = await searchParams
  const sessionDate = sp.date || todayIso()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, organisation_id')
    .eq('id', user.id)
    .single()
  if (!profile) redirect('/dashboard')

  const role = (profile?.role || 'parent') as UserRole
  if (role === 'parent') redirect('/dashboard/attendance')

  const orgId = profile?.organisation_id || ''

  // Group + coach
  const { data: group } = await supabase
    .from('training_groups')
    .select('id, name, day_of_week, time_slot, location, coach_id, coach:profiles!training_groups_coach_id_fkey(full_name)')
    .eq('id', groupId)
    .single()
  if (!group) redirect('/dashboard/attendance/register')

  const coach = group.coach as unknown as { full_name: string | null } | null

  // Active enrolments + pitch-side player fields. Sprint 11a pulls
  // photo, DOB, medical, and emergency contact in addition to the
  // identifiers the legacy register used.
  const { data: enrolments } = await supabase
    .from('enrolments')
    .select(`
      player_id,
      player:players(
        id, first_name, last_name,
        photo_url, date_of_birth,
        medical_info,
        emergency_contact_name, emergency_contact_phone
      )
    `)
    .eq('group_id', groupId)
    .eq('status', 'active')

  const players: LiveRegisterPlayer[] = (enrolments || [])
    .map((e) => e.player as unknown as LiveRegisterPlayer | null)
    .filter((p): p is LiveRegisterPlayer => !!p)
    .sort((a, b) => {
      const an = `${a.last_name || ''} ${a.first_name || ''}`.toLowerCase()
      const bn = `${b.last_name || ''} ${b.first_name || ''}`.toLowerCase()
      return an.localeCompare(bn)
    })

  // Trial guests booked into this class for the chosen date. Same
  // contract as the legacy register's trial block — informational only.
  const { data: trialRows } = await supabase
    .from('trial_bookings')
    .select('id, parent_name, parent_email, parent_phone, child_name, child_age, preferred_date, status')
    .eq('training_group_id', groupId)
    .in('status', ['pending', 'confirmed', 'attended', 'no_show'])
    .eq('preferred_date', sessionDate)
  const trials: LiveRegisterTrial[] = (trialRows || []).map((t) => ({
    id: (t as { id: string }).id,
    child_name: (t as { child_name: string }).child_name,
    child_age: (t as { child_age?: number | null }).child_age ?? null,
    parent_name: (t as { parent_name: string }).parent_name,
    parent_email: (t as { parent_email: string }).parent_email,
    parent_phone: (t as { parent_phone?: string | null }).parent_phone ?? null,
    preferred_date: (t as { preferred_date?: string | null }).preferred_date ?? null,
    status: (t as { status?: string }).status ?? 'pending',
  }))

  return (
    <div className="space-y-4 p-6 lg:p-8 bg-[#0a0a0a] -m-6 lg:-m-8 min-h-screen text-white pb-24">
      {/* ─── Breadcrumb ─── */}
      <div className="flex items-center gap-2 text-sm text-white/50">
        <Link href="/dashboard/groups" className="hover:text-[#4ecde6] transition-colors">Classes</Link>
        <span>/</span>
        <Link href={`/dashboard/groups/${groupId}`} className="hover:text-[#4ecde6] transition-colors">{group.name}</Link>
        <span>/</span>
        <span className="text-white/80">Live Register</span>
      </div>

      {/* ─── Header ─── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">{group.name}</h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-white/55 flex-wrap">
            <span data-testid="live-register-date-label">{fmtPretty(sessionDate)}</span>
            {group.time_slot && <span>· {group.time_slot}</span>}
            {group.location && <span>· {group.location}</span>}
            {coach?.full_name && <span>· Coach: {coach.full_name}</span>}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <RegisterTabs groupId={groupId} />
          <Link
            href={`/dashboard/attendance/qr/${groupId}`}
            data-testid="live-register-open-qr"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-white/[0.04] text-white/85 border border-white/10 hover:bg-white/[0.08] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h7v7H3V3zm11 0h7v7h-7V3zm-11 11h7v7H3v-7zm14 3.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5zm0 0v3.5m0-10V7" />
            </svg>
            Open QR display
          </Link>
        </div>
      </div>

      {/* ─── Live Register client ─── */}
      <LiveRegisterClient
        groupId={groupId}
        groupName={group.name as string}
        orgId={orgId}
        defaultDate={sessionDate}
        players={players}
        trials={trials}
      />
    </div>
  )
}
