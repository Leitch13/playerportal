import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { requireFeature } from '@/lib/features'
import StatusBadge from '@/components/StatusBadge'
import EmptyState from '@/components/EmptyState'
import type { UserRole } from '@/lib/types'
import ReferralLink from './ReferralLink'
import ReferAcademyCard from './ReferAcademyCard'

// Local, on-brand status chip for the parent referral list (does NOT touch the
// shared StatusBadge component, which other pages rely on).
function referralStatusChip(status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: 'Invited', cls: 'bg-white/[0.06] text-white/70 border-white/[0.12]' },
    signed_up: { label: 'Signed up', cls: 'bg-[#4ecde6]/10 text-[#4ecde6] border-[#4ecde6]/30' },
    rewarded: { label: 'Rewarded ✓', cls: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' },
  }
  const m = map[status] || { label: status, cls: 'bg-white/[0.06] text-white/70 border-white/[0.12]' }
  return <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${m.cls}`}>{m.label}</span>
}

export default async function ReferralsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')
  await requireFeature('referrals')

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
    .select('slug, name')
    .eq('id', orgId)
    .single()

  const orgSlug = org?.slug || ''
  const orgName = org?.name || 'our academy'

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
      <div className="bg-[#0a0a0a] -m-6 lg:-m-8 p-6 lg:p-8 min-h-screen text-white">
      <div className="space-y-6">
        {/* Hero */}
        <div>
          <h1 className="text-2xl font-bold text-white">Refer a friend — you both win 🎁</h1>
          <p className="text-sm text-white/60 mt-1">Share your link. When a friend joins, you both get rewarded.</p>
        </div>

        {/* Give / Get offer block */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5">
            <p className="text-[11px] uppercase tracking-wider text-[#4ecde6] font-bold">Your friend gets</p>
            <p className="text-white font-semibold mt-1.5">A warm welcome to the academy</p>
            <p className="text-sm text-white/60 mt-0.5">An easy start — book a trial or join a class.</p>
          </div>
          <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5">
            <p className="text-[11px] uppercase tracking-wider text-[#4ecde6] font-bold">You get</p>
            <p className="text-white font-semibold mt-1.5">A thank-you reward</p>
            <p className="text-sm text-white/60 mt-0.5">When your friend joins, the academy rewards you.</p>
          </div>
        </div>

        {/* Referral link (share card) */}
        <ReferralLink
          orgSlug={orgSlug}
          referralCode={profile?.referral_code || ''}
        />

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5">
            <p className="text-sm text-white/60">Friends invited</p>
            <p className="text-2xl font-bold mt-1">{totalReferrals}</p>
          </div>
          <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5">
            <p className="text-sm text-white/60">Signed up</p>
            <p className="text-2xl font-bold mt-1 text-[#4ecde6]">{successfulSignups}</p>
          </div>
          <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5">
            <p className="text-sm text-white/60">Rewards earned</p>
            <p className="text-2xl font-bold mt-1">&pound;{(totalRewards / 100).toFixed(2)}</p>
          </div>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-[#4ecde6]/40 to-transparent" />

        {/* Referral list */}
        <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5"><h2 className="text-lg font-semibold text-white mb-4">Your referrals</h2>
          {!referrals || referrals.length === 0 ? (
            <div className="text-center py-10">
              <div className="text-3xl mb-2" aria-hidden>🎁</div>
              <p className="text-sm font-semibold text-white">No referrals yet</p>
              <p className="text-xs text-white/50 mt-1 max-w-xs mx-auto">Share your link above and you&rsquo;ll both benefit when a friend joins.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#1e1e1e]">
              {referrals.map((referral) => (
                <div key={referral.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">Referral</p>
                    <p className="text-xs text-white/60">
                      {new Date(referral.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {referral.reward_amount && referral.status === 'rewarded' && (
                      <span className="text-sm font-medium text-[#4ecde6]">
                        +&pound;{(referral.reward_amount / 100).toFixed(2)}
                      </span>
                    )}
                    {referralStatusChip(referral.status)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      </div>
    )
  }

  // Admin view: see all referrals and manage rewards
  const { data: allReferrals } = await supabase
    .from('referrals')
    .select('*, referrer:profiles!referrals_referrer_id_fkey(full_name, email)')
    .eq('organisation_id', orgId)
    .order('created_at', { ascending: false })

  // Owner → owner referrals (098): academies that signed up through this
  // academy's /onboard?ref=<slug> link. 077a locks organisations SELECT to
  // own-org for authenticated sessions, so this one read uses the service
  // role — scoped hard to rows this org referred, minimal fields, after the
  // auth + requireFeature gates above.
  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { data: referredOrgs } = await serviceClient
    .from('organisations')
    .select('name, created_at, platform_subscription_status')
    .eq('referred_by_org_id', orgId)
    .order('created_at', { ascending: false })

  const totalReferrals = allReferrals?.length || 0
  const pendingCount = allReferrals?.filter((r) => r.status === 'signed_up').length || 0
  const rewardedCount = allReferrals?.filter((r) => r.status === 'rewarded').length || 0
  const totalPaidOut = allReferrals?.filter((r) => r.status === 'rewarded').reduce((sum, r) => sum + (r.reward_amount || 0), 0) || 0

  return (
    <div className="bg-[#0a0a0a] -m-6 lg:-m-8 p-6 lg:p-8 min-h-screen text-white">
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Referrals</h1>

      {/* Owner → owner: refer another academy to Player Portal (098) */}
      <ReferAcademyCard orgSlug={orgSlug} orgName={orgName} />

      {(referredOrgs || []).length > 0 && (
        <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5">
          <h2 className="text-lg font-semibold text-white mb-4">Academies you&rsquo;ve referred</h2>
          <div className="space-y-2">
            {(referredOrgs || []).map((r) => (
              <div key={`${r.name}-${r.created_at}`} className="flex items-center justify-between bg-[#141414] border border-[#232527] rounded-xl px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-white">{r.name}</p>
                  <p className="text-xs text-white/40">Joined {r.created_at ? new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</p>
                </div>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${r.platform_subscription_status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-orange-500/10 text-orange-400'}`}>
                  {r.platform_subscription_status === 'active' ? 'Live — reward due' : 'On trial'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="h-px bg-gradient-to-r from-transparent via-[#4ecde6]/40 to-transparent" />
      <h2 className="text-lg font-semibold text-white">Parent referrals</h2>

      {/* Admin stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5">
          <p className="text-sm text-white/60">Total Referrals</p>
          <p className="text-2xl font-bold mt-1">{totalReferrals}</p>
        </div>
        <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5">
          <p className="text-sm text-white/60">Awaiting Reward</p>
          <p className="text-2xl font-bold mt-1 text-orange-400">{pendingCount}</p>
        </div>
        <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5">
          <p className="text-sm text-white/60">Rewarded</p>
          <p className="text-2xl font-bold mt-1 text-[#4ecde6]">{rewardedCount}</p>
        </div>
        <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5">
          <p className="text-sm text-white/60">Total Paid Out</p>
          <p className="text-2xl font-bold mt-1">&pound;{(totalPaidOut / 100).toFixed(2)}</p>
        </div>
      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-[#4ecde6]/40 to-transparent" />

      {/* All referrals table */}
      <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5"><h2 className="text-lg font-semibold text-white mb-4">All Referrals</h2>
        {!allReferrals || allReferrals.length === 0 ? (
          <EmptyState message="No referrals yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.08] text-left text-white/60">
                  <th className="pb-3 font-medium">Referrer</th>
                  <th className="pb-3 font-medium">Code</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Reward</th>
                  <th className="pb-3 font-medium">Date</th>
                  <th className="pb-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e1e1e]">
                {allReferrals.map((referral) => (
                  <tr key={referral.id}>
                    <td className="py-3 pr-4">
                      <p className="font-medium">{referral.referrer?.full_name || '—'}</p>
                      <p className="text-xs text-white/60">{referral.referrer?.email || ''}</p>
                    </td>
                    <td className="py-3 pr-4">
                      <code className="bg-white/[0.05] px-2 py-0.5 rounded text-xs font-mono text-white/60">
                        {referral.referral_code}
                      </code>
                    </td>
                    <td className="py-3 pr-4">
                      <StatusBadge status={referral.status} />
                    </td>
                    <td className="py-3 pr-4">
                      {referral.reward_amount
                        ? `\u00A3${(referral.reward_amount / 100).toFixed(2)}`
                        : '—'}
                    </td>
                    <td className="py-3 pr-4 text-white/60 text-xs">
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
      </div>
    </div>
    </div>
  )
}
