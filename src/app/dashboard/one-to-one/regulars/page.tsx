import { requireAdmin, getCoaches, getVenues, getSlots, getSettings, DAY, hhmm, gbp } from '@/lib/one-to-one/db'
import { todayLondon } from '@/lib/one-to-one/time'
import { ActionButton, ActionForm, Disclosure, Field, inputCls } from '../ui'

export const dynamic = 'force-dynamic'

// Regulars — the protected thing. A slot is theirs until they give it up.
export default async function RegularsPage() {
  const { admin, orgId } = await requireAdmin()
  const [coaches, venues, slots, settings] = await Promise.all([getCoaches(admin, orgId), getVenues(admin, orgId), getSlots(admin, orgId), getSettings(admin, orgId)])
  const thisMonth = todayLondon().slice(0, 7) + '-01'
  const { data: chargeRows } = await admin.from('coaching_charges').select('parent_id, status, amount_pence, attempt_count').eq('organisation_id', orgId).eq('billing_month', thisMonth)
  const chargeFor = (parentId: string) => (chargeRows ?? []).find((c) => c.parent_id === parentId)
  const { data: players } = await admin.from('players_active').select('id, first_name, last_name, parent:profiles!players_parent_id_fkey(full_name)').eq('organisation_id', orgId).order('first_name')
  const cname = (id: string) => coaches.find((c) => c.id === id)?.full_name?.split(' ')[0] || 'Coach'
  const vname = (id: string) => venues.find((v) => v.id === id)?.name || ''
  const order = { active: 0, pending: 1, paused: 2, released: 3 }
  const sorted = [...slots].sort((a, b) => order[a.status] - order[b.status] || a.weekday - b.weekday || a.start_minutes - b.start_minutes)
  const twoToOne = slots.filter((s) => s.session_type === 'two_to_one' && s.status !== 'released')

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/[0.08] bg-[#0f1a2b] p-4">
        <h3 className="text-sm font-semibold text-white">Add a regular</h3>
        {venues.length === 0 || coaches.length === 0 ? (
          <p className="mt-2 text-xs text-white/55">Add a venue and a coach first, under Coaches &amp; venues.</p>
        ) : (
          <ActionForm action="slot.create" submitLabel="Create slot" className="mt-3">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Field label="Child" className="col-span-2">
                <select name="playerId" required className={inputCls}>
                  <option value="">Pick a child</option>
                  {(players || []).map((p) => {
                    const parent = p.parent as unknown as { full_name: string | null } | null
                    return <option key={p.id} value={p.id}>{p.first_name} {p.last_name}{parent?.full_name ? ` · ${parent.full_name}` : ''}</option>
                  })}
                </select>
              </Field>
              <Field label="Coach"><select name="coachId" className={inputCls}>{coaches.map((c) => <option key={c.id} value={c.id}>{c.full_name || c.email}</option>)}</select></Field>
              <Field label="Venue"><select name="venueId" className={inputCls}>{venues.filter((v) => v.is_active).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></Field>
              <Field label="Day"><select name="weekday" className={inputCls}>{[1, 2, 3, 4, 5, 6, 7].map((d) => <option key={d} value={d}>{DAY[d]}</option>)}</select></Field>
              <Field label="Time"><input name="start" placeholder="16:30" required className={inputCls} /></Field>
              <Field label="Type"><select name="sessionType" className={inputCls}><option value="one_to_one">1-to-1</option><option value="two_to_one">2-to-1</option></select></Field>
              <Field label="How often"><select name="frequency" className={inputCls}><option value="weekly">Weekly</option><option value="fortnightly">Fortnightly</option><option value="monthly">Monthly</option></select></Field>
              <Field label="Price per session, pence"><input name="pricePence" type="number" defaultValue={settings.one_to_one_price_pence} className={inputCls} /></Field>
              <Field label="Minutes"><input name="durationMinutes" type="number" defaultValue={settings.session_minutes} className={inputCls} /></Field>
              <Field label="Starts"><input name="startsOn" type="date" defaultValue={todayLondon()} className={inputCls} /></Field>
              <Field label="Note"><input name="note" placeholder="optional" className={inputCls} /></Field>
            </div>
            <p className="text-[11px] text-white/40">This month&apos;s sessions are created straight away and the parent is emailed a link to pay for them and save a card. From then on they&apos;re charged on the 1st.</p>
          </ActionForm>
        )}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-[#0f1a2b]">
        <table className="w-full min-w-[720px] text-xs">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-white/40">
              <th className="px-4 py-2">Keeper</th><th className="px-3 py-2">Slot</th><th className="px-3 py-2">Coach · venue</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Price</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">This month</th><th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && <tr><td colSpan={8} className="px-4 py-6 text-center text-white/45">No regulars yet.</td></tr>}
            {sorted.map((s) => (
              <tr key={s.id} className={`border-t border-white/[0.06] ${s.status === 'released' ? 'opacity-50' : ''}`}>
                <td className="px-4 py-2.5">
                  <div className="font-semibold text-white">{s.player ? `${s.player.first_name} ${s.player.last_name}` : 'Child'}</div>
                  <div className="text-[11px] text-white/45">{s.parent?.full_name || s.parent?.email || ''} · since {s.starts_on}</div>
                </td>
                <td className="px-3 py-2.5 text-white/80 tabular-nums">{DAY[s.weekday]} {hhmm(s.start_minutes)} · {s.frequency}</td>
                <td className="px-3 py-2.5 text-white/80">{cname(s.coach_id)} · {vname(s.venue_id)}</td>
                <td className="px-3 py-2.5 text-white/80">{s.session_type === 'two_to_one' ? `2-to-1${s.partner_slot_id ? ' · with ' + (slots.find((x) => x.id === s.partner_slot_id)?.player?.first_name || 'partner') : ' · waiting for partner'}` : '1-to-1'}</td>
                <td className="px-3 py-2.5 text-white/80 tabular-nums">{gbp(s.price_pence)}</td>
                <td className="px-3 py-2.5"><span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${s.status === 'active' ? 'border-emerald-400/35 text-emerald-300' : s.status === 'paused' ? 'border-amber-400/35 text-amber-300' : s.status === 'pending' ? 'border-[#4ecde6]/35 text-[#4ecde6]' : 'border-white/20 text-white/50'}`}>{s.status}</span></td>
                <td className="px-3 py-2.5">
                  {(() => { const c = chargeFor(s.parent_id); if (!c) return <span className="text-[11px] text-white/35">—</span>
                    const cls = c.status === 'paid_online' || c.status === 'paid_cash' ? 'border-emerald-400/35 text-emerald-300' : c.status === 'failed' ? 'border-red-400/35 text-red-300' : c.status === 'waived' ? 'border-white/20 text-white/50' : 'border-amber-400/35 text-amber-300'
                    const label = c.status === 'paid_online' ? `Paid ${gbp(c.amount_pence)}` : c.status === 'paid_cash' ? `Cash ${gbp(c.amount_pence)}` : c.status === 'failed' ? `Failed ×${c.attempt_count}` : c.status === 'waived' ? 'Credit' : c.status === 'refunded' ? 'Refunded' : `Due ${gbp(c.amount_pence)}`
                    return <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{label}</span> })()}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap justify-end gap-1">
                    {s.status === 'pending' && <ActionButton tone="primary" body={{ action: 'slot.setup_link', id: s.id }}>Resend link</ActionButton>}
                    {s.status === 'active' && <ActionButton body={{ action: 'slot.status', id: s.id, status: 'paused' }}>Pause</ActionButton>}
                    {s.status === 'paused' && <ActionButton tone="primary" body={{ action: 'slot.status', id: s.id, status: 'active' }}>Resume</ActionButton>}
                    {s.status !== 'released' && <ActionButton tone="danger" confirm="Release this slot? Their future sessions come off and the time goes on sale." body={{ action: 'slot.status', id: s.id, status: 'released' }}>Release</ActionButton>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {twoToOne.filter((s) => !s.partner_slot_id).length >= 2 && (
        <div className="rounded-2xl border border-white/[0.08] bg-[#0f1a2b] p-4">
          <h3 className="text-sm font-semibold text-white">Pair two keepers for a 2-to-1</h3>
          <Disclosure label="Choose a pair">
            <ActionForm action="slot.pair" submitLabel="Pair them">
              <div className="grid grid-cols-2 gap-2">
                {(['slotId', 'partnerSlotId'] as const).map((name) => (
                  <Field key={name} label={name === 'slotId' ? 'Keeper' : 'Partner'}>
                    <select name={name} className={inputCls}>{twoToOne.filter((s) => !s.partner_slot_id).map((s) => <option key={s.id} value={s.id}>{s.player?.first_name} · {DAY[s.weekday]} {hhmm(s.start_minutes)}</option>)}</select>
                  </Field>
                ))}
              </div>
              <p className="text-[11px] text-white/40">Pairing marks both as one 2-to-1. Move one of them onto the other&apos;s time first if they differ.</p>
            </ActionForm>
          </Disclosure>
        </div>
      )}
    </div>
  )
}
