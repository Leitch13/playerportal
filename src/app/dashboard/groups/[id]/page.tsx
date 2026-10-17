import { redirect } from 'next/navigation'
import { PALETTE_ICON_PATHS } from '@/components/ui/PaletteIcon'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
// Sprint 8a — per-row kebab with View / Message parent / Remove from class.
import ClassRegister, { type RegisterChild, type RegisterTrialGuest } from './ClassRegister'
import { membershipPill } from '@/lib/needs-a-look'
import { loadClassOutstanding } from '@/lib/class-outstanding'
import { pricesForClass } from '@/lib/class-prices'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { ageOn, latestClassDate } from '@/lib/class-register'
import { paidTrialPence } from '@/lib/trial-booking'

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')

  const { data: profile } = await supabase
    .from('profiles')
    .select('organisation_id, role')
    .eq('id', user.id)
    .single()

  const role = profile?.role || 'parent'
  const isAdmin = role === 'admin' || role === 'coach'

  // Fetch group with coach info
  const { data: group } = await supabase
    .from('training_groups')
    .select('*, coach:profiles!training_groups_coach_id_fkey(id, full_name, email)')
    .eq('id', id)
    .single()

  if (!group) redirect('/dashboard/groups')

  // Fetch enrolled players. Sprint 8a additions: pull parent_id from the
  // player embed (drives the Message parent deep-link) and keep the
  // enrolment id (drives Remove from class).
  type EnrolmentRosterRow = {
    id: string
    status: string
    player: {
      id: string
      first_name: string
      last_name: string
      photo_url: string | null
      parent_id: string | null
      date_of_birth?: string | null
      medical_info?: string | null
      emergency_contact_name?: string | null
      emergency_contact_phone?: string | null
    } | null
    is_trial?: boolean | null
  }
  const { data: enrolmentsRaw } = await supabase
    .from('enrolments')
    .select('id, status, is_trial, player:players(id, first_name, last_name, photo_url, parent_id, date_of_birth, medical_info, emergency_contact_name, emergency_contact_phone)')
    .eq('group_id', id)
    .eq('status', 'active')

  const enrolments = (enrolmentsRaw || []) as unknown as EnrolmentRosterRow[]

  // Resolve parent names in a single round-trip. Anything missing falls
  // back to "Parent" so the row still renders gracefully.
  const parentIds = Array.from(
    new Set(enrolments.map((e) => e.player?.parent_id).filter((v): v is string => !!v))
  )
  const parentNameById = new Map<string, string>()
  const parentContactById = new Map<string, { phone: string | null; email: string | null }>()
  if (parentIds.length > 0) {
    const { data: parents } = await supabase
      .from('profiles')
      .select('id, full_name, phone, email')
      .in('id', parentIds)
    for (const p of parents || []) {
      parentNameById.set(p.id as string, (p as { full_name?: string | null }).full_name || 'Parent')
      parentContactById.set(p.id as string, { phone: (p as { phone?: string | null }).phone || null, email: (p as { email?: string | null }).email || null })
    }
  }

  // Other-active-class count per player — surfaced in the Remove confirmation
  // so the admin knows whether this is the player's last class. Single query
  // scoped by player_id set + status = 'active'.
  const playerIds = Array.from(
    new Set(enrolments.map((e) => e.player?.id).filter((v): v is string => !!v))
  )
  const otherActiveCountById = new Map<string, number>()
  if (playerIds.length > 0) {
    const { data: allActive } = await supabase
      .from('enrolments')
      .select('player_id, group_id')
      .in('player_id', playerIds)
      .eq('status', 'active')
    for (const row of allActive || []) {
      const pid = (row as { player_id?: string }).player_id || ''
      const gid = (row as { group_id?: string }).group_id || ''
      if (!pid || gid === id) continue  // exclude THIS class
      otherActiveCountById.set(pid, (otherActiveCountById.get(pid) || 0) + 1)
    }
  }

  const players = enrolments
    .map((e) => e.player)
    .filter((p): p is NonNullable<EnrolmentRosterRow['player']> => !!p)
    .sort((a, b) => a.first_name.localeCompare(b.first_name))

  // ── The register (admins and coaches). Everything a coach needs about each
  //    child in one list; see ClassRegister.tsx and src/lib/class-register.ts.
  const todayUk = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' })
  const subStatusesByPlayer = new Map<string, string[]>()
  const failingSubsByPlayer = new Map<string, string[]>()
  let trialGuests: RegisterTrialGuest[] = []
  if (isAdmin) {
    if (playerIds.length > 0) {
      const { data: subs } = await supabase
        .from('subscriptions')
        .select('player_id, status, stripe_subscription_id')
        .in('player_id', playerIds)
        .eq('organisation_id', group.organisation_id)
      for (const sRow of (subs || []) as { player_id: string | null; status: string | null; stripe_subscription_id: string | null }[]) {
        if (!sRow.player_id || !sRow.status) continue
        // Memberships whose payment failed or was never finished: Remove offers to cancel them too.
        if (['past_due', 'unpaid', 'incomplete'].includes(sRow.status) && sRow.stripe_subscription_id) {
          failingSubsByPlayer.set(sRow.player_id, [...(failingSubsByPlayer.get(sRow.player_id) || []), sRow.stripe_subscription_id])
        }
        subStatusesByPlayer.set(sRow.player_id, [...(subStatusesByPlayer.get(sRow.player_id) || []), sRow.status])
      }
    }
    const from = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10)
    const { data: trials } = await supabase
      .from('trial_bookings')
      .select('id, child_name, child_age, parent_name, parent_phone, preferred_date, notes, status')
      .eq('training_group_id', id)
      .gte('preferred_date', from)
      .neq('status', 'cancelled')
    trialGuests = ((trials || []) as { id: string; child_name: string; child_age: number | null; parent_name: string | null; parent_phone: string | null; preferred_date: string | null; notes: string | null }[])
      .map((t) => ({ id: t.id, childName: (t.child_name || '').replace(/\s+/g, ' ').trim(), childAge: t.child_age, parentName: t.parent_name, parentPhone: t.parent_phone, date: t.preferred_date, paid: paidTrialPence(t.notes) != null }))
  }
  // Red box next to each child: what's outstanding (src/lib/class-outstanding.ts). Staff only.
  const outstandingByPlayer = isAdmin
    ? await loadClassOutstanding(
        createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!),
        group.organisation_id as string,
        enrolments.filter((e) => e.player).map((e) => e.player!.id),
        new Set(enrolments.filter((e) => e.player && e.is_trial === true).map((e) => e.player!.id)),
      )
    : new Map<string, string | null>()
  const { data: orgPlans } = isAdmin
    ? await supabase.from('subscription_plans').select('id, name, amount, training_group_id, class_type, active').eq('organisation_id', group.organisation_id)
    : { data: [] }
  const classPrices = pricesForClass((orgPlans || []) as { id: string; name: string; amount: number; training_group_id: string | null; class_type: string | null; active: boolean | null }[], { id: group.id as string, class_type: group.class_type as string | null })

  const registerChildren: RegisterChild[] = enrolments.filter((e) => e.player).map((e) => {
    const p = e.player!
    const contact = p.parent_id ? parentContactById.get(p.parent_id) : undefined
    return {
      enrolmentId: e.id,
      playerId: p.id,
      firstName: p.first_name,
      lastName: p.last_name,
      age: ageOn(p.date_of_birth, todayUk),
      dob: p.date_of_birth || null,
      medical: p.medical_info || null,
      emergencyName: p.emergency_contact_name || null,
      emergencyPhone: p.emergency_contact_phone || null,
      parentId: p.parent_id,
      parentName: p.parent_id ? parentNameById.get(p.parent_id) || null : null,
      parentPhone: contact?.phone || null,
      parentEmail: contact?.email || null,
      membership: membershipPill(subStatusesByPlayer.get(p.id) || []),
      isTrial: e.is_trial === true,
      outstanding: outstandingByPlayer.get(p.id) ?? null,
      failingSubIds: failingSubsByPlayer.get(p.id) || [],
      otherActiveClasses: otherActiveCountById.get(p.id) || 0,
    }
  })

  const coach = group.coach as unknown as { id: string; full_name: string; email: string } | null
  const capacity = (group.max_capacity as number) ?? 20
  const enrolled = players.length
  const fillPercent = Math.min(100, Math.round((enrolled / capacity) * 100))
  const isFull = enrolled >= capacity
  const isWarning = fillPercent > 90 && !isFull
  const isNearFull = fillPercent >= 70 && !isFull

  return (
    <div className="bg-[#080e18] -m-6 lg:-m-8 p-6 lg:p-8 min-h-screen text-white">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-white/50">
          <Link href="/dashboard/groups" className="hover:text-[#4ecde6] transition-colors">
            Classes
          </Link>
          <span>/</span>
          <span className="text-white/80">{group.name}</span>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">{group.name}</h1>
            {(group as any).short_description && (
              <p className="text-sm text-white/60 mt-1">{(group as any).short_description}</p>
            )}
            {!(group as any).short_description && (group as any).description && (
              <p className="text-sm text-white/60 mt-1">{(group as any).description}</p>
            )}
          </div>
          {isAdmin && (
            <Link
              href={`/dashboard/session/${group.id}`}
              className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-[#4ecde6] text-black hover:bg-[#3dbdd6] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Start Session
            </Link>
          )}
        </div>

        {/* Info cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {group.day_of_week && (
            <div className="bg-[#0f1a2b] border border-[#1d2c42] rounded-2xl p-4">
              <div className="text-xs text-white/50 mb-1">Day</div>
              <div className="text-sm font-semibold">{group.day_of_week}</div>
            </div>
          )}
          {group.time_slot && (
            <div className="bg-[#0f1a2b] border border-[#1d2c42] rounded-2xl p-4">
              <div className="text-xs text-white/50 mb-1">Time</div>
              <div className="text-sm font-semibold">{group.time_slot}</div>
            </div>
          )}
          {group.location && (
            <div className="bg-[#0f1a2b] border border-[#1d2c42] rounded-2xl p-4">
              <div className="text-xs text-white/50 mb-1">Location</div>
              <div className="text-sm font-semibold">{group.location}</div>
            </div>
          )}
          {coach && (
            <div className="bg-[#0f1a2b] border border-[#1d2c42] rounded-2xl p-4">
              <div className="text-xs text-white/50 mb-1">Coach</div>
              <div className="text-sm font-semibold">{coach.full_name}</div>
            </div>
          )}
        </div>

        {/* Capacity */}
        <div className="bg-[#0f1a2b] border border-[#1d2c42] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-white">Capacity</h2>
            <div className="flex items-center gap-2">
              {isFull && (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">FULL</span>
              )}
              <span className={`text-sm font-bold ${isFull ? 'text-red-500' : isWarning ? 'text-red-500' : isNearFull ? 'text-amber-500' : 'text-emerald-500'}`}>
                {enrolled} / {capacity}
              </span>
            </div>
          </div>
          <div className="w-full bg-[#142236] rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all duration-500 ${
                isFull
                  ? 'bg-gradient-to-r from-red-400 to-red-500'
                  : isWarning
                    ? 'bg-gradient-to-r from-red-400 to-red-500'
                    : isNearFull
                      ? 'bg-gradient-to-r from-amber-400 to-amber-500'
                      : 'bg-gradient-to-r from-emerald-400 to-emerald-500'
              }`}
              style={{ width: `${fillPercent}%` }}
            />
          </div>
          <p className="text-xs text-white/40 mt-2">
            {isFull ? 'This class is full' : `${capacity - enrolled} spot${capacity - enrolled !== 1 ? 's' : ''} remaining`}
          </p>
        </div>

        {/* Quick actions */}
        {isAdmin && (
          <div className="flex items-center gap-3 flex-wrap">
            <Link
              href={`/dashboard/attendance/register/${group.id}`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-[#0f1a2b] border border-[#1d2c42] hover:bg-[#142236] transition-colors"
            >
              <svg className="w-4 h-4 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Register
            </Link>
            <Link
              href={`/dashboard/attendance/qr/${group.id}`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-[#0f1a2b] border border-[#1d2c42] hover:bg-[#142236] transition-colors"
            >
              <svg className="w-4 h-4 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h7v7H3V3zm11 0h7v7h-7V3zm-11 11h7v7H3v-7zm14 3.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5zm0 0v3.5m0-10V7" />
              </svg>
              QR Check-in
            </Link>
            <Link
              href={`/dashboard/groups/${group.id}/plans`}
              data-testid="class-prices-button"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-[#0f1a2b] border border-[#1d2c42] hover:bg-[#142236] transition-colors"
            >
              <span className="text-white/60 font-bold">£</span>
              Prices
            </Link>
            {/* Message class — reuses the Messages page's existing
                ?recipients=<csv> deep-link (same contract as the camp
                roster's "Send to all"). parentIds is already the de-duped
                set of ACTIVE-enrolment parents for this class. */}
            {parentIds.length > 0 && (
              <Link
                href={`/dashboard/messages?recipients=${encodeURIComponent(parentIds.join(','))}`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-[#0f1a2b] border border-[#1d2c42] hover:bg-[#142236] transition-colors"
              >
                <svg className="w-4 h-4 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4-.8L3 21l1.8-4A7.96 7.96 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Message class
                <span className="text-[10px] text-white/40">({parentIds.length})</span>
              </Link>
            )}
          </div>
        )}

        {/* Prices for this class — what parents are offered when they book it (src/lib/class-prices.ts). */}
        {isAdmin && (
          classPrices.prices.length > 0 ? (
            <div className="rounded-xl border border-[#1d2c42] bg-[#0f1a2b] px-4 py-3" data-testid="class-prices">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-white/45">Prices parents see{classPrices.own ? '' : ' (your general prices)'}</p>
                <Link href={`/dashboard/groups/${group.id}/plans`} className="text-xs font-semibold text-[#4ecde6]">{classPrices.own ? 'Change' : 'Give this class its own price'}</Link>
              </div>
              <ul className="mt-1.5 flex flex-wrap gap-2">
                {classPrices.prices.map((p) => (
                  <li key={p.id} className="rounded-lg bg-white/[0.05] px-2.5 py-1 text-sm text-white">{p.name} · <span className="font-semibold">£{Number(p.amount).toFixed(2)}</span><span className="text-white/45"> a month</span></li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-3" data-testid="class-prices-none">
              <p className="text-sm font-semibold text-red-200">No price set: parents can&apos;t join or pay for this class.</p>
              <Link href={`/dashboard/groups/${group.id}/plans`} className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-600">Add a price</Link>
            </div>
          )
        )}

        <div className="h-px bg-gradient-to-r from-transparent via-[#4ecde6]/40 to-transparent" />

        {/* Enrolled players */}
        <div>
          <h2 className="text-lg font-bold text-white mb-4">
            Enrolled Players
            <span className="ml-2 text-sm font-normal text-white/50">({enrolled})</span>
          </h2>

          {players.length === 0 ? (
            <div className="bg-[#0f1a2b] border border-[#1d2c42] rounded-2xl p-8 text-center">
              <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.04]"><svg className="h-6 w-6 text-white/25" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>{PALETTE_ICON_PATHS['parents']}</svg></span>
              <p className="text-sm text-white/50">No players enrolled in this class yet</p>
            </div>
          ) : isAdmin ? (
            <ClassRegister
              canCancelMembership={role === 'admin'}
              groupId={group.id as string}
              organisationId={group.organisation_id as string}
              className={group.name as string}
              classDay={(group.day_of_week as string | null) ?? null}
              today={todayUk}
              startDate={latestClassDate(todayUk, group.day_of_week as string | null)}
              trialGuests={trialGuests}
            >
              {registerChildren}
            </ClassRegister>
          ) : (
            <div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
              data-testid="class-roster"
            >
              {/* Parents viewing this page get a plain read-only tile. */}
              {players.map((player) => (
                    <Link
                      key={player.id}
                      href={`/dashboard/players/${player.id}`}
                      className="bg-[#0f1a2b] border border-[#1d2c42] rounded-xl p-4 flex items-center gap-3 hover:bg-[#142236] hover:border-[#4ecde6]/30 transition-all group"
                    >
                      {player.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={player.photo_url}
                          alt=""
                          className="w-9 h-9 rounded-full object-cover border border-[#1d2c42]"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-[#4ecde6]/10 border border-[#4ecde6]/20 flex items-center justify-center text-xs font-bold text-[#4ecde6]">
                          {player.first_name?.[0]}{player.last_name?.[0]}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate group-hover:text-[#4ecde6] transition-colors">
                          {player.first_name} {player.last_name}
                        </div>
                      </div>
                      <svg className="w-4 h-4 text-white/20 ml-auto shrink-0 group-hover:text-[#4ecde6]/60 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
