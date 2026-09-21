import { requireAdmin, getCoaches, getVenues, getSlots, getSettings, DAY, hhmm, gbp, fmtShort, type SlotRowDb } from '@/lib/one-to-one/db'
import { todayLondon } from '@/lib/one-to-one/time'
import { academyPaymentsReady } from '@/lib/one-to-one/checkout'
import { ActionButton, ActionForm, Disclosure, Field, PoundsInput, inputCls } from '../ui'

export const dynamic = 'force-dynamic'

// Regulars — the protected thing. A slot is theirs until they give it up.
const STATUS: Record<SlotRowDb['status'], { label: string; cls: string }> = {
  active: { label: 'active', cls: 'bg-[#67c79a]/15 text-[#8fdcb6]' },
  pending: { label: 'awaiting payment', cls: 'bg-[#4ecde6]/15 text-[#4ecde6]' },
  paused: { label: 'paused', cls: 'bg-[#d8a95a]/15 text-[#ecc98a]' },
  released: { label: 'released', cls: 'bg-white/10 text-white/50' },
}

export default async function RegularsPage() {
  const { admin, orgId } = await requireAdmin()
  const [coaches, venues, slots, settings] = await Promise.all([getCoaches(admin, orgId), getVenues(admin, orgId), getSlots(admin, orgId), getSettings(admin, orgId)])
  const ready = await academyPaymentsReady(orgId)
  const thisMonth = todayLondon().slice(0, 7) + '-01'
  const { data: chargeRows } = await admin.from('coaching_charges').select('parent_id, status, amount_pence, attempt_count').eq('organisation_id', orgId).eq('billing_month', thisMonth)
  const chargeFor = (parentId: string) => (chargeRows ?? []).find((c) => c.parent_id === parentId)
  const { data: players } = await admin.from('players_active').select('id, first_name, last_name, parent:profiles!players_parent_id_fkey(full_name)').eq('organisation_id', orgId).order('first_name')
  const cname = (id: string) => coaches.find((c) => c.id === id)?.full_name?.split(' ')[0] || 'Coach'
  const vname = (id: string) => venues.find((v) => v.id === id)?.name || ''
  const order = { active: 0, pending: 1, paused: 2, released: 3 }
  const sorted = [...slots].sort((a, b) => order[a.status] - order[b.status] || a.weekday - b.weekday || a.start_minutes - b.start_minutes)
  const live = sorted.filter((s) => s.status !== 'released')
  const twoToOne = slots.filter((s) => s.session_type === 'two_to_one' && s.status !== 'released')
  const weekly = live.filter((s) => s.status === 'active').reduce((a, s) => a + (s.frequency === 'weekly' ? s.price_pence : s.frequency === 'fortnightly' ? s.price_pence / 2 : s.price_pence / 4.33), 0)

  const money = (parentId: string) => {
    const c = chargeFor(parentId); if (!c) return null
    const ok = c.status === 'paid_online' || c.status === 'paid_cash'
    const cls = ok ? 'bg-[#67c79a]/15 text-[#8fdcb6]' : c.status === 'failed' ? 'bg-[#e0736d]/15 text-[#f3a7a2]' : c.status === 'waived' || c.status === 'refunded' ? 'bg-white/10 text-white/55' : 'bg-[#d8a95a]/15 text-[#ecc98a]'
    const label = c.status === 'paid_online' ? `Paid ${gbp(c.amount_pence)}` : c.status === 'paid_cash' ? `Cash ${gbp(c.amount_pence)}` : c.status === 'failed' ? `Card failed ×${c.attempt_count}` : c.status === 'waived' ? 'Covered by credit' : c.status === 'refunded' ? 'Refunded' : `Due ${gbp(c.amount_pence)}`
    return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{label}</span>
  }
  // A pending slot at an academy with no Stripe has had NO link sent. Say that, not "awaiting payment".
  const chip = (s: SlotRowDb) => s.status === 'pending' && !ready
    ? { label: 'pay link not sent', cls: 'bg-[#d8a95a]/15 text-[#ecc98a]' }
    : STATUS[s.status]
  const type = (s: SlotRowDb) => s.session_type === 'two_to_one' ? `2-to-1${s.partner_slot_id ? ' with ' + (slots.find((x) => x.id === s.partner_slot_id)?.player?.first_name || 'partner') : ' · needs a partner'}` : '1-to-1'
  const buttons = (s: SlotRowDb) => (
    <div className="flex flex-wrap gap-1">
      {s.status === 'pending' && <ActionButton tone="primary" body={{ action: 'slot.setup_link', id: s.id }}>Resend link</ActionButton>}
      {s.status === 'active' && <ActionButton body={{ action: 'slot.status', id: s.id, status: 'paused' }}>Pause</ActionButton>}
      {s.status === 'paused' && <ActionButton tone="primary" body={{ action: 'slot.status', id: s.id, status: 'active' }}>Resume</ActionButton>}
      {s.status !== 'released' && <ActionButton tone="quiet" confirm="Release this slot? Their future sessions come off and the time goes on sale." body={{ action: 'slot.status', id: s.id, status: 'released' }}>Release</ActionButton>}
    </div>
  )

  const form = (
    <ActionForm action="slot.create" submitLabel="Create the slot and email the parent" className="mt-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
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
        <Field label="Start time"><input name="start" placeholder="16:30" required className={inputCls + ' tabular-nums'} /></Field>
        <Field label="Type"><select name="sessionType" className={inputCls}><option value="one_to_one">1-to-1</option><option value="two_to_one">2-to-1</option></select></Field>
        <Field label="How often"><select name="frequency" className={inputCls}><option value="weekly">Every week</option><option value="fortnightly">Every fortnight</option><option value="monthly">Once a month</option></select></Field>
        <Field label="Price per session"><PoundsInput name="pricePence" defaultPence={settings.one_to_one_price_pence} /></Field>
        <Field label="Length, minutes"><input name="durationMinutes" type="number" defaultValue={settings.session_minutes} className={inputCls + ' tabular-nums'} /></Field>
        <Field label="First session on or after"><input name="startsOn" type="date" defaultValue={todayLondon()} className={inputCls} /></Field>
        <Field label="Note for you"><input name="note" placeholder="optional" className={inputCls} /></Field>
      </div>
      <p className="text-[11px] leading-relaxed text-white/45">The rest of this month&apos;s sessions are created straight away. The parent is emailed a link to pay for them and save a card. From then on the card is charged on the 1st.</p>
    </ActionForm>
  )

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-white/[0.08] bg-[#0f1a2b] p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-white">{live.length === 0 ? 'Add your first regular' : 'Add a regular'}</h3>
          {live.length > 0 && <span className="text-xs text-white/45">{live.filter((s) => s.status === 'active').length} active · about {gbp(Math.round(weekly))} a week</span>}
        </div>
        {venues.length === 0 || coaches.length === 0 ? (
          <p className="mt-2 text-xs text-white/55">Add a venue and a coach first, under Coaches &amp; venues.</p>
        ) : (players || []).length === 0 ? (
          <p className="mt-2 text-xs text-white/55">A slot belongs to a child, so add your keepers first. Players, then Import or Quick Add. Each one needs a parent&apos;s email, because that&apos;s where the pay link goes.</p>
        ) : live.length === 0 ? form : <div className="mt-2"><Disclosure label="Give a child a slot">{form}</Disclosure></div>}
      </section>

      {sorted.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/[0.15] p-8 text-center text-sm text-white/45">No regulars yet.</div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0f1a2b] lg:block">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/[0.06] text-left text-[10px] uppercase tracking-[0.08em] text-white/40">
                  <th className="px-5 py-3 font-semibold">Keeper</th><th className="px-3 py-3 font-semibold">Slot</th><th className="px-3 py-3 font-semibold">Coach and venue</th><th className="px-3 py-3 font-semibold">Type</th><th className="px-3 py-3 text-right font-semibold">Price</th><th className="px-3 py-3 font-semibold">Status</th><th className="px-3 py-3 font-semibold">This month</th><th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {sorted.map((s) => (
                  <tr key={s.id} className={s.status === 'released' ? 'opacity-45' : ''}>
                    <td className="px-5 py-3">
                      <div className="text-sm font-semibold text-white">{s.player ? `${s.player.first_name} ${s.player.last_name}` : 'Child'}</div>
                      <div className="text-[11px] text-white/40">{s.parent?.full_name || s.parent?.email || ''} · since {fmtShort(s.starts_on)}</div>
                    </td>
                    <td className="px-3 py-3"><span className="text-sm font-semibold tabular-nums text-white">{DAY[s.weekday]} {hhmm(s.start_minutes)}</span><div className="text-[11px] text-white/40">{s.frequency === 'weekly' ? 'every week' : s.frequency === 'fortnightly' ? 'every fortnight' : 'monthly'}</div></td>
                    <td className="px-3 py-3 text-white/75">{cname(s.coach_id)}<div className="text-[11px] text-white/40">{vname(s.venue_id)}</div></td>
                    <td className="px-3 py-3 text-white/75">{type(s)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-white/85">{gbp(s.price_pence)}</td>
                    <td className="px-3 py-3"><span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${chip(s).cls}`}>{chip(s).label}</span></td>
                    <td className="px-3 py-3">{money(s.parent_id) ?? <span className="text-white/25">—</span>}</td>
                    <td className="px-5 py-3"><div className="flex justify-end">{buttons(s)}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-2.5 lg:hidden">
            {sorted.map((s) => (
              <div key={s.id} className={`rounded-2xl border border-white/[0.08] bg-[#0f1a2b] p-4 ${s.status === 'released' ? 'opacity-45' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">{s.player ? `${s.player.first_name} ${s.player.last_name}` : 'Child'}</div>
                    <div className="truncate text-[11px] text-white/40">{s.parent?.full_name || s.parent?.email || ''}</div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${chip(s).cls}`}>{chip(s).label}</span>
                </div>
                <div className="mt-2 text-sm text-white/85"><b className="tabular-nums text-white">{DAY[s.weekday]} {hhmm(s.start_minutes)}</b> · {cname(s.coach_id)} · {vname(s.venue_id)}</div>
                <div className="mt-0.5 text-[11px] text-white/45">{type(s)} · {gbp(s.price_pence)} · {s.frequency} · since {fmtShort(s.starts_on)}</div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">{money(s.parent_id) ?? <span />}{buttons(s)}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {twoToOne.filter((s) => !s.partner_slot_id).length >= 2 && (
        <section className="rounded-2xl border border-white/[0.08] bg-[#0f1a2b] p-5">
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
        </section>
      )}
    </div>
  )
}
