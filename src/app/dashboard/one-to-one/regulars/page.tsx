import SlotTypeFields from './SlotTypeFields'
import { requireAdmin, getCoaches, getVenues, getSlots, getSettings, DAY, hhmm, gbp, fmtShort, type SlotRowDb } from '@/lib/one-to-one/db'
import { todayLondon } from '@/lib/one-to-one/time'
import { academyPaymentsReady } from '@/lib/one-to-one/checkout'
import { ActionButton, ActionForm, Disclosure, Field, PoundsInput, SignedPoundsInput } from '../ui'
import { inputCls } from '../styles'

export const dynamic = 'force-dynamic'

// Regulars — the protected thing. A slot is theirs until they give it up.
const DAY_LONG: Record<number, string> = { 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday', 7: 'Sunday' }
const STATUS: Record<SlotRowDb['status'], { label: string; cls: string }> = {
  active: { label: 'active', cls: 'bg-[#67c79a]/15 text-[#8fdcb6]' },
  pending: { label: 'awaiting payment', cls: 'bg-[#4ecde6]/15 text-[#4ecde6]' },
  paused: { label: 'paused', cls: 'bg-[#d8a95a]/15 text-[#ecc98a]' },
  released: { label: 'released', cls: 'bg-white/10 text-[#93a2ba]' },
}

export default async function RegularsPage() {
  const { admin, orgId } = await requireAdmin()
  const [coaches, venues, slots, settings] = await Promise.all([getCoaches(admin, orgId), getVenues(admin, orgId), getSlots(admin, orgId), getSettings(admin, orgId)])
  const ready = await academyPaymentsReady(orgId)
  const thisMonth = todayLondon().slice(0, 7) + '-01'
  const { data: chargeRows } = await admin.from('coaching_charges').select('parent_id, status, amount_pence, attempt_count').eq('organisation_id', orgId).eq('billing_month', thisMonth)
  const chargeFor = (parentId: string) => (chargeRows ?? []).find((c) => c.parent_id === parentId)
  // Credit on account per family: the sum of their ledger. Shown on every row, entered from any row.
  const { data: creditRows } = await admin.from('coaching_credits').select('parent_id, amount_pence').eq('organisation_id', orgId)
  const creditOf = (parentId: string) => (creditRows ?? []).filter((c) => c.parent_id === parentId).reduce((a, c) => a + c.amount_pence, 0)
  const { data: players } = await admin.from('players_active').select('id, first_name, last_name, parent:profiles!players_parent_id_fkey(full_name)').eq('organisation_id', orgId).order('first_name')
  const cname = (id: string) => coaches.find((c) => c.id === id)?.full_name?.split(' ')[0] || 'Coach'
  const vname = (id: string) => venues.find((v) => v.id === id)?.name || ''
  const order = { active: 0, pending: 1, paused: 2, released: 3 }
  const sorted = [...slots].sort((a, b) => order[a.status] - order[b.status] || a.weekday - b.weekday || a.start_minutes - b.start_minutes)
  const live = sorted.filter((s) => s.status !== 'released')
  const twoToOne = slots.filter((s) => s.session_type === 'two_to_one' && s.status !== 'released')
  const released = sorted.filter((s) => s.status === 'released')
  const counts = { active: live.filter((s) => s.status === 'active').length, pending: live.filter((s) => s.status === 'pending').length, paused: live.filter((s) => s.status === 'paused').length }
  // One card per session: a 2-to-1 pair sits together, everyone else stands alone. Then by day and time.
  const seen = new Set<string>()
  const blocks: SlotRowDb[][] = []
  for (const s of [...live].sort((a, b) => a.weekday - b.weekday || a.start_minutes - b.start_minutes || cname(a.coach_id).localeCompare(cname(b.coach_id)) || a.starts_on.localeCompare(b.starts_on) || (a.pair_seat ?? 0) - (b.pair_seat ?? 0))) {
    if (seen.has(s.id)) continue
    const partner = s.partner_slot_id ? live.find((x) => x.id === s.partner_slot_id) : undefined
    const block = partner && !seen.has(partner.id) ? [s, partner].sort((a, b) => (a.pair_seat ?? 0) - (b.pair_seat ?? 0)) : [s]
    block.forEach((x) => seen.add(x.id))
    blocks.push(block)
  }
  const days = [1, 2, 3, 4, 5, 6, 7].map((d) => [d, blocks.filter((b) => b[0].weekday === d)] as const).filter(([, b]) => b.length > 0)
  const weekly = live.filter((s) => s.status === 'active').reduce((a, s) => a + (s.frequency === 'weekly' ? s.price_pence : s.frequency === 'fortnightly' ? s.price_pence / 2 : s.price_pence / 4.33), 0)

  const money = (parentId: string) => {
    const c = chargeFor(parentId); if (!c) return null
    const ok = c.status === 'paid_online' || c.status === 'paid_cash'
    const cls = ok ? 'bg-[#67c79a]/15 text-[#8fdcb6]' : c.status === 'failed' ? 'bg-[#e0736d]/15 text-[#f3a7a2]' : c.status === 'waived' || c.status === 'refunded' ? 'bg-white/10 text-[#93a2ba]' : 'bg-[#d8a95a]/15 text-[#ecc98a]'
    const label = c.status === 'paid_online' ? `Paid ${gbp(c.amount_pence)}` : c.status === 'paid_cash' ? `Cash ${gbp(c.amount_pence)}` : c.status === 'failed' ? `Card failed ×${c.attempt_count}` : c.status === 'waived' ? 'Covered by credit' : c.status === 'refunded' ? 'Refunded' : `Due ${gbp(c.amount_pence)}`
    return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{label}</span>
  }
  // A pending slot at an academy with no Stripe has had NO link sent. Say that, not "awaiting payment".
  const chip = (s: SlotRowDb) => s.status === 'pending' && !ready
    ? { label: 'pay link not sent', cls: 'bg-[#d8a95a]/15 text-[#ecc98a]' }
    : STATUS[s.status]
  const creditCell = (s: SlotRowDb) => {
    const bal = creditOf(s.parent_id)
    return (
      <div className="flex flex-col items-start gap-1">
        {bal !== 0 && <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${bal > 0 ? 'bg-[#67c79a]/15 text-[#8fdcb6]' : 'bg-[#e0736d]/15 text-[#f3a7a2]'}`}>{bal > 0 ? `${gbp(bal)} credit` : `owes ${gbp(-bal)}`}</span>}
        {s.status !== 'released' && (
          <Disclosure label={bal === 0 ? 'Add credit' : 'Adjust'}>
            <ActionForm action="credit.add" submitLabel="Save credit" extra={{ parentId: s.parent_id }} className="mt-2 w-64 rounded-xl border border-[#1d2c42] bg-[#0f1a2b] p-3">
              <p className="text-[11px] leading-relaxed text-[#93a2ba]">What this family has already paid you. It comes off their pay link and their 1st-of-month charges until it is used up. Enter a minus amount to record money they owe.</p>
              <Field label="Amount"><SignedPoundsInput name="amountPence" /></Field>
              <Field label="What for"><input name="note" required placeholder="block of 10 paid in September" className={inputCls} /></Field>
            </ActionForm>
          </Disclosure>
        )}
      </div>
    )
  }
  // The one action that moves things on, shown on the row. Everything else sits under "More".
  const primary = (s: SlotRowDb) => s.status === 'pending'
    ? <ActionButton tone="primary" body={{ action: 'slot.setup_link', id: s.id }}>Resend link</ActionButton>
    : s.status === 'paused' ? <ActionButton tone="primary" body={{ action: 'slot.status', id: s.id, status: 'active' }}>Resume</ActionButton>
    : null
  const others = (s: SlotRowDb) => (
    <div className="flex flex-wrap gap-1">
      {s.status === 'active' && <ActionButton body={{ action: 'slot.status', id: s.id, status: 'paused' }}>Pause</ActionButton>}
      {s.status !== 'released' && <ActionButton tone="quiet" confirm="Release this slot? Their future sessions come off and the time goes on sale." body={{ action: 'slot.status', id: s.id, status: 'released' }}>Release</ActionButton>}
      {s.status !== 'released' && <ActionButton tone="danger" confirm="Delete this slot completely? Only for one added by mistake: it works while nothing has been paid or coached, and any pay link sent stops working." body={{ action: 'slot.delete', id: s.id }}>Delete</ActionButton>}
    </div>
  )
  const editForm = (s: SlotRowDb) => s.status === 'released' ? null : (
    <Disclosure label="Edit">
      <ActionForm action="slot.update" extra={{ id: s.id }} submitLabel="Save changes" className="w-full max-w-md rounded-xl border border-[#1d2c42] bg-[#080e18] p-3 text-left">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Coach"><select name="coachId" defaultValue={s.coach_id} className={inputCls}>{coaches.map((c) => <option key={c.id} value={c.id}>{c.full_name || c.email}</option>)}</select></Field>
          <Field label="Venue"><select name="venueId" defaultValue={s.venue_id} className={inputCls}>{venues.filter((v) => v.is_active || v.id === s.venue_id).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></Field>
          <Field label="Day"><select name="weekday" defaultValue={s.weekday} className={inputCls}>{[1, 2, 3, 4, 5, 6, 7].map((d) => <option key={d} value={d}>{DAY[d]}</option>)}</select></Field>
          <Field label="Start time"><input name="start" defaultValue={hhmm(s.start_minutes)} required className={inputCls + ' tabular-nums'} /></Field>
          <Field label="Length, minutes"><input name="durationMinutes" type="number" defaultValue={s.duration_minutes} className={inputCls + ' tabular-nums'} /></Field>
          {s.status === 'pending'
            ? <input type="hidden" name="pricePence" value={s.price_pence} />
            : <Field label="Price per session"><PoundsInput name="pricePence" defaultPence={s.price_pence} /></Field>}
        </div>
        <p className="text-[11px] leading-relaxed text-[#93a2ba]">Their sessions from today move with the slot. Anything already paid stays paid; a new price applies to sessions not yet paid for.{s.status === 'pending' ? ' The price can\'t change until the set-up link is paid: Delete and add again instead.' : ''}{s.partner_slot_id ? ' In a 2-to-1 pair the coach, day and time stay with the partner.' : ''}</p>
      </ActionForm>
    </Disclosure>
  )

  const form = (
    <ActionForm action="slot.create" submitLabel="Create and email the pay link" className="mt-4">
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
        <Field label="Coach"><select name="coachId" required defaultValue="" className={inputCls}><option value="">Choose a coach</option>{coaches.map((c) => <option key={c.id} value={c.id}>{c.full_name || c.email}</option>)}</select></Field>
        <Field label="Venue"><select name="venueId" className={inputCls}>{venues.filter((v) => v.is_active).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></Field>
        <Field label="Day"><select name="weekday" className={inputCls}>{[1, 2, 3, 4, 5, 6, 7].map((d) => <option key={d} value={d}>{DAY[d]}</option>)}</select></Field>
        <Field label="Start time"><input name="start" placeholder="16:30" required className={inputCls + ' tabular-nums'} /></Field>
        <SlotTypeFields
          players={(players || []).map((p) => { const parent = p.parent as unknown as { full_name: string | null } | null; return { id: p.id as string, label: `${p.first_name} ${p.last_name}${parent?.full_name ? ` · ${parent.full_name}` : ''}` } })}
          oneToOnePence={settings.one_to_one_price_pence} twoToOnePence={settings.two_to_one_price_pence}
        />
        <Field label="How often"><select name="frequency" className={inputCls}><option value="weekly">Every week</option><option value="fortnightly">Every fortnight</option><option value="monthly">Once a month</option></select></Field>
        <Field label="Length, minutes"><input name="durationMinutes" type="number" defaultValue={settings.session_minutes} className={inputCls + ' tabular-nums'} /></Field>
        <Field label="First session on or after"><input name="startsOn" type="date" defaultValue={todayLondon()} className={inputCls} /></Field>
        <Field label="Note for you"><input name="note" placeholder="optional" className={inputCls} /></Field>
      </div>
      <p className="text-[11px] leading-relaxed text-[#93a2ba]">The rest of this month&apos;s sessions are created straight away. The parent is emailed a link to pay for them and save a card. From then on the card is charged on the 1st.</p>
    </ActionForm>
  )

  return (
    <div className="space-y-4">
      <section className="rounded-[15px] border border-[#1d2c42] bg-[#0f1a2b] p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-white">{live.length === 0 ? 'Add your first regular' : 'Add a regular'}</h3>
          {live.length > 0 && <span className="text-xs text-[#93a2ba]">{live.filter((s) => s.status === 'active').length} active · about {gbp(Math.round(weekly))} a week</span>}
        </div>
        {venues.length === 0 || coaches.length === 0 ? (
          <p className="mt-2 text-xs text-[#93a2ba]">Add a venue and a coach first, under Coaches &amp; venues.</p>
        ) : (players || []).length === 0 ? (
          <p className="mt-2 text-xs text-[#93a2ba]">A slot belongs to a child, so add your keepers first. Players, then Import or Quick Add. Each one needs a parent&apos;s email, because that&apos;s where the pay link goes.</p>
        ) : live.length === 0 ? form : <div className="mt-2"><Disclosure label="Give a child a slot">{form}</Disclosure></div>}
      </section>

      {sorted.length === 0 ? (
        <div className="rounded-[15px] border border-dashed border-[#293b58] p-8 text-center text-sm text-[#93a2ba]">No regulars yet.</div>
      ) : (
        <>
          <p className="text-sm text-[#93a2ba]" data-testid="regulars-headline">
            <b className="font-semibold text-white">{live.length} {live.length === 1 ? 'regular' : 'regulars'}</b>
            {counts.active > 0 && <> · <span className="text-[#67c79a]">{counts.active} set up and paying</span></>}
            {counts.pending > 0 && <> · <span className="text-[#d8a95a]">{counts.pending} {ready ? 'awaiting payment' : 'not sent a pay link'}</span></>}
            {counts.paused > 0 && <> · {counts.paused} paused</>}
          </p>

          <div className="space-y-5" data-testid="regulars-list">
            {days.map(([weekday, dayBlocks]) => (
              <section key={weekday}>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#5b6c86]">{DAY_LONG[weekday] || DAY[weekday]}</h3>
                <div className="space-y-2.5">
                  {dayBlocks.map((block) => {
                    const first = block[0]
                    const pair = first.session_type === 'two_to_one'
                    return (
                      <article key={first.id} className="overflow-hidden rounded-[15px] border border-[#1d2c42] bg-[#0f1a2b]" data-testid="regular-block">
                        <header className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-[#1d2c42] px-4 py-3 sm:px-5">
                          <span className="text-lg font-bold tabular-nums text-white">{hhmm(first.start_minutes)}</span>
                          <span className="min-w-0 flex-1 text-sm text-[#93a2ba]">
                            <b className="font-semibold text-white">{cname(first.coach_id)}</b> · {vname(first.venue_id)}
                            <span className="block text-xs text-[#5b6c86]">{first.frequency === 'weekly' ? 'Every week' : first.frequency === 'fortnightly' ? `Every fortnight, from ${fmtShort(first.starts_on)}` : 'Once a month'}</span>
                          </span>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${pair ? 'bg-[#4ecde6]/[0.12] text-[#4ecde6]' : 'bg-[#93a2ba]/[0.10] text-[#93a2ba]'}`}>{pair ? '2-to-1' : '1-to-1'}</span>
                          {pair && block.length < 2 && <span className="rounded-full bg-[#d8a95a]/[0.13] px-2.5 py-1 text-xs font-semibold text-[#d8a95a]">1 seat free</span>}
                        </header>
                        <ul className="divide-y divide-[#1d2c42]">
                          {block.map((s) => (
                            <li key={s.id} className="flex flex-col gap-2 px-4 py-3 sm:px-5 lg:flex-row lg:items-start lg:gap-4" data-testid="regular-row">
                              <div className="min-w-0 lg:w-56 lg:shrink-0">
                                <p className="truncate text-sm font-semibold text-white">{s.player ? `${s.player.first_name} ${s.player.last_name}` : 'Child'}</p>
                                <p className="truncate text-xs text-[#93a2ba]">{s.parent?.full_name || s.parent?.email || ''} · {gbp(s.price_pence)} a session</p>
                              </div>
                              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                                <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${chip(s).cls}`}>{chip(s).label}</span>
                                {money(s.parent_id)}
                                {creditOf(s.parent_id) !== 0 && <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${creditOf(s.parent_id) > 0 ? 'bg-[#67c79a]/15 text-[#8fdcb6]' : 'bg-[#e0736d]/15 text-[#f3a7a2]'}`}>{creditOf(s.parent_id) > 0 ? `${gbp(creditOf(s.parent_id))} credit` : `owes ${gbp(-creditOf(s.parent_id))}`}</span>}
                              </div>
                              <div className="flex flex-col items-start gap-1.5 lg:items-end">
                                {primary(s)}
                                <Disclosure label="More">
                                  <div className="flex flex-col items-start gap-3 rounded-xl border border-[#1d2c42] bg-[#080e18] p-3 lg:items-end">
                                    {others(s)}
                                    {editForm(s)}
                                    {creditCell(s)}
                                  </div>
                                </Disclosure>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </article>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>

          {released.length > 0 && (
            <details className="rounded-[15px] border border-[#1d2c42] bg-[#0f1a2b]" data-testid="regulars-released">
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-[#93a2ba] sm:px-5">Released slots ({released.length})</summary>
              <ul className="divide-y divide-[#1d2c42] border-t border-[#1d2c42]">
                {released.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-2.5 text-sm text-[#93a2ba] sm:px-5">
                    <span className="font-semibold text-white/80">{s.player ? `${s.player.first_name} ${s.player.last_name}` : 'Child'}</span>
                    <span className="tabular-nums">{DAY[s.weekday]} {hhmm(s.start_minutes)}</span>
                    <span>{cname(s.coach_id)} · {vname(s.venue_id)}</span>
                    <span className="text-xs text-[#5b6c86]">{s.session_type === 'two_to_one' ? '2-to-1' : '1-to-1'} · since {fmtShort(s.starts_on)}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}

      {twoToOne.filter((s) => !s.partner_slot_id).length >= 2 && (
        <section className="rounded-[15px] border border-[#1d2c42] bg-[#0f1a2b] p-5">
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
              <p className="text-[11px] text-[#5b6c86]">Easiest: give the second keeper a 2-to-1 slot with the same coach, day and time. They pair automatically. Use this only for two 2-to-1 keepers already on the same time.</p>
            </ActionForm>
          </Disclosure>
        </section>
      )}
    </div>
  )
}
