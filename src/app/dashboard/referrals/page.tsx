import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Card from '@/components/Card'
import StatusBadge from '@/components/StatusBadge'
import EmptyState from '@/components/EmptyState'
import type { UserRole } from '@/lib/types'
import ReferralLink from './ReferralLink'

export default async function ReferralsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, organisation_id, referral_code')
    .eq('id', user.id)
    .single()

  const role = (profile?.role || 'parent') as UserRole
  const orgId = profile?.organisation_id || ''

  // Get org slug for building referral link
  const { data: org } = await supabase
    .from('organisations')
    .select('slug')
    .eq('id', orgId)
    .single()

  const orgSlug = org?.slug || ''

  if (role === 'parent') {
    // Parent view: their own referrals
    const { data: referrals } = await supabase
      .from('referrals')
      .select('*')
      .eq('referrer_id', user.id)
      .order('created_at', { ascending: false })

    const totalReferrals = referrals?.length || 0
    const successfulSignups = referrals?.filter((r) => r.status === 'signed_up' || r.status === 'rewarded').length || 0
    const totalRewards = referrals?.filter((r) => r.status === 'rewarded').reduce((sum, r) => sum + (r.reward_amount || 0), 0) || 0

    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Referrals</h1>

        {/* Referral link */}
        <ReferralLink
          orgSlug={orgSlug}
          referralCode={profile?.referral_code || ''}
        />

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <p className="text-sm text-text-light">Total Referrals</p>
            <p className="text-2xl font-bold mt-1">{totalReferrals}</p>
          </Card>
          <Card>
            <p className="text-sm text-text-light">Successful Signups</p>
            <p className="text-2xl font-bold mt-1">{successfulSignups}</p>
          </Card>
          <Card>
            <p className="text-sm text-text-light">Rewards Earned</p>
            <p className="text-2xl font-bold mt-1">${(totalRewards / 100).toFixed(2)}</p>
          </Card>
        </div>

        {/* Referral list */}
        <Card title="Your Referrals">
          {!referrals || referrals.length === 0 ? (
            <EmptyState message="No referrals yet. Share your link to get started!" />
          ) : (
            <div className="divide-y divide-border">
              {referrals.map((referral) => (
                <div key={referral.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      Referral #{referral.referral_code}
                    </p>
                    <p className="text-xs text-text-light">
                      {new Date(referral.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {referral.reward_amount && referral.status === 'rewarded' && (
                      <span className="text-sm font-medium text-primary">
                        +${(referral.reward_amount / 100).toFixed(2)}
                      </span>
                    )}
                    <StatusBadge status={referral.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    )
  }

  // Admin view: see all referrals and manage rewards
  const { data: allReferrals } = await supabase
    .from('referrals')
    .select('*, referrer:profiles!referrals_referrer_id_fkey(full_name, email)')
    .eq('organisation_id', orgId)
    .order('created_at', { ascending: false })

  const totalReferrals = allReferrals?.length || 0
  const pendingCount = allReferrals?.filter((r) => r.status === 'signed_up').length || 0
  const rewardedCount = allReferrals?.filter((r) => r.status === 'rewarded').length || 0
  const totalPaidOut = allReferrals?.filter((r) => r.status === 'rewarded').reduce((sum, r) => sum + (r.reward_amount || 0), 0) || 0

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Referrals</h1>

      {/* Admin stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <p className="text-sm text-text-light">Total Referrals</p>
          <p className="text-2xl font-bold mt-1">{totalReferrals}</p>
        </Card>
        <Card>
          <p className="text-sm text-text-light">Awaiting Reward</p>
          <p className="text-2xl font-bold mt-1 text-warning">{pendingCount}</p>
        </Card>
        <Card>
          <p className="text-sm text-text-light">Rewarded</p>
          <p className="text-2xl font-bold mt-1 text-primary">{rewardedCount}</p>
        </Card>
        <Card>
          <p className="text-sm text-text-light">Total Paid Out</p>
          <p className="text-2xl font-bold mt-1">${(totalPaidOut / 100).toFixed(2)}</p>
        </Card>
      </div>

      {/* All referrals table */}
      <Card title="All Referrals">
        {!allReferrals || allReferrals.length === 0 ? (
          <EmptyState message="No referrals yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-text-light">
                  <th className="pb-3 font-medium">Referrer</th>
                  <th className="pb-3 font-medium">Code</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Reward</th>
                  <th className="pb-3 font-medium">Date</th>
                  <th className="pb-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {allReferrals.map((referral) => (
                  <tr key={referral.id}>
                    <td className="py-3 pr-4">
                      <p className="font-medium">{referral.referrer?.full_name || '—'}</p>
                      <p className="text-xs text-text-light">{referral.referrer?.email || ''}</p>
                    </td>
                    <td className="py-3 pr-4">
                      <code className="bg-surface-dark px-2 py-0.5 rounded text-xs font-mono">
                        {referral.referral_code}
                      </code>
                    </td>
                    <td className="py-3 pr-4">
                      <StatusBadge status={referral.status} />
                    </td>
                    <td className="py-3 pr-4">
                      {referral.reward_amount
                        ? `$${(referral.reward_amount / 100).toFixed(2)}`
                        : '—'}
                    </td>
                    <td className="py-3 pr-4 text-text-light text-xs">
                      {new Date(referral.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3">
                      <ReferralLink
                        approveReferralId={
                          referral.status === 'signed_up' ? referral.id : undefined
                        }
                        orgId={orgId}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
