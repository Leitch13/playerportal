import Link from 'next/link'
import { requireAdmin, getCoaches, getVenues, getSessions, loadAvailability, DAY, hhmm, fmtDate, gbp, getSettings } from '@/lib/one-to-one/db'
import { freeSessions } from '@/lib/one-to-one/availability'
import { addDays, isoWeekday, todayLondon } from '@/lib/one-to-one/time'
import { ActionButton, ActionForm, Field, inputCls } from '../ui'

export const dynamic = 'force-dynamic'

// The master week. Cyan = regular (protected). Green = free, on sale.
// Gold = ad hoc booked. Red = cover needed. Grey = not available.
export default async function TimetablePage({ searchParams }: { searchParams: Promise<{ from?: string; coach?: string }> }) {
  const { from: fromParam, coach: coachParam } = await searchParams
  const { admin, orgId } = await requireAdmin()
  const today = todayLondon()
  const start = fromParam && /^\d{4}-\d{2}-\d{2}$/.test(fromParam) ? addDays(fromParam, -(isoWeekday(fromParam) - 1)) : addDays(today, -(isoWeekday(today) - 1))
  const end = addDays(start, 6)

  const [coaches, venues, settings, availability, sessions] = await Promise.all([
    getCoaches(admin, orgId), getVenues(admin, orgId), getSettings(admin, orgId),
    loadAvailability(admin, orgId, start, end), getSessions(admin, orgId, start, end),
  ])
  const coachFilter = coachParam && coaches.some((c) => c.id === coachParam) ? coachParam : null
  const free = freeSessions({ ...availability, filters: coachFilter ? { coachId: coachFilter } : undefined })
  const live = sessions.filter((s) => ['scheduled', 'held', 'attended', 'no_show'].includes(s.status) && (!coachFilter || s.coach_id === coachFilter))
  const flags = availability.exceptions.filter((e) => e.kind === 'flag' && e.status !== 'resolved')
  const flagged = (coachId: string, date: string, min: number) => flags.some((f) => f.coachId === coachId && f.date === date && (f.startMinutes == null || (min >= (f.startMinutes ?? 0) && min < (f.endMinutes ?? 1440))))

  // Build the grid rows: every start time that appears in free or live this week.
  const times = [...new Set([...free.map((f) => f.startMinutes), ...live.map((s) => s.start_minutes)])].sort((a, b) => a - b)
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  const cname = (id: string) => coaches.find((c) => c.id === id)?.full_name?.split(' ')[0] || 'Coach'
  const vname = (id: string) => venues.find((v) => v.id === id)?.name || ''
  const hasSetup = venues.length > 0 && availability.coachHours.length > 0

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/dashboard/one-to-one/timetable?from=${addDays(start, -7)}${coachFilter ? `&coach=${coachFilter}` : ''}`} className="rounded-lg border border-white/[0.12] px-2.5 py-1.5 text-xs text-white/80">‹ Prev</Link>
        <span className="text-sm font-semibold text-white">Week of {fmtDate(start)}</span>
        <Link href={`/dashboard/one-to-one/timetable?from=${addDays(start, 7)}${coachFilter ? `&coach=${coachFilter}` : ''}`} className="rounded-lg border border-white/[0.12] px-2.5 py-1.5 text-xs text-white/80">Next ›</Link>
        <div className="ml-auto inline-flex rounded-lg border border-white/[0.1] bg-[#0f1a2b] p-0.5 text-xs">
          <Link href={`/dashboard/one-to-one/timetable?from=${start}`} className={`rounded-md px-2.5 py-1 ${!coachFilter ? 'bg-white/[0.1] text-white' : 'text-white/55'}`}>All coaches</Link>
          {coaches.map((c) => (
            <Link key={c.id} href={`/dashboard/one-to-one/timetable?from=${start}&coach=${c.id}`} className={`rounded-md px-2.5 py-1 ${coachFilter === c.id ? 'bg-white/[0.1] text-white' : 'text-white/55'}`}>{c.full_name?.split(' ')[0] || 'Coach'}</Link>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-3 text-[11px] text-white/55">
        <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-[#4ecde6]/60 align-[-1px]" />Regular, protected</span>
        <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-emerald-400/60 align-[-1px]" />Free, on sale {gbp(settings.one_to_one_price_pence)}</span>
        <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-amber-400/60 align-[-1px]" />Booked ad hoc</span>
        <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-red-400/60 align-[-1px]" />Cover needed</span>
      </div>

      {!hasSetup ? (
        <div className="rounded-2xl border border-dashed border-white/[0.15] p-8 text-center text-sm text-white/55">
          No hours yet. Add a venue and a coach&apos;s hours under <Link href="/dashboard/one-to-one/coaches" className="text-[#4ecde6]">Coaches &amp; venues</Link> and the week fills in.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-[#0f1a2b]">
          <table className="w-full min-w-[760px] border-collapse text-xs">
            <thead>
              <tr>
                <th className="w-14 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-white/40"></th>
                {days.map((d) => (
                  <th key={d} className={`px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide ${d === today ? 'text-[#4ecde6]' : 'text-white/40'}`}>{DAY[isoWeekday(d)]} {d.slice(8)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {times.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-6 text-center text-white/45">Nothing on this week. Hours may start later, or every day is closed.</td></tr>
              )}
              {times.map((t) => (
                <tr key={t} className="border-t border-white/[0.06] align-top">
                  <td className="px-3 py-1.5 text-[11px] text-white/40 tabular-nums">{hhmm(t)}</td>
                  {days.map((d) => {
                    const cellLive = live.filter((s) => s.session_date === d && s.start_minutes === t)
                    const cellFree = free.filter((f) => f.date === d && f.startMinutes === t)
                    return (
                      <td key={d} className="px-1 py-1">
                        <div className="grid gap-1">
                          {cellLive.map((s) => {
                            const isFlag = flagged(s.coach_id, d, t)
                            const who = s.player ? `${s.player.first_name} ${s.player.last_name?.[0] || ''}` : s.guest_child_name || s.guest_name || 'Booked'
                            const cls = isFlag ? 'border-red-400/45 bg-red-400/10 text-red-200' : s.source === 'adhoc' ? 'border-amber-400/40 bg-amber-400/10 text-amber-100' : s.status === 'held' ? 'border-white/20 bg-white/[0.05] text-white/60' : 'border-[#4ecde6]/35 bg-[#4ecde6]/10 text-white'
                            return (
                              <details key={s.id} className={`group rounded-lg border px-2 py-1 ${cls}`}>
                                <summary className="cursor-pointer list-none">
                                  <span className="block font-semibold">{who}</span>
                                  <span className="block text-[10px] opacity-75">{cname(s.coach_id)} · {s.status === 'held' ? 'held' : isFlag ? 'cover needed' : s.source === 'adhoc' ? 'ad hoc · ' + (s.charge_state === 'paid_online' ? 'paid' : 'unpaid') : 'regular'}{s.status === 'attended' ? ' · ✓' : s.status === 'no_show' ? ' · no show' : ''}</span>
                                </summary>
                                <div className="mt-2 space-y-2 border-t border-white/10 pt-2">
                                  <div className="text-[10px] opacity-75">{vname(s.venue_id)} · {s.duration_minutes} min · {gbp(s.price_pence)}</div>
                                  <div className="flex flex-wrap gap-1">
                                    {s.status === 'scheduled' && d <= today && <ActionButton body={{ action: 'session.status', sessionId: s.id, status: 'attended' }}>Coached ✓</ActionButton>}
                                    {s.status === 'scheduled' && d <= today && <ActionButton tone="quiet" body={{ action: 'session.status', sessionId: s.id, status: 'no_show' }}>No show</ActionButton>}
                                    {s.status === 'scheduled' && coaches.filter((c) => c.id !== s.coach_id).slice(0, 2).map((c) => (
                                      <ActionButton key={c.id} body={{ action: 'session.cover', sessionId: s.id, coachId: c.id }}>Cover: {cname(c.id)}</ActionButton>
                                    ))}
                                    {s.status === 'scheduled' && <ActionButton tone="danger" confirm="Cancel this session? The time goes back on sale." body={{ action: 'session.status', sessionId: s.id, status: 'cancelled', note: 'cancelled by academy' }}>Cancel</ActionButton>}
                                  </div>
                                  {s.status === 'scheduled' && (
                                    <ActionForm action="session.move" extra={{ sessionId: s.id }} submitLabel="Move" className="!space-y-1.5">
                                      <div className="grid grid-cols-2 gap-1">
                                        <input name="date" type="date" defaultValue={d} className={inputCls + ' !px-2 !py-1 !text-[11px]'} />
                                        <input name="start" placeholder="17:00" className={inputCls + ' !px-2 !py-1 !text-[11px]'} />
                                      </div>
                                    </ActionForm>
                                  )}
                                </div>
                              </details>
                            )
                          })}
                          {cellFree.map((f) => (
                            <div key={`${f.coachId}-${f.venueId}`} className="rounded-lg border border-emerald-400/35 bg-emerald-400/[0.07] px-2 py-1 text-emerald-200">
                              <span className="block font-semibold">Free</span>
                              <span className="block text-[10px] opacity-75">{cname(f.coachId)} · {vname(f.venueId)}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/[0.08] bg-[#0f1a2b] p-4">
          <h3 className="text-sm font-semibold text-white">Block time <span className="ml-1 text-[11px] font-normal text-white/45">buffer, admin, anything not for sale</span></h3>
          <ActionForm action="exception.add" extra={{ kind: 'block' }} submitLabel="Block" className="mt-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Field label="Coach"><select name="coachId" className={inputCls}>{coaches.map((c) => <option key={c.id} value={c.id}>{c.full_name || c.email}</option>)}</select></Field>
              <Field label="Date"><input name="date" type="date" defaultValue={today} className={inputCls} /></Field>
              <Field label="From"><input name="start" placeholder="17:30 · blank = all day" className={inputCls} /></Field>
              <Field label="To"><input name="end" placeholder="18:00" className={inputCls} /></Field>
            </div>
          </ActionForm>
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-[#0f1a2b] p-4">
          <h3 className="text-sm font-semibold text-white">Roll the month <span className="ml-1 text-[11px] font-normal text-white/45">creates dated sessions from every regular · safe to run twice</span></h3>
          <div className="mt-3 flex flex-wrap gap-2">
            <ActionButton tone="primary" body={{ action: 'roll', month: today }}>This month</ActionButton>
            <ActionButton body={{ action: 'roll', month: addDays(today.slice(0, 8) + '01', 32) }}>Next month</ActionButton>
          </div>
          <p className="mt-2 text-[11px] text-white/40">From phase 4 this runs itself on the 20th and sends the parents their notice.</p>
        </div>
      </div>
    </div>
  )
}
