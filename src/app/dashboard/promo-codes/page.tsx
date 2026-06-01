import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Card from '@/components/Card'
import StatusBadge from '@/components/StatusBadge'
import EmptyState from '@/components/EmptyState'
import type { UserRole } from '@/lib/types'
import PromoCodeManager from './PromoCodeManager'

export default async function PromoCodesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, organisation_id')
    .eq('id', user.id)
    .single()

  const role = (profile?.role || 'parent') as UserRole
  const orgId = profile?.organisation_id || ''

  // Only admins can access promo codes
  if (role !== 'admin') redirect('/dashboard')

  const { data: promoCodes } = await supabase
    .from('promo_codes')
    .select('*')
    .eq('organisation_id', orgId)
    .order('created_at', { ascending: false })

  const now = new Date().toISOString()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Promo Codes</h1>

      {/* Honesty banner: codes can be CREATED here but the checkout flow
         doesn't read them yet, so a parent typing the code at signup won't
         see any discount applied. This prevents an admin from configuring
         a code, thinking it works, and being surprised when parents are
         charged full price. Remove this banner when the checkout
         integration ships. */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
        <strong className="font-semibold">Beta — not yet wired into checkout.</strong>{' '}
        You can create and manage codes here, but parents typing them at
        checkout won't see a discount applied yet. Use the per-class
        sibling discount and the cancel-flow 50% retention offer for now —
        both apply through Stripe correctly.
      </div>

      <PromoCodeManager orgId={orgId} />

      <Card title="All Promo Codes">
        {!promoCodes || promoCodes.length === 0 ? (
          <EmptyState message="No promo codes yet. Create one above." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-text-light">
                  <th className="pb-3 font-medium">Code</th>
                  <th className="pb-3 font-medium">Description</th>
                  <th className="pb-3 font-medium">Discount</th>
                  <th className="pb-3 font-medium">Applies To</th>
                  <th className="pb-3 font-medium">Usage</th>
                  <th className="pb-3 font-medium">Valid</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {promoCodes.map((code) => {
                  const isExpired = code.valid_until && code.valid_until < now
                  const isNotStarted = code.valid_from && code.valid_from > now
                  const isMaxedOut = code.max_uses && code.current_uses >= code.max_uses
                  const status = !code.active
                    ? 'inactive'
                    : isExpired
                      ? 'expired'
                      : isNotStarted
                        ? 'pending'
                        : isMaxedOut
                          ? 'maxed'
                          : 'active'

                  return (
                    <tr key={code.id} className="text-sm">
                      <td className="py-3 pr-4">
                        <code className="bg-surface-dark px-2 py-1 rounded text-xs font-mono font-semibold">
                          {code.code}
                        </code>
                      </td>
                      <td className="py-3 pr-4 text-text-light max-w-[200px] truncate">
                        {code.description || '—'}
                      </td>
                      <td className="py-3 pr-4">
                        {code.discount_type === 'percentage'
                          ? `${code.discount_value}%`
                          : `$${(code.discount_value / 100).toFixed(2)}`}
                      </td>
                      <td className="py-3 pr-4 capitalize">{code.applies_to}</td>
                      <td className="py-3 pr-4">
                        {code.current_uses}
                        {code.max_uses ? ` / ${code.max_uses}` : ''}
                      </td>
                      <td className="py-3 pr-4 text-text-light text-xs">
                        {code.valid_from
                          ? new Date(code.valid_from).toLocaleDateString()
                          : '—'}
                        {' – '}
                        {code.valid_until
                          ? new Date(code.valid_until).toLocaleDateString()
                          : '∞'}
                      </td>
                      <td className="py-3 pr-4">
                        <StatusBadge status={status} />
                      </td>
                      <td className="py-3">
                        <PromoCodeManager
                          orgId={orgId}
                          toggleCodeId={code.id}
                          toggleCodeActive={code.active}
                          codeString={code.code}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
