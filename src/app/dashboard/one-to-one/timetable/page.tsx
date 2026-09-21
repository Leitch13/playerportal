import Link from 'next/link'
import { requireAdmin, getCoaches, getVenues, getSessions, loadAvailability, DAY, hhmm, fmtDate, gbp, getSettings, type SessionRowDb } from '@/lib/one-to-one/db'
import { freeSessions } from '@/lib/one-to-one/availability'
import { addDays, isoWeekday, todayLondon } from '@/lib/one-to-one/time'
import { ActionButton, ActionForm, Field, inputCls } from '../ui'

export const dynamic = 'force-dynamic'

// The master week. Booked time carries the weight; free time is quiet.
// Cyan = a regular (protected). Gold = a one-off booking. Red = cover needed.
// A dashed ghost = free, on sale. Desktop is a grid; a phone gets a day-by-day agenda.
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

  const times = [...new Set([...free.map((f) => f.startMinutes), ...live.map((s) => s.start_minutes)])].sort((a, b) => a - b)
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  // Same first name twice? Show enough of the surname to tell them apart.
  const firsts = coaches.map((c) => (c.full_name || '').trim().split(/\s+/)[0]?.toLowerCase())
  const cname = (id: string) => {
    const c = coaches.find((x) => x.id === id); const parts = (c?.full_name || c?.email || 'Coach').trim().split(/\s+/)
    const first = parts[0] || 'Coach'
    return firsts.filter((f) => f === first.toLowerCase()).length > 1 && parts[1] ? `${first} ${parts[1][0].toUpperCase()}` : first
  }
  const vname = (id: string) => venues.find((v) => v.id === id)?.name || ''
  const hasSetup = venues.length > 0 && availability.coachHours.length > 0
  const who = (s: SessionRowDb) => s.player ? `${s.player.first_name} ${s.player.last_name?.[0] || ''}`.trim() : s.guest_child_name || s.guest_name || 'Booked'
  const kindOf = (s: SessionRowDb, d: string) => flagged(s.coach_id, d, s.start_minutes) && s.status === 'scheduled' ? 'cover' : s.status === 'held' ? 'held' : s.source === 'adhoc' ? 'adhoc' : 'regular'
  const tone: Record<string, string> = {
    regular: 'bg-[#4ecde6]/[0.13] text-white ring-1 ring-inset ring-[#4ecde6]/30',
    adhoc: 'bg-[#d8a95a]/[0.14] text-[#f6e3c1] ring-1 ring-inset ring-[#d8a95a]/35',
    cover: 'bg-[#e0736d]/[0.15] text-[#fbd9d6] ring-1 ring-inset ring-[#e0736d]/45',
    held: 'bg-white/[0.04] text-white/60 border border-dashed border-white/20',
  }
  const sub = (s: SessionRowDb, k: string) => k === 'cover' ? 'cover needed' : k === 'held' ? 'paying now' : k === 'adhoc' ? `one-off${s.charge_state === 'paid_online' ? ' · paid' : ''}` : s.session_type === 'two_to_one' ? '2-to-1' : 'regular'
  const done = (s: SessionRowDb) => s.status === 'attended' ? ' ✓' : s.status === 'no_show' ? ' · no show' : ''
  const qs = (f: string, c?: string | null) => `/dashboard/one-to-one/timetable?from=${f}${c ? `&coach=${c}` : ''}`
  const weekBooked = live.filter((s) => s.status !== 'held').length

  const Actions = ({ s, d }: { s: SessionRowDb; d: string }) => (
    <div className="mt-2 space-y-2 border-t border-white/10 pt-2">
      <div className="text-[11px] text-white/60">{vname(s.venue_id)} · {s.duration_minutes} min · {gbp(s.price_pence)}</div>
      <div className="flex flex-wrap gap-1">
        {s.status === 'scheduled' && d <= today && <ActionButton tone="primary" body={{ action: 'session.status', sessionId: s.id, status: 'attended' }}>Coached ✓</ActionButton>}
        {s.status === 'scheduled' && d <= today && <ActionButton tone="quiet" body={{ action: 'session.status', sessionId: s.id, status: 'no_show' }}>No show</ActionButton>}
        {s.status === 'scheduled' && coaches.filter((c) => c.id !== s.coach_id).slice(0, 2).map((c) => (
          <ActionButton key={c.id} body={{ action: 'session.cover', sessionId: s.id, coachId: c.id }}>Cover: {cname(c.id)}</ActionButton>
        ))}
        {s.status === 'scheduled' && <ActionButton tone="danger" confirm="Cancel this session? If it's been paid the parent is credited in full. The time goes back on sale." body={{ action: 'session.academy_cancel', sessionId: s.id }}>Cancel</ActionButton>}
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
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center rounded-xl border border-white/[0.1] bg-[#0f1a2b]">
          <Link href={qs(addDays(start, -7), coachFilter)} aria-label="Previous week" className="px-3 py-2 text-sm text-white/70 hover:text-white">‹</Link>
          <span className="border-x border-white/[0.08] px-3 py-2 text-sm font-semibold text-white tabular-nums">{fmtDate(start).replace(/^\w+ /, '')} – {fmtDate(end).replace(/^\w+ /, '')}</span>
          <Link href={qs(addDays(start, 7), coachFilter)} aria-label="Next week" className="px-3 py-2 text-sm text-white/70 hover:text-white">›</Link>
        </div>
        {start !== addDays(today, -(isoWeekday(today) - 1)) && <Link href="/dashboard/one-to-one/timetable" className="rounded-xl border border-white/[0.1] px-3 py-2 text-xs text-white/70 hover:text-white">This week</Link>}
        <span className="text-xs text-white/45">{weekBooked} booked · {free.length} free</span>
        {coaches.length > 1 && (
          <div className="ml-auto inline-flex max-w-full overflow-x-auto rounded-xl border border-white/[0.1] bg-[#0f1a2b] p-0.5 text-xs">
            <Link href={qs(start)} className={`whitespace-nowrap rounded-lg px-3 py-1.5 ${!coachFilter ? 'bg-white/[0.1] font-semibold text-white' : 'text-white/55 hover:text-white'}`}>All coaches</Link>
            {coaches.map((c) => (
              <Link key={c.id} href={qs(start, c.id)} className={`whitespace-nowrap rounded-lg px-3 py-1.5 ${coachFilter === c.id ? 'bg-white/[0.1] font-semibold text-white' : 'text-white/55 hover:text-white'}`}>{cname(c.id)}</Link>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-white/55">
        <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-[3px] bg-[#4ecde6]/70 align-[-1px]" />Regular, their slot</span>
        <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-[3px] bg-[#d8a95a]/80 align-[-1px]" />One-off booking</span>
        <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-[3px] bg-[#e0736d]/80 align-[-1px]" />Cover needed</span>
        <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-[3px] border border-dashed border-white/35 align-[-1px]" />Free, on sale at {gbp(settings.one_to_one_price_pence)}</span>
      </div>

      {!hasSetup ? (
        <div className="rounded-2xl border border-dashed border-white/[0.15] p-8 text-center text-sm text-white/55">
          No hours yet. Add a venue and a coach&apos;s hours under <Link href="/dashboard/one-to-one/coaches" className="text-[#4ecde6]">Coaches &amp; venues</Link> and the week fills in.
        </div>
      ) : (
        <>
          {/* ── Desktop: the week as a grid ── */}
          <div className="hidden overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0f1a2b] md:block">
            <table className="w-full table-fixed border-collapse text-xs">
              <colgroup><col className="w-14" />{days.map((d) => <col key={d} />)}</colgroup>
              <thead>
                <tr className="border-b border-white/[0.08]">
                  <th />
                  {days.map((d) => {
                    const b = live.filter((s) => s.session_date === d && s.status !== 'held').length, f = free.filter((x) => x.date === d).length
                    return (
                      <th key={d} className={`px-2 py-2.5 text-left font-normal ${d === today ? 'bg-[#4ecde6]/[0.06]' : ''}`}>
                        <div className={`text-[11px] font-semibold uppercase tracking-wide ${d === today ? 'text-[#4ecde6]' : 'text-white/55'}`}>{DAY[isoWeekday(d)]} <span className="tabular-nums">{Number(d.slice(8))}</span></div>
                        <div className="mt-0.5 text-[10px] text-white/35">{b || f ? `${b} booked · ${f} free` : 'no hours'}</div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {times.length === 0 && <tr><td colSpan={8} className="px-3 py-8 text-center text-white/45">Nothing on this week. Hours may start later, or every day is closed.</td></tr>}
                {times.map((t) => (
                  <tr key={t} className={`align-top ${t % 60 === 0 ? 'border-t border-white/[0.07]' : 'border-t border-white/[0.03]'}`}>
                    <td className={`px-2 py-2 text-right text-[11px] tabular-nums ${t % 60 === 0 ? 'text-white/55' : 'text-white/25'}`}>{hhmm(t)}</td>
                    {days.map((d) => {
                      const cellLive = live.filter((s) => s.session_date === d && s.start_minutes === t)
                      const cellFree = free.filter((f) => f.date === d && f.startMinutes === t)
                      return (
                        <td key={d} className={`px-1 py-1 ${d === today ? 'bg-[#4ecde6]/[0.035]' : ''}`}>
                          <div className="grid gap-1">
                            {cellLive.map((s) => { const k = kindOf(s, d); return (
                              <details key={s.id} className={`group rounded-lg px-2 py-1.5 ${tone[k]} open:shadow-lg open:shadow-black/30`}>
                                <summary className="cursor-pointer list-none">
                                  <span className="block truncate text-[12px] font-semibold leading-tight">{who(s)}{done(s)}</span>
                                  <span className="block truncate text-[10px] leading-tight opacity-70">{cname(s.coach_id)} · {sub(s, k)}</span>
                                </summary>
                                <Actions s={s} d={d} />
                              </details>
                            ) })}
                            {cellFree.length > 0 && (
                              <div className="truncate rounded-lg border border-dashed border-white/[0.12] px-2 py-1 text-[10px] leading-tight text-white/35" title={cellFree.map((f) => `${cname(f.coachId)} at ${vname(f.venueId)}`).join(', ')}>
                                free · {[...new Set(cellFree.map((f) => cname(f.coachId)))].join(', ')}
                              </div>
                            )}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Phone: the week as an agenda ── */}
          <div className="space-y-3 md:hidden">
            {days.map((d) => {
              const dayLive = live.filter((s) => s.session_date === d).sort((a, b) => a.start_minutes - b.start_minutes)
              const dayFree = [...new Set(free.filter((f) => f.date === d).map((f) => f.startMinutes))].sort((a, b) => a - b)
              if (!dayLive.length && !dayFree.length) return null
              return (
                <section key={d} className={`rounded-2xl border bg-[#0f1a2b] p-4 ${d === today ? 'border-[#4ecde6]/35' : 'border-white/[0.08]'}`}>
                  <div className="flex items-baseline justify-between">
                    <h3 className={`text-sm font-semibold ${d === today ? 'text-[#4ecde6]' : 'text-white'}`}>{d === today ? 'Today · ' : ''}{fmtDate(d)}</h3>
                    <span className="text-[11px] text-white/40">{dayLive.filter((s) => s.status !== 'held').length} booked · {dayFree.length} free</span>
                  </div>
                  {dayLive.length > 0 && (
                    <div className="mt-2 grid gap-1.5">
                      {dayLive.map((s) => { const k = kindOf(s, d); return (
                        <details key={s.id} className={`rounded-xl px-3 py-2 ${tone[k]}`}>
                          <summary className="flex cursor-pointer list-none items-center gap-3">
                            <span className="w-11 shrink-0 text-sm font-semibold tabular-nums">{hhmm(s.start_minutes)}</span>
                            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{who(s)}{done(s)}</span><span className="block truncate text-[11px] opacity-70">{cname(s.coach_id)} · {vname(s.venue_id)} · {sub(s, k)}</span></span>
                          </summary>
                          <Actions s={s} d={d} />
                        </details>
                      ) })}
                    </div>
                  )}
                  {dayFree.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap items-center gap-1">
                      <span className="mr-1 text-[10px] uppercase tracking-wide text-white/35">Free</span>
                      {dayFree.map((m) => <span key={m} className="rounded-md border border-dashed border-white/[0.14] px-1.5 py-0.5 text-[11px] tabular-nums text-white/45">{hhmm(m)}</span>)}
                    </div>
                  )}
                </section>
              )
            })}
            {times.length === 0 && <div className="rounded-2xl border border-dashed border-white/[0.15] p-6 text-center text-sm text-white/45">Nothing on this week.</div>}
          </div>
        </>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/[0.08] bg-[#0f1a2b] p-5">
          <h3 className="text-sm font-semibold text-white">Block time</h3>
          <p className="mt-0.5 text-[11px] text-white/45">A buffer, admin, a holiday. Anything a coach is around for but shouldn&apos;t be sold.</p>
          <ActionForm action="exception.add" extra={{ kind: 'block' }} submitLabel="Block it" className="mt-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Field label="Coach"><select name="coachId" className={inputCls}>{coaches.map((c) => <option key={c.id} value={c.id}>{c.full_name || c.email}</option>)}</select></Field>
              <Field label="Date"><input name="date" type="date" defaultValue={today} className={inputCls} /></Field>
              <Field label="From"><input name="start" placeholder="all day" className={inputCls} /></Field>
              <Field label="To"><input name="end" placeholder="18:00" className={inputCls} /></Field>
            </div>
          </ActionForm>
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-[#0f1a2b] p-5">
          <h3 className="text-sm font-semibold text-white">Create a month&apos;s sessions</h3>
          <p className="mt-0.5 text-[11px] text-white/45">This runs by itself on the 20th. Press it if you&apos;ve added a regular mid-month and want their dates now. Safe to press twice.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <ActionButton tone="primary" body={{ action: 'roll', month: today }}>This month</ActionButton>
            <ActionButton body={{ action: 'roll', month: addDays(today.slice(0, 8) + '01', 32) }}>Next month</ActionButton>
          </div>
        </div>
      </div>
    </div>
  )
}
