import Link from 'next/link'
import { requireAdmin, needsAttention, getCoaches, getSlots, getSessions, DAY, hhmm, fmtDate } from '@/lib/one-to-one/db'
import { addDays, todayLondon } from '@/lib/one-to-one/time'
import { ActionButton } from './ui'

export const dynamic = 'force-dynamic'

// Needs attention — the home screen. If it would need a human, it's here.
// Everything else is silent.
export default async function NeedsAttentionPage() {
  const { admin, orgId } = await requireAdmin()
  const today = todayLondon()
  const [items, coaches, slots, week] = await Promise.all([
    needsAttention(admin, orgId), getCoaches(admin, orgId), getSlots(admin, orgId), getSessions(admin, orgId, today, addDays(today, 6)),
  ])
  const active = slots.filter((s) => s.status === 'active')
  const thisWeek = week.filter((s) => s.status === 'scheduled')
  const empty = active.length === 0 && items.length === 0

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat n={String(active.length)} label="Regulars" sub={`${slots.filter((s) => s.status === 'paused').length} paused`} />
        <Stat n={String(thisWeek.length)} label="Sessions this week" sub={`${thisWeek.filter((s) => s.source === 'adhoc').length} booked ad hoc`} />
        <Stat n={String(items.filter((i) => i.kind === 'cover' || i.kind === 'closure').length)} label="Cover needed" sub="coach flags and venue closures" />
        <Stat n={String(items.filter((i) => i.kind === 'request').length)} label="Session requests" sub="from the public page" />
      </div>

      {empty ? (
        <div className="rounded-2xl border border-dashed border-white/[0.15] p-8 text-center">
          <h2 className="text-lg font-semibold text-white">Nothing here yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-white/55">
            Add a venue and a coach&apos;s hours under <Link href="/dashboard/one-to-one/coaches" className="text-[#4ecde6]">Coaches &amp; venues</Link>, then create your regulars. Free time shows on the timetable straight away.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/[0.08] bg-[#0f1a2b] p-5">
          <h2 className="text-sm font-semibold text-white">Needs a human <span className="ml-2 rounded-full bg-white/[0.08] px-2 py-0.5 text-[11px] text-white/60">{items.length}</span></h2>
          {items.length === 0 ? (
            <p className="mt-3 text-sm text-white/55">Nothing needs you. Regulars roll on, free time is on sale.</p>
          ) : (
            <ul className="mt-2 divide-y divide-white/[0.06]">
              {items.map((it) => (
                <li key={it.key} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${it.kind === 'cover' || it.kind === 'closure' ? 'bg-red-400' : it.kind === 'request' ? 'bg-[#4ecde6]' : 'bg-amber-400'}`} />
                      <span className="text-sm font-semibold text-white">{it.title}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-white/55">{it.detail}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 sm:justify-end">
                    {it.kind === 'cover' && (
                      <>
                        {(it.ids.sessionIds as string[]).length > 0 && coaches.filter((c) => c.id !== it.ids.coachId).slice(0, 3).map((c) => (
                          <ActionButton key={c.id} tone="primary" body={{ action: 'session.cover', coachId: c.id, sessionIds: it.ids.sessionIds, exceptionId: it.ids.exceptionId }}>
                            Cover: {c.full_name?.split(' ')[0] || 'coach'}
                          </ActionButton>
                        ))}
                        <ActionButton body={{ action: 'exception.resolve', id: it.ids.exceptionId }}>Mark sorted</ActionButton>
                        <Link href={`/dashboard/one-to-one/timetable?from=${it.date}`} className="inline-flex items-center rounded-lg border border-white/[0.12] px-3 py-1.5 text-xs font-semibold text-white/80">Open day</Link>
                      </>
                    )}
                    {it.kind === 'closure' && (
                      <Link href={`/dashboard/one-to-one/timetable?from=${it.date}`} className="inline-flex items-center rounded-lg border border-[#4ecde6] bg-[#4ecde6] px-3 py-1.5 text-xs font-semibold text-[#04141a]">Move sessions</Link>
                    )}
                    {it.kind === 'request' && (
                      <>
                        <ActionButton tone="primary" body={{ action: 'request.status', id: it.ids.requestId, status: 'offered' }}>Offered a time</ActionButton>
                        <ActionButton tone="quiet" body={{ action: 'request.status', id: it.ids.requestId, status: 'closed' }}>Close</ActionButton>
                      </>
                    )}
                    {it.kind === 'pair' && (
                      <Link href="/dashboard/one-to-one/regulars" className="inline-flex items-center rounded-lg border border-white/[0.12] px-3 py-1.5 text-xs font-semibold text-white/80">Pair them</Link>
                    )}
                    {it.kind === 'unpaid' && (
                      <Link href="/dashboard/one-to-one/regulars" className="inline-flex items-center rounded-lg border border-white/[0.12] px-3 py-1.5 text-xs font-semibold text-white/80">View</Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {thisWeek.length > 0 && (
        <div className="rounded-2xl border border-white/[0.08] bg-[#0f1a2b] p-5">
          <h2 className="text-sm font-semibold text-white">This week</h2>
          <ul className="mt-2 divide-y divide-white/[0.06] text-sm">
            {thisWeek.slice(0, 30).map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2">
                <span className="text-white/80">{fmtDate(s.session_date)} · {hhmm(s.start_minutes)} · {s.player ? `${s.player.first_name} ${s.player.last_name}` : s.guest_child_name || s.guest_name || 'Ad hoc'}</span>
                <span className="text-xs text-white/45">{coaches.find((c) => c.id === s.coach_id)?.full_name?.split(' ')[0] || ''} · {s.source === 'regular' ? 'regular' : s.source === 'adhoc' ? 'ad hoc' : 'moved'}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-[11px] text-white/35">Days: {Object.values(DAY).join(' ')}. Times are local.</p>
    </div>
  )
}

function Stat({ n, label, sub }: { n: string; label: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.05] p-4">
      <div className="text-2xl font-bold text-white tabular-nums">{n}</div>
      <div className="text-xs text-white/60">{label}</div>
      <div className="mt-1 text-[11px] text-white/40">{sub}</div>
    </div>
  )
}
