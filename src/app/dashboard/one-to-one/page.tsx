import Link from 'next/link'
import { requireAdmin, needsAttention, getCoaches, getVenues, getSlots, getSessions, hhmm, fmtDate, type AttentionItem } from '@/lib/one-to-one/db'
import { addDays, todayLondon } from '@/lib/one-to-one/time'
import { ActionButton } from './ui'

export const dynamic = 'force-dynamic'

// Needs attention — the home screen. If it would need a human, it's here.
// Everything else is silent.
const KIND: Record<AttentionItem['kind'], { label: string; chip: string; glyph: string }> = {
  charge: { label: 'Payment', chip: 'bg-[#e0736d]/15 text-[#f3a7a2]', glyph: '£' },
  cover: { label: 'Cover', chip: 'bg-[#e0736d]/15 text-[#f3a7a2]', glyph: '!' },
  closure: { label: 'Venue closed', chip: 'bg-[#e0736d]/15 text-[#f3a7a2]', glyph: '×' },
  unpaid: { label: 'Set-up', chip: 'bg-[#d8a95a]/15 text-[#ecc98a]', glyph: '…' },
  pair: { label: '2-to-1', chip: 'bg-[#d8a95a]/15 text-[#ecc98a]', glyph: '2' },
  hold: { label: 'Held', chip: 'bg-white/10 text-white/60', glyph: '·' },
  request: { label: 'Request', chip: 'bg-[#4ecde6]/15 text-[#4ecde6]', glyph: '?' },
}

export default async function NeedsAttentionPage() {
  const { admin, orgId } = await requireAdmin()
  const today = todayLondon()
  const [items, coaches, venues, slots, week] = await Promise.all([
    needsAttention(admin, orgId), getCoaches(admin, orgId), getVenues(admin, orgId), getSlots(admin, orgId), getSessions(admin, orgId, today, addDays(today, 6)),
  ])
  const active = slots.filter((s) => s.status === 'active')
  const paused = slots.filter((s) => s.status === 'paused').length
  const thisWeek = week.filter((s) => s.status === 'scheduled')
  const adhoc = thisWeek.filter((s) => s.source === 'adhoc').length
  const cover = items.filter((i) => i.kind === 'cover' || i.kind === 'closure').length
  const unpaid = items.filter((i) => i.kind === 'charge').length
  const empty = active.length === 0 && items.length === 0
  const cname = (id: string) => coaches.find((c) => c.id === id)?.full_name?.split(' ')[0] || 'Coach'
  const vname = (id: string) => venues.find((v) => v.id === id)?.name || ''
  const byDay = [...thisWeek.reduce((m, s) => m.set(s.session_date, [...(m.get(s.session_date) || []), s]), new Map<string, typeof thisWeek>()).entries()]

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat n={active.length} label="Regulars" sub={paused ? `${paused} paused` : 'all rolling on'} href="/dashboard/one-to-one/regulars" />
        <Stat n={thisWeek.length} label="Sessions this week" sub={adhoc ? `${adhoc} booked as one-offs` : 'none booked as one-offs yet'} href="/dashboard/one-to-one/timetable" />
        <Stat n={cover} label="Cover needed" sub={cover ? 'a coach or a venue is out' : 'every session has its coach'} tone={cover ? 'danger' : 'ok'} />
        <Stat n={unpaid} label="Unpaid months" sub={unpaid ? 'the card failed, your call' : 'everyone is paid up'} tone={unpaid ? 'danger' : 'ok'} />
      </div>

      {empty ? (
        <div className="rounded-2xl border border-dashed border-white/[0.15] p-8 text-center">
          <h2 className="text-lg font-semibold text-white">Three steps and it runs itself</h2>
          <ol className="mx-auto mt-4 grid max-w-2xl gap-3 text-left text-sm text-white/65 sm:grid-cols-3">
            <li className="rounded-xl border border-white/[0.08] bg-[#0f1a2b] p-4"><b className="block text-white">1. Venues</b>Where you coach and when each place is open.</li>
            <li className="rounded-xl border border-white/[0.08] bg-[#0f1a2b] p-4"><b className="block text-white">2. Coaches&apos; hours</b>Who coaches where, on which nights. Free time goes on sale at once.</li>
            <li className="rounded-xl border border-white/[0.08] bg-[#0f1a2b] p-4"><b className="block text-white">3. Regulars</b>Give each keeper their slot. They get a link to pay and save a card.</li>
          </ol>
          <Link href="/dashboard/one-to-one/coaches" className="mt-5 inline-flex rounded-lg border border-[#4ecde6] bg-[#4ecde6] px-4 py-2 text-sm font-semibold text-[#04141a]">Start with venues</Link>
        </div>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0f1a2b]">
          <header className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5">
            <h2 className="text-sm font-semibold text-white">Needs you</h2>
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${items.length ? 'bg-[#e0736d]/15 text-[#f3a7a2]' : 'bg-[#67c79a]/15 text-[#8fdcb6]'}`}>{items.length ? `${items.length} open` : 'all clear'}</span>
          </header>
          {items.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-white/55">Nothing needs you. Regulars roll on, free time is on sale.</p>
          ) : (
            <ul className="divide-y divide-white/[0.06]">
              {items.map((it) => {
                const k = KIND[it.kind]
                return (
                  <li key={it.key} className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-start lg:gap-5">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${k.chip}`} aria-hidden>{k.glyph}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/35">{k.label}</div>
                      <div className="text-sm font-semibold text-white">{it.title}</div>
                      <p className="mt-1 max-w-3xl text-xs leading-relaxed text-white/55">{it.detail}</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-1.5 lg:max-w-[22rem] lg:justify-end">
                      {it.kind === 'cover' && (
                        <>
                          {(it.ids.sessionIds as string[]).length > 0 && coaches.filter((c) => c.id !== it.ids.coachId).slice(0, 3).map((c) => (
                            <ActionButton key={c.id} tone="primary" body={{ action: 'session.cover', coachId: c.id, sessionIds: it.ids.sessionIds, exceptionId: it.ids.exceptionId }}>
                              {c.full_name || 'Coach'} covers
                            </ActionButton>
                          ))}
                          <Link href={`/dashboard/one-to-one/timetable?from=${it.date}`} className="inline-flex items-center rounded-lg border border-white/[0.12] px-3 py-1.5 text-xs font-semibold text-white/80">Open the day</Link>
                          <ActionButton tone="quiet" body={{ action: 'exception.resolve', id: it.ids.exceptionId }}>Mark sorted</ActionButton>
                        </>
                      )}
                      {it.kind === 'closure' && (
                        <Link href={`/dashboard/one-to-one/timetable?from=${it.date}`} className="inline-flex items-center rounded-lg border border-[#4ecde6] bg-[#4ecde6] px-3 py-1.5 text-xs font-semibold text-[#04141a]">Move the sessions</Link>
                      )}
                      {it.kind === 'request' && (
                        <>
                          <ActionButton tone="primary" body={{ action: 'request.status', id: it.ids.requestId, status: 'offered' }}>I&apos;ve offered a time</ActionButton>
                          <ActionButton tone="quiet" body={{ action: 'request.status', id: it.ids.requestId, status: 'closed' }}>Close</ActionButton>
                        </>
                      )}
                      {it.kind === 'pair' && (
                        <Link href="/dashboard/one-to-one/regulars" className="inline-flex items-center rounded-lg border border-white/[0.12] px-3 py-1.5 text-xs font-semibold text-white/80">Pair them</Link>
                      )}
                      {it.kind === 'unpaid' && (
                        <>
                          <ActionButton tone="primary" body={{ action: 'slot.setup_link', id: it.ids.slotId }}>Resend the link</ActionButton>
                          <ActionButton tone="quiet" confirm="Release this slot? The time goes back on sale." body={{ action: 'slot.status', id: it.ids.slotId, status: 'released' }}>Release the slot</ActionButton>
                        </>
                      )}
                      {it.kind === 'charge' && (
                        <>
                          <ActionButton tone="primary" body={{ action: 'charge.remind', id: it.ids.chargeId }}>Send pay link</ActionButton>
                          <ActionButton body={{ action: 'charge.cash', id: it.ids.chargeId }} confirm="Mark this month as paid in cash? It records your name and the time.">Paid in cash</ActionButton>
                          {(it.ids.slotIds as string[]).map((sid, i) => (
                            <ActionButton key={sid} tone="danger" confirm="Release this slot? Future sessions come off and the time goes on sale." body={{ action: 'slot.status', id: sid, status: 'released' }}>Release {(it.ids.slotLabels as string[] | undefined)?.[i] || 'slot'}</ActionButton>
                          ))}
                        </>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}

      {byDay.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0f1a2b]">
          <header className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5">
            <h2 className="text-sm font-semibold text-white">The next seven days</h2>
            <Link href="/dashboard/one-to-one/timetable" className="text-xs font-medium text-[#4ecde6]">Open the timetable</Link>
          </header>
          <div className="divide-y divide-white/[0.06]">
            {byDay.map(([date, list]) => (
              <div key={date} className="grid gap-x-5 gap-y-1 px-5 py-3 sm:grid-cols-[7.5rem_1fr]">
                <div className={`pt-1 text-[11px] font-semibold uppercase tracking-wide ${date === today ? 'text-[#4ecde6]' : 'text-white/45'}`}>{date === today ? 'Today' : fmtDate(date)}</div>
                <ul className="grid gap-1">
                  {list.map((s) => (
                    <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm">
                      <span className="w-11 font-semibold tabular-nums text-white">{hhmm(s.start_minutes)}</span>
                      <span className="text-white/85">{s.player ? `${s.player.first_name} ${s.player.last_name}` : s.guest_child_name || s.guest_name || 'One-off'}</span>
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${s.source === 'adhoc' ? 'bg-[#d8a95a]/15 text-[#ecc98a]' : 'bg-[#4ecde6]/12 text-[#4ecde6]'}`}>{s.source === 'adhoc' ? 'one-off' : s.session_type === 'two_to_one' ? '2-to-1' : 'regular'}</span>
                      <span className="text-xs text-white/40 sm:ml-auto">{cname(s.coach_id)} · {vname(s.venue_id)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function Stat({ n, label, sub, tone, href }: { n: number; label: string; sub: string; tone?: 'danger' | 'ok'; href?: string }) {
  const body = (
    <div className={`h-full rounded-2xl border p-4 transition-colors ${tone === 'danger' ? 'border-[#e0736d]/35 bg-[#e0736d]/[0.07]' : 'border-white/[0.08] bg-[#0f1a2b]'} ${href ? 'hover:border-white/20' : ''}`}>
      <div className="flex items-baseline gap-2">
        <span className={`text-3xl font-bold tabular-nums ${tone === 'danger' ? 'text-[#f3a7a2]' : 'text-white'}`}>{n}</span>
        {tone === 'ok' && <span className="text-xs font-semibold text-[#8fdcb6]">✓</span>}
      </div>
      <div className="mt-1 text-xs font-medium text-white/75">{label}</div>
      <div className="mt-0.5 text-[11px] text-white/40">{sub}</div>
    </div>
  )
  return href ? <Link href={href} className="block">{body}</Link> : body
}
