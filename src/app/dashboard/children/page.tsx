import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import EmptyState from '@/components/EmptyState'
import AddChildForm from './AddChildForm'
import ChildEditor from '../account/ChildEditor'
import PhotoUpload from '@/components/PhotoUpload'
import { ageOn, nextClassDate } from '@/lib/class-register'
import { hasMedicalNote } from '@/lib/camp-booking-details'
import { membershipPill } from '@/lib/needs-a-look'

export default async function ChildrenPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')

  const { data: profile } = await supabase
    .from('profiles')
    .select('organisation_id')
    .eq('id', user.id)
    .single()

  const orgId = profile?.organisation_id || ''

  const { data: players } = await supabase
    .from('players')
    .select(`
      id, first_name, last_name, date_of_birth, age_group, position, kit_size, school,
      photo_url, medical_info, emergency_contact_name, emergency_contact_phone, notes,
      enrolments(id, status, group:training_groups(name, day_of_week, time_slot, location))
    `)
    .eq('parent_id', user.id)
    .order('first_name')

  type EnrolmentRow = {
    id: string
    status: string
    group: {
      name: string
      day_of_week: string | null
      time_slot: string | null
      location: string | null
    } | null
  }

  // What each child is paying for, so the card can say so (or say that nothing is set up yet).
  const childIds = (players || []).map((p) => p.id as string)
  const { data: subRows } = childIds.length > 0
    ? await supabase.from('subscriptions').select('player_id, status, created_at, plan:subscription_plans(name, amount)').in('player_id', childIds)
    : { data: [] as never[] }
  type SubRow = { player_id: string | null; status: string | null; created_at?: string | null; plan: { name: string | null; amount: number | null } | null }
  const subsByChild = new Map<string, SubRow[]>()
  for (const r of (subRows || []) as unknown as SubRow[]) if (r.player_id) subsByChild.set(r.player_id, [...(subsByChild.get(r.player_id) || []), r])

  const todayUk = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' })
  const kids = players || []
  const classCount = kids.reduce((n, p) => n + (((p.enrolments as unknown as EnrolmentRow[]) || []).filter((e) => e.status === 'active').length), 0)

  return (
    <div className="bg-[#080e18] -m-6 lg:-m-8 p-4 sm:p-6 lg:p-8 min-h-screen text-white">
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">My Children</h1>
        <p className="mt-1 text-sm text-white/50" data-testid="children-summary">
          {kids.length === 0 ? 'Add your child to book their first class.' : `${kids.length} ${kids.length === 1 ? 'child' : 'children'} · ${classCount} ${classCount === 1 ? 'class' : 'classes'} a week`}
        </p>
      </div>

      {kids.length === 0 ? (
        <EmptyState message="No children added yet. Use the button below to add your first child." />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2" data-testid="children-cards">
          {kids.map((player) => {
            const enrolments = (player.enrolments as unknown as EnrolmentRow[]) || []
            const activeGroups = enrolments.filter((e) => e.status === 'active')
            const age = ageOn(player.date_of_birth as string | null, todayUk)
            const born = player.date_of_birth
              ? new Date((player.date_of_birth as string).slice(0, 10) + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
              : null
            const subs = subsByChild.get(player.id as string) || []
            const pill = membershipPill(subs.map((x) => x.status))
            const live = subs.find((x) => x.status === 'active' || x.status === 'trialing')
            const missing = [!player.date_of_birth && 'date of birth', !(player.medical_info as string | null)?.trim() && 'medical information', !player.emergency_contact_phone && 'an emergency contact'].filter(Boolean) as string[]
            // The soonest session across this child's classes.
            const upcoming = activeGroups
              .map((e) => ({ e, date: nextClassDate(todayUk, e.group?.day_of_week ?? null) }))
              .filter((x): x is { e: EnrolmentRow; date: string } => !!x.date)
              .sort((a, b) => a.date.localeCompare(b.date))[0]
            const nextLabel = upcoming
              ? upcoming.date === todayUk ? 'Today' : new Date(upcoming.date + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
              : null
            const since = live?.created_at ? new Date(live.created_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : null
            const dot = pill.tone === 'ok' ? 'bg-emerald-400' : pill.tone === 'bad' ? 'bg-red-400' : pill.tone === 'warn' ? 'bg-amber-400' : 'bg-white/30'
            const stat = (label: string, big: React.ReactNode, small?: React.ReactNode) => (
              <div className="px-3 py-3 text-center first:pl-0 last:pr-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">{label}</p>
                <p className="mt-1 text-lg font-bold leading-none tabular-nums text-white">{big}</p>
                {small && <p className="mt-1 text-[11px] text-white/45">{small}</p>}
              </div>
            )
            const tile = (label: string, icon: string, value: React.ReactNode) => (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3.5">
                <div className="flex items-center gap-2">
                  <svg className="h-3.5 w-3.5 text-[#4ecde6]/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d={icon} /></svg>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">{label}</span>
                </div>
                <div className="mt-1.5 break-words text-[13px] leading-snug text-white/85">{value}</div>
              </div>
            )
            const notYet = <span className="text-amber-200/85">Not added yet</span>

            return (
              <article key={player.id} data-testid="child-card"
                className="overflow-hidden rounded-3xl border border-[#243652] bg-gradient-to-b from-[#132238] to-[#0d1726] shadow-[0_18px_50px_-24px_rgba(0,0,0,0.9)]">
                {/* Who they are */}
                <div className="relative px-5 pb-5 pt-6">
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(120%_100%_at_0%_0%,rgba(78,205,230,0.16),transparent_60%)]" />
                  <div className="relative flex items-center gap-4">
                    {/* A cyan ring on the photo itself (the first thing inside the photo control), not on its "Add Photo" link. */}
                    <div className="shrink-0 [&_.group>:first-child]:border-transparent [&_.group>:first-child]:ring-2 [&_.group>:first-child]:ring-[#4ecde6]/70 [&_.group>:first-child]:ring-offset-[3px] [&_.group>:first-child]:ring-offset-[#122035]">
                      <PhotoUpload playerId={player.id} currentPhotoUrl={player.photo_url} firstName={player.first_name} lastName={player.last_name} size="lg" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-xl font-bold tracking-tight text-white">{player.first_name} {player.last_name}</h2>
                      <p className="mt-0.5 text-[13px] text-white/50">{born ? `Born ${born}` : 'Date of birth not added'}</p>
                      <span className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-white/85" data-testid="child-membership">
                        <i className={`h-1.5 w-1.5 rounded-full ${dot}`} />{pill.label === 'Paying' ? 'Active member' : pill.label}
                      </span>
                    </div>
                  </div>

                  <div className="relative mt-5 grid grid-cols-3 divide-x divide-white/[0.07] rounded-2xl border border-white/[0.07] bg-black/20 px-3" data-testid="child-stats">
                    {stat('Age', age ?? '—', player.age_group || undefined)}
                    {stat('Classes', activeGroups.length, activeGroups.length === 1 ? 'a week' : 'a week')}
                    {stat('Membership', live?.plan?.amount ? `£${Number(live.plan.amount).toFixed(0)}` : '—', live?.plan?.amount ? (since ? `a month · since ${since}` : 'a month') : 'not set up')}
                  </div>
                </div>

                {/* Next session */}
                <div className="px-5 pb-5">
                  {upcoming ? (
                    <div className="rounded-2xl border border-[#4ecde6]/25 bg-[#4ecde6]/[0.07] p-4" data-testid="child-next">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#4ecde6]">Next session</p>
                        <Link href="/dashboard/schedule" className="text-[11px] font-semibold text-[#4ecde6] hover:underline">Schedule →</Link>
                      </div>
                      <div className="mt-2 flex items-end justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-base font-bold text-white">{nextLabel}</p>
                          <p className="mt-0.5 truncate text-[13px] text-white/60">{upcoming.e.group?.name}{upcoming.e.group?.location ? ` · ${upcoming.e.group.location}` : ''}</p>
                        </div>
                        {upcoming.e.group?.time_slot && <span className="shrink-0 rounded-lg bg-[#4ecde6] px-2.5 py-1 text-sm font-bold tabular-nums text-[#04141a]">{upcoming.e.group.time_slot.split(/[–-]/)[0]}</span>}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-white/[0.14] p-4 text-sm text-white/60" data-testid="child-next">
                      {activeGroups.length === 0 ? <>Not in a class yet. <Link href="/dashboard/schedule" className="font-semibold text-[#4ecde6] hover:underline">Book a class</Link></> : 'No set day for this class yet.'}
                    </div>
                  )}

                  {activeGroups.length > 1 && (
                    <ul className="mt-2.5 space-y-1.5">
                      {activeGroups.filter((e) => e.id !== upcoming?.e.id).map((e) => (
                        <li key={e.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.035] px-3.5 py-2.5">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-white">{e.group?.name}</p>
                            <p className="truncate text-xs text-white/50">{[e.group?.day_of_week ? `${e.group.day_of_week}s` : null, e.group?.location].filter(Boolean).join(' · ')}</p>
                          </div>
                          {e.group?.time_slot && <span className="shrink-0 text-sm font-bold tabular-nums text-[#4ecde6]">{e.group.time_slot}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* What the coach needs to know */}
                <div className="border-t border-white/[0.06] px-5 py-5">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">Details for the coach</h3>
                    {missing.length === 0 && <span className="text-[11px] font-semibold text-emerald-300">All complete</span>}
                  </div>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {tile('Medical', 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 8v8M8 12h8', hasMedicalNote(player.medical_info as string | null) ? <span className="text-amber-200">{player.medical_info}</span> : (player.medical_info as string | null)?.trim() ? player.medical_info : notYet)}
                    {tile('Emergency contact', 'M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z', player.emergency_contact_phone ? <>{player.emergency_contact_name ? <span className="block text-white">{player.emergency_contact_name}</span> : null}{player.emergency_contact_phone}</> : notYet)}
                    {player.school && tile('School', 'M12 3L2 8l10 5 10-5-10-5zM6 10.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-5.5', player.school)}
                    {player.kit_size && tile('Kit size', 'M8 3l4 2 4-2 5 4-3 3-2-1v12H8V9L6 10 3 7l5-4z', player.kit_size)}
                  </div>
                  {player.notes && <p className="mt-2.5 text-xs text-white/45"><span className="font-semibold text-white/70">Notes:</span> {player.notes}</p>}
                  {missing.length > 0 && (
                    <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-3.5 py-2.5 text-xs leading-relaxed text-amber-100/90" data-testid="child-missing">
                      <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.3 3.9L2.5 17.5A2 2 0 004.2 20.5h15.6a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" /></svg>
                      <span>Your coach still needs {missing.join(', ').replace(/, ([^,]*)$/, ' and $1')}. Tap Edit details to add {missing.length === 1 ? 'it' : 'them'}.</span>
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-start gap-2 border-t border-white/[0.06] bg-black/15 px-5 py-4">
                  <Link href={`/dashboard/players/${player.id}`} className="rounded-xl bg-[#4ecde6] px-4 py-2 text-xs font-bold text-[#04141a] transition hover:brightness-105">View profile</Link>
                  <div className="min-w-0 flex-1"><ChildEditor child={player} /></div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      <AddChildForm orgId={orgId} />
    </div>
    </div>
  )
}
