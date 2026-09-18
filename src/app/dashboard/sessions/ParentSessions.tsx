'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

type Slot = { id: string; child: string; status: string; label: string; address: string | null; pricePence: number; type: string }
type Sess = { id: string; date: string; dateLabel: string; time: string; child: string; coach: string; venue: string; address: string | null; status: string; chargeState: string; pricePence: number; declineTier: string | null; canDecline: boolean }
type Month = { month: string; label: string; charge: { id: string; status: string; amountPence: number; creditPence: number; attempts: number } | null; sessions: Sess[] }

// Formatting lives here: a server page can't hand a function to a client component.
const gbp = (p: number) => `£${(p / 100).toFixed(2).replace(/\.00$/, '')}`

export default function ParentSessions({ academy, today, creditPence, calendar, notice, slots, oneOffs, months }: {
  academy: string; today: string; creditPence: number; calendar: { https: string; webcal: string }; notice: string | null
  slots: Slot[]; oneOffs: Sess[]; months: Month[]
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [ask, setAsk] = useState<Sess | null>(null)
  const [msg, setMsg] = useState<string | null>(notice)
  const [err, setErr] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const hoursNotice = (s: Sess) => {
    const start = new Date(`${s.date}T${s.time}:00`)
    return (start.getTime() - Date.now()) / 3_600_000
  }
  const tierText = (h: number) => h > 168 ? 'More than 7 days notice, so the full amount comes off your next month.' : h >= 48 ? 'Between 7 days and 48 hours notice, so half comes off your next month and half is kept.' : 'Under 48 hours notice, so this session is still charged.'

  const decline = (s: Sess) => start(async () => {
    setErr(null)
    const res = await fetch('/api/one-to-one/parent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'decline', sessionId: s.id }) })
    const json = await res.json().catch(() => ({}))
    setAsk(null)
    if (!res.ok) { setErr(json.error || 'Could not release that session'); return }
    setMsg(json.message || 'Released.')
    router.refresh()
  })
  const payNow = (chargeId: string) => start(async () => {
    setErr(null)
    const res = await fetch('/api/one-to-one/parent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'paynow', chargeId }) })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || !json.url) { setErr(json.error || 'Could not open payment'); return }
    window.location.href = json.url
  })
  const copy = async () => {
    try { await navigator.clipboard.writeText(calendar.https); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* link is visible anyway */ }
  }

  const nothing = slots.length === 0 && oneOffs.length === 0
  if (nothing) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-white">1-2-1 sessions</h1>
        <div className="rounded-2xl border border-dashed border-white/[0.15] p-8 text-center text-sm text-white/55">No 1-2-1 sessions yet. {academy} sets up regular slots and sends you a link, or you can book a one-off from their booking page.</div>
      </div>
    )
  }

  const statusLine = (s: Sess) => s.status === 'attended' ? ' · coached ✓' : s.status === 'no_show' ? ' · missed' : s.status === 'declined' ? ` · released${s.declineTier === 'full' ? ', credited' : s.declineTier === 'half' ? ', half credited' : ', charged'}` : s.status === 'cancelled' ? ' · cancelled by the academy, credited' : s.status === 'held' ? ' · payment not finished' : ''

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">1-2-1 sessions</h1>
          <p className="mt-1 text-sm text-white/55">{academy}. {slots.length > 0 ? 'Your slot rolls on month to month. Charged on the 1st for the sessions in the month.' : 'One-off sessions, paid when you book.'}</p>
        </div>
        {creditPence !== 0 && (
          <div className="rounded-xl border border-white/[0.08] bg-[#0f1a2b] px-4 py-2 text-right">
            <div className="text-[11px] uppercase tracking-wide text-white/45">{creditPence > 0 ? 'Credit on account' : 'Owed'}</div>
            <div className={`text-lg font-bold ${creditPence > 0 ? 'text-emerald-300' : 'text-amber-300'}`}>{gbp(Math.abs(creditPence))}</div>
          </div>
        )}
      </div>
      {msg && <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-100">{msg}</div>}
      {err && <div className="rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-2 text-sm text-red-100">{err}</div>}

      {slots.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {slots.map((s) => (
            <div key={s.id} className="rounded-2xl border border-white/[0.08] bg-[#0f1a2b] p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-white">{s.child} · {s.type}</div>
                  <div className="text-xs text-white/60">{s.label}</div>
                  {s.address && <div className="text-[11px] text-white/40">{s.address}</div>}
                  <div className="mt-1 text-[11px] text-white/40">{gbp(s.pricePence)} a session</div>
                </div>
                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${s.status === 'active' ? 'border-emerald-400/35 text-emerald-300' : s.status === 'pending' ? 'border-[#4ecde6]/35 text-[#4ecde6]' : 'border-amber-400/35 text-amber-300'}`}>{s.status === 'pending' ? 'awaiting set-up' : s.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {oneOffs.length > 0 && (
        <section className="rounded-2xl border border-amber-400/25 bg-amber-400/[0.05] p-5">
          <h2 className="text-sm font-semibold text-white">One-off sessions <span className="ml-1 text-[11px] font-normal text-white/50">booked from the booking page, paid up front</span></h2>
          <ul className="mt-2 divide-y divide-white/[0.06]">
            {oneOffs.map((s) => (
              <li key={s.id} className="py-2.5 text-sm">
                <div className="font-semibold text-white">{s.dateLabel} · {s.time}</div>
                <div className="text-[11px] text-white/45">{s.child} · {s.coach} at {s.venue}{s.address ? `, ${s.address}` : ''} · {gbp(s.pricePence)}{statusLine(s)}</div>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-white/40">Need to change a one-off? Reply to the booking email and {academy} will sort it.</p>
        </section>
      )}

      {months.map((m) => (
        <section key={m.month} className="rounded-2xl border border-white/[0.08] bg-[#0f1a2b] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="text-sm font-semibold text-white">{m.label}</h2>
            <div className="text-right text-xs">
              {m.charge ? (
                m.charge.status === 'paid_online' || m.charge.status === 'paid_cash' ? <span className="rounded-full border border-emerald-400/35 px-2 py-0.5 font-semibold text-emerald-300">Paid {gbp(m.charge.amountPence)}{m.charge.status === 'paid_cash' ? ' cash' : ''}</span>
                : m.charge.status === 'failed' ? (
                  <span className="inline-flex items-center gap-2"><span className="rounded-full border border-red-400/35 px-2 py-0.5 font-semibold text-red-300">Payment failed · {gbp(m.charge.amountPence)}</span><button disabled={pending} onClick={() => payNow(m.charge!.id)} className="rounded-lg bg-[#4ecde6] px-3 py-1 font-semibold text-[#04141a]">Pay now</button></span>
                ) : m.charge.status === 'waived' ? <span className="rounded-full border border-white/20 px-2 py-0.5 font-semibold text-white/60">Covered by credit</span>
                : m.charge.status === 'refunded' ? <span className="rounded-full border border-white/20 px-2 py-0.5 font-semibold text-white/60">Refunded</span>
                : <span className="text-white/55">{gbp(m.charge.amountPence)} on the 1st</span>
              ) : (
                <span className="text-white/55">{m.sessions.filter((s) => s.status === 'scheduled').length} session{m.sessions.filter((s) => s.status === 'scheduled').length === 1 ? '' : 's'} · {gbp(m.sessions.filter((s) => s.status === 'scheduled').reduce((a, s) => a + s.pricePence, 0))}{m.month > today.slice(0, 7) + '-01' ? ' on the 1st' : ''}</span>
              )}
            </div>
          </div>
          {m.sessions.length === 0 ? (
            <p className="mt-3 text-xs text-white/45">{slots.length === 0 ? 'No regular slot.' : m.month > today ? 'Dates appear on the 20th.' : 'No sessions this month.'}</p>
          ) : (
            <ul className="mt-2 divide-y divide-white/[0.06]">
              {m.sessions.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div>
                    <div className={`font-semibold ${s.status === 'declined' || s.status === 'cancelled' ? 'text-white/40 line-through' : 'text-white'}`}>{s.dateLabel} · {s.time}</div>
                    <div className="text-[11px] text-white/45">{s.child} · {s.coach} at {s.venue}{statusLine(s)}</div>
                  </div>
                  {s.canDecline && <button onClick={() => setAsk(s)} className="rounded-full border border-white/[0.15] px-3 py-1 text-[11px] text-white/70 hover:border-white/40">Can&apos;t make it</button>}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <section className="rounded-2xl border border-white/[0.08] bg-[#0f1a2b] p-5">
        <h2 className="text-sm font-semibold text-white">Put these in your phone calendar</h2>
        <p className="mt-1 text-xs text-white/55">Subscribe once. New dates, changes and cancellations update on their own.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <a href={calendar.webcal} className="rounded-lg border border-[#4ecde6] bg-[#4ecde6] px-3 py-1.5 text-xs font-semibold text-[#04141a]">Add to my calendar</a>
          <button type="button" onClick={copy} className="rounded-lg border border-white/[0.12] bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-white">{copied ? 'Copied' : 'Copy link for Google Calendar'}</button>
        </div>
        <p className="mt-2 text-[11px] text-white/40">Google Calendar: Other calendars, From URL, paste the link. The link is private to your account.</p>
      </section>

      <p className="text-[11px] text-white/35">To stop your slot, message {academy} and they&apos;ll release it. Cancellations: over 7 days full credit, 7 days to 48 hours half, under 48 hours charged.</p>

      {ask && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" onClick={() => setAsk(null)}>
          <div className="w-full max-w-md rounded-2xl border border-white/[0.12] bg-[#142236] p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-white">Can&apos;t make {ask.dateLabel} at {ask.time}?</h3>
            <p className="mt-2 text-sm text-white/70">{tierText(hoursNotice(ask))} The time goes on sale for someone else. Your regular slot stays yours.</p>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setAsk(null)} className="flex-1 rounded-lg border border-white/[0.15] px-3 py-2 text-sm text-white/70">Keep it</button>
              <button disabled={pending} onClick={() => decline(ask)} className="flex-1 rounded-lg bg-[#4ecde6] px-3 py-2 text-sm font-semibold text-[#04141a] disabled:opacity-50">{pending ? 'One moment…' : 'Yes, release it'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
