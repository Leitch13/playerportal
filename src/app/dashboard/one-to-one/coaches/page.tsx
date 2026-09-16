import { requireAdmin, getCoaches, getVenues, getHours, getClosures, getExceptions, DAY, hhmm, fmtDate } from '@/lib/one-to-one/db'
import { addDays, todayLondon } from '@/lib/one-to-one/time'
import { ActionButton, ActionForm, Field, VenueForm, inputCls } from '../ui'

export const dynamic = 'force-dynamic'

// Coaches & venues — the academy sets the hours. They roll forward by definition.
// A coach can flag or add hours from their own page (phase 5); the academy can do
// both here on their behalf, and is the only one who can block or remove.
export default async function CoachesPage() {
  const { admin, orgId } = await requireAdmin()
  const today = todayLondon(), horizon = addDays(today, 90)
  const [coaches, venues, hours, closures, exceptions] = await Promise.all([
    getCoaches(admin, orgId), getVenues(admin, orgId), getHours(admin, orgId), getClosures(admin, orgId, today, horizon), getExceptions(admin, orgId, today, horizon),
  ])
  const vname = (id: string) => venues.find((v) => v.id === id)?.name || ''
  const liveHours = hours.filter((h) => !h.effective_to || h.effective_to >= today)

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-white">Venues</h2>
        {venues.map((v) => (
          <div key={v.id} className="rounded-2xl border border-white/[0.08] bg-[#0f1a2b] p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="font-semibold text-white">{v.name} {!v.is_active && <span className="ml-1 text-[11px] text-white/45">not in use</span>}</div>
                <div className="text-[11px] text-white/45">{v.address || ''}</div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const).map((k) => {
                    const r = v.weekly_hours?.[k]?.[0]
                    return <span key={k} className={`rounded-md border px-1.5 py-0.5 text-[11px] ${r ? 'border-white/[0.12] text-white/80' : 'border-white/[0.06] text-white/30'}`}>{k[0].toUpperCase() + k.slice(1)} {r ? `${r[0]}–${r[1]}` : 'closed'}</span>
                  })}
                </div>
              </div>
              <VenueForm venue={v} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {closures.filter((c) => c.venue_id === v.id).map((c) => (
                <span key={c.id} className="inline-flex items-center gap-1 rounded-md border border-red-400/35 bg-red-400/10 px-2 py-0.5 text-[11px] text-red-200">
                  Closed {fmtDate(c.closed_on)}{c.reason ? ` · ${c.reason}` : ''}
                  <ActionButton tone="quiet" className="!px-1 !py-0 !text-[11px]" body={{ action: 'venue.closure.remove', id: c.id }}>✕</ActionButton>
                </span>
              ))}
              <ActionForm action="venue.closure.add" extra={{ venueId: v.id }} submitLabel="Close a date" className="!space-y-0 flex items-end gap-2">
                <input name="date" type="date" className={inputCls + ' !w-auto !py-1 !text-[11px]'} />
                <input name="reason" placeholder="reason" className={inputCls + ' !w-32 !py-1 !text-[11px]'} />
              </ActionForm>
            </div>
          </div>
        ))}
        <VenueForm />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-white">Coaches and their hours</h2>
        {coaches.length === 0 && <p className="text-xs text-white/55">No coach logins in this academy yet. Add staff under Settings first.</p>}
        {coaches.map((c) => {
          const mine = liveHours.filter((h) => h.coach_id === c.id)
          const myEx = exceptions.filter((e) => e.coach_id === c.id)
          return (
            <div key={c.id} className="rounded-2xl border border-white/[0.08] bg-[#0f1a2b] p-4">
              <div className="font-semibold text-white">{c.full_name || c.email}</div>
              <dl className="mt-2 grid grid-cols-[44px_1fr] gap-x-3 gap-y-1 text-xs">
                {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                  <div key={d} className="contents">
                    <dt className="text-white/40">{DAY[d]}</dt>
                    <dd className="flex flex-wrap gap-1.5">
                      {mine.filter((h) => h.weekday === d).map((h) => (
                        <span key={h.id} className="inline-flex items-center gap-1 rounded-md border border-white/[0.12] bg-white/[0.04] px-2 py-0.5 text-white/85">
                          {hhmm(h.start_minutes)}–{hhmm(h.end_minutes)} · {vname(h.venue_id)}
                          <ActionButton tone="quiet" className="!px-1 !py-0 !text-[11px]" confirm="Remove these hours from today? Past sessions are unaffected." body={{ action: 'hours.remove', id: h.id }}>✕</ActionButton>
                        </span>
                      ))}
                      {mine.filter((h) => h.weekday === d).length === 0 && <span className="text-white/25">off</span>}
                    </dd>
                  </div>
                ))}
              </dl>
              {venues.length > 0 && (
                <ActionForm action="hours.add" extra={{ coachId: c.id }} submitLabel="Add hours" className="mt-3">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    <Field label="Day"><select name="weekday" className={inputCls}>{[1, 2, 3, 4, 5, 6, 7].map((d) => <option key={d} value={d}>{DAY[d]}</option>)}</select></Field>
                    <Field label="Venue"><select name="venueId" className={inputCls}>{venues.filter((v) => v.is_active).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></Field>
                    <Field label="From"><input name="start" placeholder="16:00" required className={inputCls} /></Field>
                    <Field label="To"><input name="end" placeholder="19:30" required className={inputCls} /></Field>
                    <Field label="Starting"><input name="from" type="date" defaultValue={today} className={inputCls} /></Field>
                  </div>
                </ActionForm>
              )}
              {myEx.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {myEx.map((e) => (
                    <span key={e.id} className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] ${e.kind === 'flag' && e.status === 'open' ? 'border-red-400/40 bg-red-400/10 text-red-200' : e.kind === 'extra' ? 'border-emerald-400/35 bg-emerald-400/[0.07] text-emerald-200' : 'border-white/[0.12] text-white/60'}`}>
                      {e.kind === 'flag' ? 'Flagged' : e.kind === 'extra' ? 'Extra' : 'Blocked'} {fmtDate(e.exception_date)}{e.start_minutes != null ? ` ${hhmm(e.start_minutes)}–${hhmm(e.end_minutes!)}` : ''}{e.status === 'resolved' && e.kind === 'flag' ? ' · sorted' : ''}
                      <ActionButton tone="quiet" className="!px-1 !py-0 !text-[11px]" body={{ action: 'exception.remove', id: e.id }}>✕</ActionButton>
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <ActionForm action="exception.add" extra={{ coachId: c.id, kind: 'extra' }} submitLabel="Add extra hours" className="!space-y-1.5">
                  <span className="text-[11px] text-white/45">One-off extra hours, on sale straight away</span>
                  <div className="grid grid-cols-4 gap-1">
                    <input name="date" type="date" className={inputCls + ' !py-1 !text-[11px]'} />
                    <select name="venueId" className={inputCls + ' !py-1 !text-[11px]'}>{venues.filter((v) => v.is_active).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select>
                    <input name="start" placeholder="10:00" className={inputCls + ' !py-1 !text-[11px]'} />
                    <input name="end" placeholder="12:00" className={inputCls + ' !py-1 !text-[11px]'} />
                  </div>
                </ActionForm>
                <ActionForm action="exception.add" extra={{ coachId: c.id, kind: 'flag' }} submitLabel="Flag a day" className="!space-y-1.5">
                  <span className="text-[11px] text-white/45">Can&apos;t make it · lands on Needs attention as a cover problem</span>
                  <div className="grid grid-cols-4 gap-1">
                    <input name="date" type="date" className={inputCls + ' !py-1 !text-[11px]'} />
                    <input name="start" placeholder="all day" className={inputCls + ' !py-1 !text-[11px]'} />
                    <input name="end" placeholder="" className={inputCls + ' !py-1 !text-[11px]'} />
                    <input name="note" placeholder="reason" className={inputCls + ' !py-1 !text-[11px]'} />
                  </div>
                </ActionForm>
              </div>
            </div>
          )
        })}
      </section>
    </div>
  )
}
