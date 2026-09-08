'use client'

import { useMemo, useState } from 'react'
import AscendForm from './AscendForm'

// The live Coaching Business Calculator — the ASCEND cost model from the
// 8-page guide, open to everyone (no gate). The email gate sits on the
// takeaway (guide + John's first fix) and the lead carries these numbers
// so John can reply to a real figure, not "I ran it".
//
// Model (guide p.04–07): fixed = venue + coach + other; revenue = price × players;
// profit = revenue − fixed − tax; real hourly = profit ÷ (session + admin hours);
// recommended price for a 40% margin: p = fixed ÷ (players × ((1 − tax) − 0.40)).

export type Verdict = {
  hourly: number
  band: string
  price: number
  players: number
  sessions: number
  revenue: number
  profit: number
  margin: number
  totalCost: number
  breakeven: number
  time: number
  recPrice: number
  recProfit: number
  recHourly: number
  gapSession: number
  gapMonth: number
}

type Inputs = {
  price: string
  players: string
  length: string
  sessions: string
  venue: string
  coach: string
  other: string
  tax: string
  admin: string
}

const DEFAULTS: Inputs = { price: '5', players: '20', length: '1', sessions: '6', venue: '35', coach: '25', other: '10', tax: '15', admin: '2' }
const TARGET_MARGIN = 0.4
const WEEKS_PER_MONTH = 4.33

function num(v: string) {
  const n = parseFloat(v)
  return Number.isFinite(n) && n > 0 ? n : 0
}
export function gbp(n: number) {
  const r = Math.round(n)
  return (r < 0 ? '-£' : '£') + Math.abs(r).toLocaleString('en-GB')
}
function gbp2(n: number) {
  const r = Math.round(n * 100) / 100
  return '£' + (r % 1 === 0 ? r.toString() : r.toFixed(2))
}
function bandFor(h: number): { label: string; cls: string } {
  if (h < 10) return { label: 'Below minimum wage', cls: 'text-[#f0526b]' }
  if (h < 20) return { label: 'Working poor', cls: 'text-[#f2b441]' }
  if (h < 40) return { label: 'Room to grow', cls: 'text-[#22d3ee]' }
  if (h < 80) return { label: 'Healthy', cls: 'text-[#38d39f]' }
  return { label: 'Premium territory', cls: 'text-[#38d39f]' }
}

export function compute(i: Inputs): Verdict {
  const price = num(i.price), players = num(i.players), length = num(i.length), sessions = num(i.sessions)
  const venue = num(i.venue), coach = num(i.coach), other = num(i.other)
  const taxRate = Math.min(0.95, num(i.tax) / 100), admin = num(i.admin)

  const fixed = venue + coach + other
  const revenue = price * players
  const totalCost = fixed + revenue * taxRate
  const profit = revenue - totalCost
  const time = length + admin
  const hourly = time > 0 ? profit / time : 0
  const margin = revenue > 0 ? profit / revenue : 0
  const breakeven = price > 0 ? Math.ceil(fixed / price) : 0

  const denom = players * (1 - taxRate - TARGET_MARGIN)
  let recPrice = denom > 0 ? fixed / denom : 0
  recPrice = Math.round(recPrice / 0.5) * 0.5
  if (recPrice < price) recPrice = price
  const recRevenue = recPrice * players
  const recProfit = recRevenue - (fixed + recRevenue * taxRate)
  const recHourly = time > 0 ? recProfit / time : 0
  const gapSession = Math.max(0, recProfit - profit)
  const gapMonth = gapSession * sessions * WEEKS_PER_MONTH

  return { hourly, band: bandFor(hourly).label, price, players, sessions, revenue, profit, margin, totalCost, breakeven, time, recPrice, recProfit, recHourly, gapSession, gapMonth }
}

function Field({ id, label, value, onChange, prefix, suffix, step = '1' }: { id: string; label: string; value: string; onChange: (v: string) => void; prefix?: string; suffix?: string; step?: string }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-[#c4d0d8] mb-1.5">{label}</label>
      <div className="relative">
        {prefix && <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7e8c99]">{prefix}</span>}
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min="0"
          step={step}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full rounded-lg border border-white/10 bg-[#090c10] py-2.5 text-base text-white focus:outline-none focus:border-[#22d3ee] focus:ring-2 focus:ring-[#22d3ee]/20 ${prefix ? 'pl-7 pr-3.5' : 'px-3.5'} ${suffix ? 'pr-16' : ''}`}
        />
        {suffix && <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-[#7e8c99]">{suffix}</span>}
      </div>
    </div>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#7e8c99] pb-2 mb-3 border-b border-white/10">{title}</div>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function Stat({ value, label, tone }: { value: string; label: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#090c10] px-2.5 py-3.5 text-center">
      <div className={`font-black text-2xl leading-none tabular-nums ${tone || 'text-white'}`}>{value}</div>
      <div className="mt-1.5 text-[10px] uppercase tracking-[0.08em] text-[#7e8c99]">{label}</div>
    </div>
  )
}

export default function AscendCalculator() {
  const [i, setI] = useState<Inputs>(DEFAULTS)
  const v = useMemo(() => compute(i), [i])
  const set = (k: keyof Inputs) => (val: string) => setI((s) => ({ ...s, [k]: val }))
  const band = bandFor(v.hourly)
  const hasGap = v.recPrice > v.price && v.gapSession > 0.5

  return (
    <div>
      <div className="grid lg:grid-cols-[.92fr_1.08fr] gap-5 items-start">
        {/* Inputs */}
        <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#10161c] to-[#0b1116] p-6 sm:p-7 space-y-6">
          <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#22d3ee]">Your numbers</div>
          <Group title="Your session">
            <Field id="c-price" label="Current price per player" prefix="£" step="0.5" value={i.price} onChange={set('price')} />
            <Field id="c-players" label="Average players per session" value={i.players} onChange={set('players')} />
            <Field id="c-length" label="Session length" suffix="hours" step="0.25" value={i.length} onChange={set('length')} />
            <Field id="c-sessions" label="Sessions you run per week" value={i.sessions} onChange={set('sessions')} />
          </Group>
          <Group title="Your costs (per session)">
            <Field id="c-venue" label="Venue / pitch hire" prefix="£" value={i.venue} onChange={set('venue')} />
            <Field id="c-coach" label="Coach cost (pay yourself too)" prefix="£" value={i.coach} onChange={set('coach')} />
            <Field id="c-other" label="Other (kit, insurance, admin)" prefix="£" value={i.other} onChange={set('other')} />
          </Group>
          <Group title="The reality">
            <Field id="c-tax" label="Tax set-aside" suffix="%" value={i.tax} onChange={set('tax')} />
            <Field id="c-admin" label="Planning + admin time per session" suffix="hours" step="0.25" value={i.admin} onChange={set('admin')} />
          </Group>
        </div>

        {/* Verdict */}
        <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#10161c] to-[#0b1116] p-6 sm:p-7 lg:sticky lg:top-6">
          <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#22d3ee]">The verdict</div>
          <div className="mt-4 rounded-xl border border-white/10 bg-[#090c10] px-4 py-6 text-center">
            <div className="text-[11px] uppercase tracking-[0.2em] text-[#7e8c99]">Your real hourly rate</div>
            <div className={`mt-2 font-black text-6xl sm:text-7xl leading-none tabular-nums ${band.cls}`} aria-live="polite">{gbp(v.hourly)}</div>
            <div className={`inline-block mt-3 rounded-full border border-current px-3.5 py-1 text-[11px] font-bold uppercase tracking-[0.06em] ${band.cls}`}>{band.label}</div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2.5">
            <Stat value={gbp(v.revenue)} label="Revenue / session" />
            <Stat value={gbp(v.profit)} label="Profit / session" tone={v.profit < 0 ? 'text-[#f0526b]' : undefined} />
            <Stat value={`${Math.round(v.margin * 100)}%`} label="Margin" />
            <Stat value={gbp(v.totalCost)} label="Total cost" />
            <Stat value={String(v.breakeven)} label="Break-even players" />
            <Stat value={`${Math.round(v.time * 10) / 10}h`} label="Time invested" />
          </div>
          <div className="mt-4 rounded-xl border border-[#22d3ee] bg-[#10161c] p-5 text-center">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#22d3ee]">You should be charging</div>
            <div className="mt-2 font-black text-5xl leading-none text-[#22d3ee] tabular-nums">{gbp2(v.recPrice)}</div>
            <div className="mt-2 text-sm text-[#c4d0d8]">
              {hasGap ? `up from ${gbp2(v.price)} — for a healthy 40% margin` : 'you’re already at or above a healthy margin — protect it'}
            </div>
            {hasGap && (
              <div className="mt-4 flex justify-center gap-6">
                <div><div className="font-black text-xl text-[#38d39f] leading-none">{gbp(v.recHourly)}</div><div className="text-[10px] uppercase tracking-[0.08em] text-[#7e8c99] mt-1">New hourly rate</div></div>
                <div><div className="font-black text-xl text-[#38d39f] leading-none">{gbp(v.recProfit)}</div><div className="text-[10px] uppercase tracking-[0.08em] text-[#7e8c99] mt-1">New profit / session</div></div>
              </div>
            )}
          </div>
          {hasGap && (
            <p className="mt-4 text-center text-sm text-[#b6c2ca]">
              Across {v.sessions || 0} sessions a week, that gap is{' '}
              <span className="font-black text-white text-base">{gbp(v.gapMonth)} a month</span> you’re not being paid.
            </p>
          )}
        </div>
      </div>

      {/* Takeaway — the only gate on the page */}
      <div id="get" className="mt-6 grid lg:grid-cols-2 gap-5 items-stretch">
        <div className="rounded-2xl border border-[#f2b441]/40 bg-[#10161c] p-6 sm:p-7 flex flex-col">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#f2b441]">Keep your number</p>
          <h3 className="mt-2 text-2xl font-black text-white" style={{ textWrap: 'balance' } as React.CSSProperties}>
            {hasGap ? <>That’s <span className="text-[#f2b441]">{gbp(v.gapMonth)} a month</span>. Here’s how to close it.</> : <>Good numbers. Now protect them.</>}
          </h3>
          <ul className="mt-4 space-y-2.5 text-[15px] text-[#eef3f5]">
            {[
              'The 8-page Pricing Calculator guide — the model above with a full worked example, so you can defend your new price to any parent',
              'Your numbers, emailed to you so you have them on the pitch',
              'John reads every reply and tells you the first thing he’d change — a real reply, not an autoresponder',
            ].map((f) => (
              <li key={f} className="flex items-start gap-2.5">
                <svg className="w-4 h-4 mt-1 shrink-0 text-[#f2b441]" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <p className="mt-auto pt-5 text-xs text-[#7e8c99]">Free · no card · unsubscribe any time</p>
        </div>
        <AscendForm verdict={v} />
      </div>
    </div>
  )
}
