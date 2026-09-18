'use client'

import { useState } from 'react'
import { ActionButton, ActionForm, Field, inputCls } from '../one-to-one/ui'

type Sess = { id: string; date: string; dateLabel: string; day: string; time: string; end: string; child: string; type: string; source: string; status: string; cover: boolean; venue: string; address: string | null }
type Hours = { id: string; day: string; from: string; to: string; venue: string }
type Exc = { id: string; date: string; dateLabel: string; kind: 'flag' | 'extra' | 'block'; status: 'open' | 'resolved'; hours: string; venue: string; note: string | null }

const COACH = '/api/one-to-one/coach'

export default function CoachSessions({ academy, coachName, today, calendar, venues, sessions, hours, exceptions }: {
  academy: string; coachName: string; today: string; calendar: { https: string; webcal: string }
  venues: { id: string; name: string }[]; sessions: Sess[]; hours: Hours[]; exceptions: Exc[]
}) {
  const [copied, setCopied] = useState(false)
  const toTick = sessions.filter((s) => s.date <= today && s.status === 'scheduled')
  const upcoming = sessions.filter((s) => s.date >= today && s.status === 'scheduled')
  const done = sessions.filter((s) => s.date < today && s.status !== 'scheduled')
  const byDate = (list: Sess[]) => Object.entries(list.reduce<Record<string, Sess[]>>((acc, s) => ((acc[s.date] ||= []).push(s), acc), {}))
  const flags = exceptions.filter((e) => e.kind === 'flag')
  const extras = exceptions.filter((e) => e.kind === 'extra')
  const blocks = exceptions.filter((e) => e.kind === 'block')

  const copy = async () => {
    try { await navigator.clipboard.writeText(calendar.https); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* the link is on screen anyway */ }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">My 1-2-1s</h1>
          <p className="mt-1 text-sm text-white/55">{coachName}, at {academy}. Your sessions for the next four weeks, and the ones to tick off.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href={calendar.webcal} className="rounded-lg border border-[#4ecde6] bg-[#4ecde6] px-3 py-1.5 text-xs font-semibold text-[#04141a]">Add to my phone calendar</a>
          <button type="button" onClick={copy} className="rounded-lg border border-white/[0.12] bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-white">{copied ? 'Copied' : 'Copy feed link'}</button>
        </div>
      </div>
      <p className="text-[11px] text-white/40">The calendar button subscribes your phone to a feed. New sessions, moves and cancellations show up on their own within the hour. On Google Calendar, paste the copied link under Other calendars, From URL.</p>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat n={String(toTick.length)} label="To tick off" sub="past sessions not yet marked" />
        <Stat n={String(upcoming.length)} label="Coming up" sub="next four weeks" />
        <Stat n={String(upcoming.filter((s) => s.source === 'adhoc').length)} label="One-off bookings" sub="booked from the public page" />
        <Stat n={String(flags.filter((f) => f.status === 'open').length)} label="Days flagged" sub="waiting for the academy to cover" />
      </div>

      {toTick.length > 0 && (
        <section className="rounded-2xl border border-amber-400/25 bg-amber-400/[0.06] p-5">
          <h2 className="text-sm font-semibold text-white">Tick these off <span className="ml-1 text-[11px] font-normal text-white/50">so the academy and the parent know what happened</span></h2>
          <ul className="mt-2 divide-y divide-white/[0.06]">
            {toTick.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <div>
                  <div className="font-semibold text-white">{s.dateLabel} · {s.time} · {s.child}</div>
                  <div className="text-[11px] text-white/45">{s.type} · {s.venue}{s.cover ? ' · cover' : ''}</div>
                </div>
                <div className="flex gap-1.5">
                  <ActionButton tone="primary" endpoint={COACH} body={{ action: 'session.status', sessionId: s.id, status: 'attended' }}>Coached ✓</ActionButton>
                  <ActionButton tone="quiet" endpoint={COACH} body={{ action: 'session.status', sessionId: s.id, status: 'no_show' }}>No show</ActionButton>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl border border-white/[0.08] bg-[#0f1a2b] p-5">
        <h2 className="text-sm font-semibold text-white">Coming up</h2>
        {upcoming.length === 0 ? (
          <p className="mt-3 text-xs text-white/45">Nothing booked in the next four weeks. Regulars land on the 20th; one-off bookings can arrive any time.</p>
        ) : (
          <div className="mt-2 space-y-3">
            {byDate(upcoming).map(([date, list]) => (
              <div key={date}>
                <div className={`text-[11px] font-semibold uppercase tracking-wide ${date === today ? 'text-[#4ecde6]' : 'text-white/45'}`}>{date === today ? 'Today' : list[0].dateLabel}</div>
                <ul className="mt-1 divide-y divide-white/[0.06]">
                  {list.map((s) => (
                    <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                      <div>
                        <span className="font-semibold text-white tabular-nums">{s.time}–{s.end}</span>
                        <span className="ml-2 text-white/85">{s.child}</span>
                        <span className={`ml-2 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${s.source === 'adhoc' ? 'border-amber-400/40 text-amber-200' : 'border-[#4ecde6]/35 text-[#4ecde6]'}`}>{s.source === 'adhoc' ? 'one-off' : s.type}</span>
                        {s.cover && <span className="ml-1 rounded-full border border-red-400/40 px-1.5 py-0.5 text-[10px] font-semibold text-red-200">cover</span>}
                      </div>
                      <div className="text-[11px] text-white/45">{s.venue}{s.address ? ` · ${s.address}` : ''}</div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-white/[0.08] bg-[#0f1a2b] p-5">
          <h2 className="text-sm font-semibold text-white">Can&apos;t make a day? <span className="ml-1 text-[11px] font-normal text-white/45">the academy gets told and finds cover</span></h2>
          <ActionForm action="flag.add" endpoint={COACH} submitLabel="Flag it" className="mt-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Field label="Date"><input name="date" type="date" min={today} required className={inputCls} /></Field>
              <Field label="From"><input name="start" placeholder="blank = all day" className={inputCls} /></Field>
              <Field label="To"><input name="end" placeholder="18:00" className={inputCls} /></Field>
              <Field label="Why"><input name="note" placeholder="optional" className={inputCls} /></Field>
            </div>
          </ActionForm>
          {flags.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {flags.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className={f.status === 'open' ? 'text-red-200' : 'text-white/50'}>{f.dateLabel} · {f.hours}{f.note ? ` · ${f.note}` : ''} · {f.status === 'open' ? 'waiting for cover' : 'sorted'}</span>
                  {f.status === 'open' && <ActionButton tone="quiet" endpoint={COACH} className="!px-1.5 !py-0.5 !text-[11px]" body={{ action: 'flag.remove', id: f.id }}>Take back</ActionButton>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-white/[0.08] bg-[#0f1a2b] p-5">
          <h2 className="text-sm font-semibold text-white">Extra hours <span className="ml-1 text-[11px] font-normal text-white/45">on sale to parents straight away</span></h2>
          {venues.length === 0 ? (
            <p className="mt-3 text-xs text-white/45">The academy hasn&apos;t added a venue yet.</p>
          ) : (
            <ActionForm action="extra.add" endpoint={COACH} submitLabel="Add hours" className="mt-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Field label="Date"><input name="date" type="date" min={today} required className={inputCls} /></Field>
                <Field label="Venue"><select name="venueId" className={inputCls}>{venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></Field>
                <Field label="From"><input name="start" placeholder="16:00" required className={inputCls} /></Field>
                <Field label="To"><input name="end" placeholder="18:00" required className={inputCls} /></Field>
              </div>
            </ActionForm>
          )}
          {extras.length > 0 && (
            <ul className="mt-3 space-y-1.5 text-xs text-white/70">
              {extras.map((e) => <li key={e.id}>{e.dateLabel} · {e.hours} · {e.venue}</li>)}
            </ul>
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-white/[0.08] bg-[#0f1a2b] p-5">
        <h2 className="text-sm font-semibold text-white">My weekly hours <span className="ml-1 text-[11px] font-normal text-white/45">set by the academy · ask them to change these</span></h2>
        {hours.length === 0 ? (
          <p className="mt-3 text-xs text-white/45">No hours yet. Until the academy adds some, nothing of yours is on sale.</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {hours.map((h) => <span key={h.id} className="rounded-md border border-white/[0.12] px-2 py-1 text-[11px] text-white/80">{h.day} {h.from}–{h.to} · {h.venue}</span>)}
          </div>
        )}
        {blocks.length > 0 && (
          <p className="mt-2 text-[11px] text-white/45">Blocked by the academy: {blocks.map((b) => `${b.dateLabel} ${b.hours}`).join(', ')}.</p>
        )}
      </section>

      {done.length > 0 && (
        <section className="rounded-2xl border border-white/[0.08] bg-[#0f1a2b] p-5">
          <h2 className="text-sm font-semibold text-white">Last seven days</h2>
          <ul className="mt-2 divide-y divide-white/[0.06]">
            {done.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span className="text-white/80">{s.dateLabel} · {s.time} · {s.child}</span>
                <span className="flex items-center gap-2 text-[11px]">
                  <span className={s.status === 'attended' ? 'text-emerald-300' : 'text-amber-300'}>{s.status === 'attended' ? 'coached ✓' : 'no show'}</span>
                  <ActionButton tone="quiet" endpoint={COACH} className="!px-1.5 !py-0.5 !text-[11px]" body={{ action: 'session.status', sessionId: s.id, status: 'scheduled' }}>undo</ActionButton>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
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
