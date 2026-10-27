import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import Card from '@/components/Card'
import StatusBadge from '@/components/StatusBadge'
import EmptyState from '@/components/EmptyState'
import PromoCodeManager from '../promo-codes/PromoCodeManager'
import RemoveChildDiscount from './RemoveChildDiscount'
import { amountLabel, discountedPence, CHILD_DISCOUNT_GIVEN, CHILD_DISCOUNT_REMOVED, type ChildDiscountRecord } from '@/lib/discounts'

/**
 * Discounts (27 Oct 2026, John: "a discount like ClassForKids"). One page for every academy:
 * the discounts that apply on their own (sibling, pay quarterly), codes parents type in, and the
 * children the academy has given money off. Codes work on memberships, trials and camps.
 */

const WORKS_ON: Record<string, string> = { all: 'Everything', subscription: 'Memberships', trial: 'Trials', one_off: 'Camps' }
const LASTS: Record<string, string> = { once: 'First monthly payment', repeating_3: '3 monthly payments', repeating_6: '6 monthly payments', forever: 'For good' }
const CHILD_LASTS: Record<string, string> = { once: 'Next payment', repeating_3: '3 payments', repeating_6: '6 payments', forever: 'Until removed' }

export default async function DiscountsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')
  const { data: profile } = await supabase.from('profiles').select('role, organisation_id').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')
  const orgId = profile.organisation_id as string

  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const [{ data: org }, { data: promoCodes }, { data: given }, { data: removed }] = await Promise.all([
    admin.from('organisations').select('sibling_discount_enabled, sibling_discount_percent, quarterly_billing_enabled, quarterly_discount_percent').eq('id', orgId).single(),
    supabase.from('promo_codes').select('*').eq('organisation_id', orgId).order('created_at', { ascending: false }),
    admin.from('audit_log').select('id, created_at, details, user_id').eq('organisation_id', orgId).eq('action', CHILD_DISCOUNT_GIVEN).order('created_at', { ascending: false }).limit(500),
    admin.from('audit_log').select('details').eq('organisation_id', orgId).eq('action', CHILD_DISCOUNT_REMOVED).limit(1000),
  ])
  const removedIds = new Set(((removed ?? []) as { details: { given_audit_id?: string } }[]).map((r) => r.details?.given_audit_id))
  const live = ((given ?? []) as { id: string; created_at: string; details: ChildDiscountRecord; user_id: string | null }[]).filter((g) => !removedIds.has(g.id))
  const playerIds = [...new Set(live.map((g) => g.details.player_id))]
  const userIds = [...new Set(live.map((g) => g.user_id).filter(Boolean))] as string[]
  const [{ data: players }, { data: givers }] = await Promise.all([
    playerIds.length ? admin.from('players').select('id, first_name, last_name').in('id', playerIds) : Promise.resolve({ data: [] }),
    userIds.length ? admin.from('profiles').select('id, full_name').in('id', userIds) : Promise.resolve({ data: [] }),
  ])
  const nameOf = (id: string) => { const p = ((players ?? []) as { id: string; first_name: string; last_name: string | null }[]).find((x) => x.id === id); return p ? `${p.first_name} ${p.last_name ?? ''}`.trim() : 'A child' }
  const giverOf = (id: string | null) => (((givers ?? []) as { id: string; full_name: string | null }[]).find((x) => x.id === id)?.full_name || 'Academy').split(' ')[0]
  const today = new Date().toISOString().slice(0, 10)
  const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Discounts</h1>
        <p className="text-sm text-white/55 mt-1">Codes parents type in, discounts that apply on their own, and money off for one child.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Sibling discount">
          <p className="text-sm text-white/70">{org?.sibling_discount_enabled && Number(org?.sibling_discount_percent) > 0
            ? <><b className="text-white">On: {Number(org.sibling_discount_percent)}% off</b> a 2nd or 3rd child&apos;s membership, for booking-page sign-ups and invited families.</>
            : <>Off. Turn it on to take a % off a parent&apos;s 2nd and 3rd child automatically.</>}</p>
          <Link href="/dashboard/settings#sibling" className="inline-block mt-3 text-sm underline text-cyan-300">Change in Settings</Link>
        </Card>
        <Card title="Pay quarterly">
          <p className="text-sm text-white/70">{org?.quarterly_billing_enabled !== false
            ? <><b className="text-white">On: {Number(org?.quarterly_discount_percent ?? 10)}% off</b> for paying 3 months at once.</>
            : <>Off. Parents can only pay monthly.</>}</p>
          <Link href="/dashboard/settings#quarterly" className="inline-block mt-3 text-sm underline text-cyan-300">Change in Settings</Link>
        </Card>
      </div>

      <PromoCodeManager orgId={orgId} />

      <Card title="Codes">
        {!promoCodes || promoCodes.length === 0 ? (
          <EmptyState message="No codes yet. Press “New code” to make one." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[#1d2c42] text-left text-[#93a2ba]">
                <th className="pb-3 font-medium">Code</th><th className="pb-3 font-medium">Discount</th><th className="pb-3 font-medium">Works on</th>
                <th className="pb-3 font-medium">Lasts</th><th className="pb-3 font-medium">Used</th><th className="pb-3 font-medium">Until</th>
                <th className="pb-3 font-medium">Status</th><th className="pb-3 font-medium"></th>
              </tr></thead>
              <tbody className="divide-y divide-border">
                {promoCodes.map((code) => {
                  const status = !code.active ? 'inactive' : code.valid_until && code.valid_until < today ? 'expired'
                    : code.valid_from && code.valid_from > today ? 'pending' : code.max_uses && code.current_uses >= code.max_uses ? 'maxed' : 'active'
                  return (
                    <tr key={code.id}>
                      <td className="py-3 pr-4"><code className="bg-[#142236] px-2 py-1 rounded text-xs font-mono font-semibold text-cyan-300">{code.code}</code>{code.description ? <div className="text-xs text-white/45 mt-1">{code.description}</div> : null}</td>
                      <td className="py-3 pr-4">{amountLabel({ type: code.discount_type, value: Number(code.discount_value) })}</td>
                      <td className="py-3 pr-4">{WORKS_ON[code.applies_to] ?? code.applies_to}</td>
                      <td className="py-3 pr-4">{code.applies_to === 'all' || code.applies_to === 'subscription' ? LASTS[code.discount_duration ?? 'once'] : '—'}</td>
                      <td className="py-3 pr-4 tabular-nums">{code.current_uses ?? 0}{code.max_uses ? ` / ${code.max_uses}` : ''}</td>
                      <td className="py-3 pr-4 text-white/60">{code.valid_until ? day(code.valid_until) : '—'}</td>
                      <td className="py-3 pr-4"><StatusBadge status={status} /></td>
                      <td className="py-3"><PromoCodeManager orgId={orgId} toggleCodeId={code.id} toggleCodeActive={code.active} codeString={code.code} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Children with a discount">
        {live.length === 0 ? (
          <EmptyState message="None yet. Open a child's page and press “Give a discount”." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[#1d2c42] text-left text-[#93a2ba]">
                <th className="pb-3 font-medium">Child</th><th className="pb-3 font-medium">Discount</th><th className="pb-3 font-medium">On</th>
                <th className="pb-3 font-medium">Lasts</th><th className="pb-3 font-medium">Given by</th><th className="pb-3 font-medium"></th>
              </tr></thead>
              <tbody className="divide-y divide-border">
                {live.map((g) => {
                  const d = g.details
                  const after = (discountedPence(Math.round(d.plan_amount * 100), d) / 100).toFixed(2)
                  return (
                    <tr key={g.id}>
                      <td className="py-3 pr-4"><Link href={`/dashboard/players/${d.player_id}`} className="font-semibold text-white hover:underline">{nameOf(d.player_id)}</Link>{d.reason ? <div className="text-xs text-white/45 mt-1">{d.reason}</div> : null}</td>
                      <td className="py-3 pr-4">{amountLabel(d)}</td>
                      <td className="py-3 pr-4">{d.plan_name} £{d.plan_amount.toFixed(2)} → <b className="text-white">£{after}</b></td>
                      <td className="py-3 pr-4">{CHILD_LASTS[d.duration]}</td>
                      <td className="py-3 pr-4 text-white/60">{giverOf(g.user_id)}, {day(g.created_at)}</td>
                      <td className="py-3"><RemoveChildDiscount auditId={g.id} childName={nameOf(d.player_id)} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-white/40 mt-3">1-2-1 discounts are credit on the family&apos;s account: 1-2-1s → the family → Add credit.</p>
      </Card>
    </div>
  )
}
