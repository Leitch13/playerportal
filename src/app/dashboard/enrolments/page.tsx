import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import EmptyState from '@/components/EmptyState'
import EnrolmentForm from './EnrolmentForm'
import EnrolmentStatusToggle from './EnrolmentStatusToggle'

type EnrolmentRow = {
  id: string
  status: string
  enrolled_at: string
  player_id: string
  group_id: string
  player: { first_name: string; last_name: string; age_group?: string } | null
  group: { name: string; day_of_week?: string; time_slot?: string } | null
}

export default async function EnrolmentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')

  // CRITICAL: scope all queries to the admin's own org. RLS alone is not
  // enough — super-admins bypass it. Without the explicit filter the page
  // surfaces every academy's enrolments / players / groups.
  const { data: orgId } = await supabase.rpc('get_my_org')
  if (!orgId) redirect('/dashboard')

  const [{ data: enrolments }, { data: players }, { data: groups }] = await Promise.all([
    supabase
      .from('enrolments')
      .select(`
        id, status, enrolled_at, player_id, group_id,
        player:players(first_name, last_name, age_group),
        group:training_groups(name, day_of_week, time_slot)
      `)
      .eq('organisation_id', orgId)
      .order('enrolled_at', { ascending: false }),
    supabase
      .from('players')
      .select('id, first_name, last_name')
      .eq('organisation_id', orgId)
      .order('first_name'),
    supabase
      .from('training_groups')
      .select('id, name, day_of_week')
      .eq('organisation_id', orgId)
      .order('name'),
  ])

  const rows = (enrolments || []) as unknown as EnrolmentRow[]
  const active = rows.filter(e => e.status === 'active')
  const paused = rows.filter(e => e.status === 'paused')
  const cancelled = rows.filter(e => e.status === 'cancelled' || e.status === 'inactive')

  // Group active enrolments by class for a clearer view
  const byGroup: Record<string, EnrolmentRow[]> = {}
  for (const e of active) {
    const k = e.group?.name || 'Unassigned'
    if (!byGroup[k]) byGroup[k] = []
    byGroup[k].push(e)
  }
  const groupedActive = Object.entries(byGroup).sort((a, b) => b[1].length - a[1].length)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Enrolments</h1>
        <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-3">
          <Stat label="Active" value={active.length} accent="text-emerald-400" />
          <Stat label="Paused" value={paused.length} accent="text-amber-400" />
          <Stat label="Cancelled" value={cancelled.length} accent="text-white/40" />
        </div>
      </div>

      <EnrolmentForm players={players || []} groups={groups || []} orgId={orgId} />

      {rows.length === 0 ? (
        <EmptyState message="No enrolments yet." />
      ) : (
        <div className="space-y-6">
          {groupedActive.length > 0 && (
            <Section title="Active by class" count={active.length}>
              {groupedActive.map(([className, list]) => (
                <div key={className} className="p-4">
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-white">{className}</h3>
                      <span className="text-[10px] uppercase tracking-wider text-white/40 bg-white/[0.06] px-2 py-0.5 rounded-full font-bold">{list.length}</span>
                    </div>
                    {list[0]?.group && (list[0].group.day_of_week || list[0].group.time_slot) && (
                      <span className="text-[11px] text-white/40">{list[0].group.day_of_week}{list[0].group.time_slot ? ` · ${list[0].group.time_slot}` : ''}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {list.map(e => (
                      <Link key={e.id} href={`/dashboard/players?search=${encodeURIComponent(e.player?.first_name || '')}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[12px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/15 transition-colors">
                        ⚽ {e.player?.first_name} {e.player?.last_name}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </Section>
          )}

          {paused.length > 0 && (
            <Section title="Paused" count={paused.length} accent="amber">
              {paused.map(e => <CompactRow key={e.id} e={e} />)}
            </Section>
          )}

          {cancelled.length > 0 && (
            <Section title="Cancelled / inactive" count={cancelled.length}>
              {cancelled.slice(0, 20).map(e => <CompactRow key={e.id} e={e} />)}
              {cancelled.length > 20 && (
                <div className="px-4 py-2 text-[11px] text-white/40 italic">+ {cancelled.length - 20} more older cancellations</div>
              )}
            </Section>
          )}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <div className={`text-2xl sm:text-3xl font-extrabold leading-none ${accent}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-white/40 mt-1">{label}</div>
    </div>
  )
}

function Section({ title, count, accent, children }: { title: string; count: number; accent?: 'amber'; children: React.ReactNode }) {
  const color = accent === 'amber' ? 'text-amber-400' : 'text-white/60'
  return (
    <section>
      <div className="flex items-baseline gap-2 mb-2">
        <h2 className={`text-xs font-bold uppercase tracking-wider ${color}`}>{title}</h2>
        <span className="text-xs text-white/30">{count}</span>
      </div>
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.05]">
        {children}
      </div>
    </section>
  )
}

function CompactRow({ e }: { e: EnrolmentRow }) {
  return (
    <div className="px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-white/[0.02] transition-colors">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-white truncate">{e.player?.first_name} {e.player?.last_name}</div>
        <div className="text-[11px] text-white/40 truncate">{e.group?.name}{e.group?.day_of_week ? ` · ${e.group.day_of_week}` : ''}</div>
      </div>
      <EnrolmentStatusToggle enrolmentId={e.id} currentStatus={e.status} />
    </div>
  )
}
