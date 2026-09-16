'use client'

import { useMemo, useState } from 'react'

type Free = { date: string; startMinutes: number; coachId: string; coach: string; venueId: string; venue: string }
type Venue = { id: string; name: string; address: string | null }

const DAY = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
const fmt = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
const wd = (iso: string) => { const d = new Date(`${iso}T12:00:00Z`).getUTCDay(); return d === 0 ? 7 : d }

async function call(body: Record<string, unknown>) {
  const res = await fetch('/api/one-to-one/public', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const json = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, ...json } as { ok: boolean; status: number; error?: string; [k: string]: unknown }
}

export default function BookSessions({ slug, academy, primary, pricePence, durationMinutes, venues, initial, booked, cancelled, priceLabel }: {
  slug: string; academy: string; primary: string; pricePence: number; durationMinutes: number
  venues: Venue[]; initial: Free[]; booked: { childName: string; date: string; startMinutes: number; coach: string; venue: string } | null
  cancelled: boolean; priceLabel: string
}) {
  const [days, setDays] = useState<number[]>([])
  const [venueIds, setVenueIds] = useState<string[]>([])
  const [after, setAfter] = useState<number>(0)
  const [pick, setPick] = useState<Free | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [mode, setMode] = useState<'list' | 'details' | 'request' | 'requested'>('list')
  const [form, setForm] = useState({ guestName: '', guestEmail: '', guestPhone: '', childName: '' })

  const list = useMemo(() => initial.filter((f) =>
    (days.length === 0 || days.includes(wd(f.date))) && (venueIds.length === 0 || venueIds.includes(f.venueId)) && f.startMinutes >= after,
  ), [initial, days, venueIds, after])

  const byDate = useMemo(() => {
    const m = new Map<string, Free[]>()
    for (const f of list) m.set(f.date, [...(m.get(f.date) || []), f])
    return [...m.entries()]
  }, [list])

  if (booked) {
    return (
      <section className="rounded-2xl border border-emerald-400/30 bg-[#0f1a2b] p-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-400/15 text-2xl text-emerald-300">✓</div>
        <h2 className="text-lg font-bold">Booked and paid</h2>
        <p className="mt-2 text-sm text-white/70">{booked.childName} · {fmt(booked.date)} at {hhmm(booked.startMinutes)} · {booked.coach} at {booked.venue}</p>
        <p className="mt-3 text-xs text-white/45">A receipt is on its way to your email, with a reminder the day before. Nobody at {academy} had to do anything.</p>
        <a href={`/book/${slug}/sessions`} className="mt-5 inline-block rounded-lg border border-white/[0.15] px-4 py-2 text-sm">Book another</a>
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
    const r = await call({ action: 'request', slug, contactName: fd.get('contactName'), contactEmail: fd.get('contactEmail'), contactPhone: fd.get('contactPhone'), childName: fd.get('childName'), childAgeGroup: fd.get('childAgeGroup'), notes: fd.get('notes'), weekdays: days, venueIds, afterMinutes: after || null })
    setBusy(false)
    if (!r.ok) { setErr(r.error || 'Could not send'); return }
    setMode('requested')
  }

  return (
    <div className="space-y-4">
      {cancelled && <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-sm text-amber-100">Payment was cancelled. The session was released, pick it again if you still want it.</div>}

      {mode === 'requested' && (
        <section className="rounded-2xl border border-white/[0.1] bg-[#0f1a2b] p-6 text-center">
          <h2 className="text-lg font-bold">Sent to {academy}</h2>
          <p className="mt-2 text-sm text-white/70">It&apos;s on their list. They&apos;ll get in touch when something opens up.</p>
          <button onClick={() => setMode('list')} className="mt-4 text-sm text-white/60 underline">Back</button>
        </section>
      )}

      {mode === 'request' && (
        <form onSubmit={request} className="space-y-3 rounded-2xl border border-white/[0.1] bg-[#0f1a2b] p-5">
          <h2 className="text-base font-bold">Request a session</h2>
          <p className="text-xs text-white/55">Tell {academy} what you&apos;re after. Your day and venue filters are sent with it.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <input name="contactName" required placeholder="Your name" className={inp} />
            <input name="contactEmail" type="email" required placeholder="Email" className={inp} />
            <input name="contactPhone" placeholder="Phone (optional)" className={inp} />
            <input name="childName" placeholder="Child's name" className={inp} />
            <input name="childAgeGroup" placeholder="Age group, e.g. U11" className={inp} />
          </div>
          <textarea name="notes" placeholder="Anything else" rows={2} className={inp} />
          <div className="flex items-center gap-3">
            <button disabled={busy} className="rounded-lg px-4 py-2 text-sm font-semibold text-[#04141a]" style={{ background: primary }}>{busy ? 'Sending…' : 'Send request'}</button>
            <button type="button" onClick={() => setMode('list')} className="text-sm text-white/60">Back</button>
            {err && <span className="text-xs text-red-300">{err}</span>}
          </div>
        </form>
      )}

      {mode === 'details' && pick && (
        <section className="space-y-3 rounded-2xl border border-white/[0.1] bg-[#0f1a2b] p-5">
          <h2 className="text-base font-bold">{fmt(pick.date)} at {hhmm(pick.startMinutes)}</h2>
          <p className="text-sm text-white/70">{durationMinutes} minutes with {pick.coach} at {pick.venue} · <b className="text-white">{priceLabel}</b></p>
          <div className="grid gap-2 sm:grid-cols-2">
            <input value={form.childName} onChange={(e) => setForm({ ...form, childName: e.target.value })} placeholder="Child's name" className={inp} />
            <input value={form.guestName} onChange={(e) => setForm({ ...form, guestName: e.target.value })} placeholder="Your name" className={inp} />
            <input value={form.guestEmail} onChange={(e) => setForm({ ...form, guestEmail: e.target.value })} type="email" placeholder="Email for the receipt" className={inp} />
            <input value={form.guestPhone} onChange={(e) => setForm({ ...form, guestPhone: e.target.value })} placeholder="Phone (optional)" className={inp} />
          </div>
          <p className="text-[11px] text-white/45">Cancelling: more than 7 days' notice is a full credit, 7 days to 48 hours is half, under 48 hours is charged. The time is held for 12 minutes while you pay.</p>
          <div className="flex items-center gap-3">
            <button onClick={pay} disabled={busy || !form.childName || !form.guestName || !form.guestEmail} className="rounded-lg px-4 py-2 text-sm font-semibold text-[#04141a] disabled:opacity-50" style={{ background: primary }}>{busy ? 'One moment…' : `Pay ${priceLabel}`}</button>
            <button type="button" onClick={() => { setMode('list'); setPick(null) }} className="text-sm text-white/60">Back</button>
            {err && <span className="text-xs text-red-300">{err}</span>}
          </div>
        </section>
      )}

      {mode === 'list' && (
        <>
          <section className="rounded-2xl border border-white/[0.1] bg-[#0f1a2b] p-4">
            <div className="flex flex-wrap gap-1.5">
              {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                <button key={d} type="button" onClick={() => setDays(days.includes(d) ? days.filter((x) => x !== d) : [...days, d])} className={`rounded-full border px-3 py-1 text-xs ${days.includes(d) ? 'border-white bg-white text-[#080e18]' : 'border-white/[0.15] text-white/70'}`}>{DAY[d]}</button>
              ))}
              <span className="mx-1 self-center text-white/20">|</span>
              {venues.map((v) => (
                <button key={v.id} type="button" onClick={() => setVenueIds(venueIds.includes(v.id) ? venueIds.filter((x) => x !== v.id) : [...venueIds, v.id])} className={`rounded-full border px-3 py-1 text-xs ${venueIds.includes(v.id) ? 'border-white bg-white text-[#080e18]' : 'border-white/[0.15] text-white/70'}`}>{v.name}</button>
              ))}
              <span className="mx-1 self-center text-white/20">|</span>
              <select value={after} onChange={(e) => setAfter(Number(e.target.value))} className="rounded-full border border-white/[0.15] bg-transparent px-3 py-1 text-xs text-white/70">
                <option value={0}>Any time</option><option value={900}>After 15:00</option><option value={960}>After 16:00</option><option value={1020}>After 17:00</option><option value={1080}>After 18:00</option>
              </select>
            </div>
            <p className="mt-2 text-[11px] text-white/40">{durationMinutes} minutes, {priceLabel}, paid online. Next four weeks.</p>
          </section>

          {byDate.length === 0 ? (
            <section className="rounded-2xl border border-dashed border-white/[0.15] p-6 text-center">
              <p className="text-sm text-white/70">Nothing free that matches.</p>
              <button onClick={() => setMode('request')} className="mt-3 rounded-lg border border-white/[0.15] px-4 py-2 text-sm">Request a session</button>
            </section>
          ) : (
            <div className="space-y-3">
              {byDate.map(([date, items]) => (
                <section key={date} className="rounded-2xl border border-white/[0.1] bg-[#0f1a2b] p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-white/45">{fmt(date)}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {items.map((f) => (
                      <button key={`${f.coachId}-${f.venueId}-${f.startMinutes}`} onClick={() => { setPick(f); setMode('details'); setErr(null) }} className="rounded-xl border border-white/[0.12] bg-white/[0.04] px-3 py-2 text-left hover:border-white/30">
                        <div className="text-sm font-semibold">{hhmm(f.startMinutes)}</div>
                        <div className="text-[11px] text-white/55">{f.coach} · {f.venue}</div>
                      </button>
                    ))}
                  </div>
                </section>
              ))}
              <div className="text-center"><button onClick={() => setMode('request')} className="text-xs text-white/50 underline">Nothing that works? Request a session</button></div>
            </div>
          )}
        </>
      )}
      <p className="text-center text-[11px] text-white/30">Payments are taken by {academy} through Stripe. {pricePence > 0 ? '' : ''}</p>
    </div>
  )
}

const inp = 'w-full rounded-lg border border-white/[0.12] bg-[#080e18] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-white/40 focus:outline-none'
