'use client'

import { useMemo, useState } from 'react'

type Free = { date: string; startMinutes: number; coachId: string; coach: string; venueId: string; venue: string }
type Venue = { id: string; name: string; address: string | null }

const DAY = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
const utc = (iso: string) => new Date(`${iso}T12:00:00Z`)
const fmt = (iso: string) => utc(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
const fmtLong = (iso: string) => utc(iso).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
const wd = (iso: string) => { const d = utc(iso).getUTCDay(); return d === 0 ? 7 : d }
const addDays = (iso: string, n: number) => { const d = utc(iso); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
const monday = (iso: string) => addDays(iso, -(wd(iso) - 1))

/** Dark text on a light brand colour, white on a dark one. */
function inkOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim()); if (!m) return '#04141a'
  const n = parseInt(m[1], 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.55 ? '#04141a' : '#ffffff'
}

async function call(body: Record<string, unknown>) {
  const res = await fetch('/api/one-to-one/public', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const json = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, ...json } as { ok: boolean; status: number; error?: string; [k: string]: unknown }
}

export default function BookSessions({ slug, academy, primary, durationMinutes, venues, initial, today, booked, cancelled, priceLabel }: {
  slug: string; academy: string; primary: string; durationMinutes: number
  venues: Venue[]; initial: Free[]; today: string; booked: { childName: string; date: string; startMinutes: number; coach: string; venue: string } | null
  cancelled: boolean; priceLabel: string
}) {
  const ink = inkOn(primary)
  const weeks = useMemo(() => Array.from({ length: 4 }, (_, i) => addDays(monday(today), i * 7)), [today])
  const firstWithFree = weeks.findIndex((w) => initial.some((f) => f.date >= w && f.date <= addDays(w, 6)))
  const [week, setWeek] = useState(Math.max(0, firstWithFree))
  const [day, setDay] = useState<string | null>(null)
  const [venueIds, setVenueIds] = useState<string[]>([])
  const [after, setAfter] = useState<number>(0)
  const [pick, setPick] = useState<Free | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [mode, setMode] = useState<'list' | 'details' | 'request' | 'requested'>('list')
  const [form, setForm] = useState({ guestName: '', guestEmail: '', guestPhone: '', childName: '' })

  const matches = useMemo(() => initial.filter((f) => (venueIds.length === 0 || venueIds.includes(f.venueId)) && f.startMinutes >= after), [initial, venueIds, after])
  const weekStart = weeks[week], weekEnd = addDays(weekStart, 6)
  const inWeek = useMemo(() => matches.filter((f) => f.date >= weekStart && f.date <= weekEnd), [matches, weekStart, weekEnd])
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const shown = day ? inWeek.filter((f) => f.date === day) : inWeek
  const byDate = useMemo(() => {
    const m = new Map<string, Map<string, Free[]>>()
    for (const f of shown) {
      const g = m.get(f.date) ?? new Map<string, Free[]>(); const key = `${f.venueId}|${f.coachId}`
      g.set(key, [...(g.get(key) || []), f]); m.set(f.date, g)
    }
    return [...m.entries()]
  }, [shown])
  const weekLabel = (i: number) => i === 0 ? 'This week' : i === 1 ? 'Next week' : `${utc(weeks[i]).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
  const address = (id: string) => venues.find((v) => v.id === id)?.address || null

  if (booked) {
    return (
      <section className="rounded-3xl border border-[#67c79a]/30 bg-[#0f1a2b] p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#67c79a]/15 text-2xl text-[#8fdcb6]">✓</div>
        <h2 className="text-xl font-bold">Booked and paid</h2>
        <p className="mt-2 text-sm text-white/75">{booked.childName} · {fmtLong(booked.date)} at {hhmm(booked.startMinutes)}</p>
        <p className="text-sm text-white/55">with {booked.coach} at {booked.venue}</p>
        <p className="mx-auto mt-4 max-w-sm text-xs leading-relaxed text-white/45">A receipt is on its way to your email, and you&apos;ll get a reminder the day before.</p>
        <a href={`/book/${slug}/sessions`} className="mt-6 inline-block rounded-xl border border-white/[0.15] px-5 py-2.5 text-sm font-semibold">Book another</a>
      </section>
    )
  }

  const pay = async () => {
    if (!pick) return
    setBusy(true); setErr(null)
    const hold = await call({ action: 'hold', slug, date: pick.date, startMinutes: pick.startMinutes, coachId: pick.coachId, venueId: pick.venueId, ...form })
    if (!hold.ok) { setBusy(false); setErr(hold.error || 'Could not hold that session'); if (hold.status === 409) { setMode('list'); setPick(null) } return }
    const co = await call({ action: 'checkout', slug, sessionId: hold.sessionId, holdToken: hold.holdToken })
    if (!co.ok || !co.url) { setBusy(false); setErr(co.error || 'Could not start payment'); return }
    window.location.href = co.url as string
  }

  const request = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setBusy(true); setErr(null)
    const r = await call({ action: 'request', slug, contactName: fd.get('contactName'), contactEmail: fd.get('contactEmail'), contactPhone: fd.get('contactPhone'), childName: fd.get('childName'), childAgeGroup: fd.get('childAgeGroup'), notes: fd.get('notes'), weekdays: day ? [wd(day)] : [], venueIds, afterMinutes: after || null })
    setBusy(false)
    if (!r.ok) { setErr(r.error || 'Could not send'); return }
    setMode('requested')
  }

  return (
    <div className="space-y-4">
      {cancelled && <div className="rounded-xl border border-[#d8a95a]/35 bg-[#d8a95a]/10 px-4 py-2.5 text-sm text-[#f6e3c1]">Payment was cancelled and the time was released. Pick it again if you still want it.</div>}

      {mode === 'requested' && (
        <section className="rounded-3xl border border-white/[0.1] bg-[#0f1a2b] p-8 text-center">
          <h2 className="text-lg font-bold">Sent to {academy}</h2>
          <p className="mt-2 text-sm text-white/70">It&apos;s on their list. They&apos;ll get in touch when something opens up.</p>
          <button onClick={() => setMode('list')} className="mt-4 text-sm text-white/60 underline">Back to the times</button>
        </section>
      )}

      {mode === 'request' && (
        <form onSubmit={request} className="space-y-3 rounded-3xl border border-white/[0.1] bg-[#0f1a2b] p-5 sm:p-6">
          <h2 className="text-lg font-bold">Ask for a time</h2>
          <p className="text-xs text-white/55">Tell {academy} what you&apos;re after. The venue and time you were filtering by go with it.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <input name="contactName" required placeholder="Your name" className={inp} />
            <input name="contactEmail" type="email" required placeholder="Email" className={inp} />
            <input name="contactPhone" placeholder="Phone (optional)" className={inp} />
            <input name="childName" placeholder="Child's name" className={inp} />
            <input name="childAgeGroup" placeholder="Age group, e.g. U11" className={inp} />
          </div>
          <textarea name="notes" placeholder="Anything else" rows={2} className={inp} />
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button disabled={busy} className="rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-50" style={{ background: primary, color: ink }}>{busy ? 'Sending…' : 'Send request'}</button>
            <button type="button" onClick={() => setMode('list')} className="text-sm text-white/60">Back</button>
            {err && <span className="text-xs text-[#f3a7a2]">{err}</span>}
          </div>
        </form>
      )}

      {mode === 'details' && pick && (
        <section className="overflow-hidden rounded-3xl border border-white/[0.1] bg-[#0f1a2b]">
          <div className="flex items-center gap-4 border-b border-white/[0.07] p-5 sm:p-6" style={{ background: `linear-gradient(135deg, ${primary}22, transparent 70%)` }}>
            <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl" style={{ background: primary, color: ink }}>
              <span className="text-[10px] font-bold uppercase leading-none tracking-wide">{DAY[wd(pick.date)]}</span>
              <span className="text-2xl font-bold leading-tight tabular-nums">{utc(pick.date).getUTCDate()}</span>
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-bold tabular-nums">{hhmm(pick.startMinutes)} <span className="text-base font-medium text-white/50">to {hhmm(pick.startMinutes + durationMinutes)}</span></h2>
              <p className="text-sm text-white/70">{fmtLong(pick.date)} · with {pick.coach}</p>
              <p className="truncate text-xs text-white/45">{pick.venue}{address(pick.venueId) ? ` · ${address(pick.venueId)}` : ''}</p>
            </div>
            <div className="ml-auto text-right"><div className="text-xl font-bold">{priceLabel}</div><div className="text-[11px] text-white/45">{durationMinutes} min</div></div>
          </div>
          <div className="space-y-3 p-5 sm:p-6">
            <div className="grid gap-2 sm:grid-cols-2">
              <input value={form.childName} onChange={(e) => setForm({ ...form, childName: e.target.value })} placeholder="Child's name" className={inp} />
              <input value={form.guestName} onChange={(e) => setForm({ ...form, guestName: e.target.value })} placeholder="Your name" className={inp} />
              <input value={form.guestEmail} onChange={(e) => setForm({ ...form, guestEmail: e.target.value })} type="email" placeholder="Email for the receipt" className={inp} />
              <input value={form.guestPhone} onChange={(e) => setForm({ ...form, guestPhone: e.target.value })} placeholder="Phone (optional)" className={inp} />
            </div>
            <p className="text-[11px] leading-relaxed text-white/45">Changing your mind: more than 7 days&apos; notice is a full credit, 7 days to 48 hours is half, under 48 hours is charged. We hold this time for 12 minutes while you pay.</p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button onClick={pay} disabled={busy || !form.childName || !form.guestName || !form.guestEmail} className="rounded-xl px-5 py-3 text-sm font-semibold disabled:opacity-40" style={{ background: primary, color: ink }}>{busy ? 'One moment…' : `Pay ${priceLabel} and book`}</button>
              <button type="button" onClick={() => { setMode('list'); setPick(null) }} className="text-sm text-white/60">Pick another time</button>
              {err && <span className="text-xs text-[#f3a7a2]">{err}</span>}
            </div>
          </div>
        </section>
      )}

      {mode === 'list' && (
        <>
          <div className="flex gap-1 overflow-x-auto rounded-2xl border border-white/[0.08] bg-[#0f1a2b] p-1">
            {weeks.map((w, i) => {
              const n = matches.filter((f) => f.date >= w && f.date <= addDays(w, 6)).length, on = i === week
              return (
                <button key={w} type="button" onClick={() => { setWeek(i); setDay(null) }} className={`min-w-[6.25rem] flex-1 rounded-xl px-3 py-2 text-left transition-colors ${on ? '' : 'hover:bg-white/[0.04]'}`} style={on ? { background: primary, color: ink } : undefined}>
                  <span className={`block whitespace-nowrap text-sm font-semibold ${on ? '' : 'text-white/80'}`}>{weekLabel(i)}</span>
                  <span className={`block text-[11px] ${on ? 'opacity-75' : 'text-white/40'}`}>{n ? `${n} free` : 'full'}</span>
                </button>
              )
            })}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {weekDays.map((d) => {
              const n = inWeek.filter((f) => f.date === d).length, on = day === d, past = d < today
              return (
                <button key={d} type="button" disabled={!n} onClick={() => setDay(on ? null : d)} className={`rounded-xl border px-1 py-2 text-center transition-colors ${on ? 'border-transparent' : n ? 'border-white/[0.1] bg-[#0f1a2b] hover:border-white/25' : 'border-transparent opacity-35'}`} style={on ? { background: primary, color: ink } : undefined}>
                  <span className="block text-[10px] font-semibold uppercase tracking-wide opacity-70">{DAY[wd(d)]}</span>
                  <span className="block text-base font-bold leading-tight tabular-nums">{utc(d).getUTCDate()}</span>
                  <span className="block text-[10px] opacity-70">{past ? '' : n ? `${n} free` : '–'}</span>
                </button>
              )
            })}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {venues.length > 1 && venues.map((v) => {
              const on = venueIds.includes(v.id)
              return <button key={v.id} type="button" onClick={() => setVenueIds(on ? venueIds.filter((x) => x !== v.id) : [...venueIds, v.id])} className={`rounded-full border px-3 py-1.5 text-xs font-medium ${on ? 'border-transparent' : 'border-white/[0.14] text-white/70 hover:border-white/30'}`} style={on ? { background: primary, color: ink } : undefined}>{v.name}</button>
            })}
            <select value={after} onChange={(e) => setAfter(Number(e.target.value))} className="rounded-full border border-white/[0.14] bg-[#0f1a2b] px-3 py-1.5 text-xs text-white/75">
              <option value={0}>Any time of day</option><option value={900}>After 3pm</option><option value={960}>After 4pm</option><option value={1020}>After 5pm</option><option value={1080}>After 6pm</option>
            </select>
          </div>

          {byDate.length === 0 ? (
            <section className="rounded-3xl border border-dashed border-white/[0.15] p-8 text-center">
              <p className="text-sm font-semibold text-white/80">Nothing free {day ? `on ${fmt(day)}` : 'this week'}{venueIds.length || after ? ' with those filters' : ''}.</p>
              <p className="mt-1 text-xs text-white/45">Try another week, or tell {academy} what you need.</p>
              <button onClick={() => setMode('request')} className="mt-4 rounded-xl border border-white/[0.15] px-4 py-2 text-sm font-semibold">Ask for a time</button>
            </section>
          ) : (
            <div className="space-y-3">
              {byDate.map(([date, groups]) => (
                <section key={date} className="rounded-3xl border border-white/[0.08] bg-[#0f1a2b] p-4 sm:p-5">
                  <h3 className="text-sm font-semibold text-white">{date === today ? 'Today · ' : ''}{fmtLong(date)}</h3>
                  <div className="mt-3 space-y-3">
                    {[...groups.entries()].map(([key, items]) => (
                      <div key={key}>
                        <div className="mb-1.5 text-[11px] text-white/45"><span className="font-semibold text-white/70">{items[0].venue}</span> · with {items[0].coach}</div>
                        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5 md:grid-cols-6">
                          {items.map((f) => (
                            <button key={f.startMinutes} onClick={() => { setPick(f); setMode('details'); setErr(null) }} className="pp-time rounded-xl border border-white/[0.12] bg-white/[0.03] px-2 py-2.5 text-center text-sm font-semibold tabular-nums transition-colors">
                              {hhmm(f.startMinutes)}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
              <div className="pt-1 text-center"><button onClick={() => setMode('request')} className="text-xs text-white/50 underline underline-offset-2">None of these work? Ask for a time</button></div>
            </div>
          )}
        </>
      )}
      <p className="pt-2 text-center text-[11px] text-white/30">Payments are taken by {academy}, securely through Stripe.</p>
      <style>{`.pp-time:hover,.pp-time:focus-visible{border-color:${primary};background:${primary}1f;outline:none}`}</style>
    </div>
  )
}

const inp = 'w-full rounded-xl border border-white/[0.12] bg-[#080e18] px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-white/40 focus:outline-none'
