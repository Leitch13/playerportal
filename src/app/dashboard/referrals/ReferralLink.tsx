'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ReferralLink({
  orgSlug,
  referralCode,
  approveReferralId,
  orgId,
  compact,
}: {
  orgSlug?: string
  referralCode?: string
  approveReferralId?: string
  orgId?: string
  compact?: boolean
}) {
  const router = useRouter()
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  const [rewardAmount, setRewardAmount] = useState('')
  const [showRewardInput, setShowRewardInput] = useState(false)

  // Admin approve reward button
  if (approveReferralId) {
    return (
      <div className="flex items-center gap-2">
        {!showRewardInput ? (
          <button
            onClick={() => setShowRewardInput(true)}
            className="text-xs px-2 py-1 rounded font-medium bg-cyan-50 text-primary hover:bg-cyan-100"
          >
            Approve Reward
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <span className="text-xs text-text-light">&pound;</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={rewardAmount}
              onChange={(e) => setRewardAmount(e.target.value)}
              placeholder="0.00"
              className="w-20 border border-border rounded px-2 py-1 text-xs"
            />
            <button
              disabled={loading || !rewardAmount}
              onClick={async () => {
                setLoading(true)
                const supabase = createClient()
                await supabase
                  .from('referrals')
                  .update({
                    status: 'rewarded',
                    reward_amount: Math.round(parseFloat(rewardAmount) * 100),
                    completed_at: new Date().toISOString(),
                  })
                  .eq('id', approveReferralId)
                router.refresh()
                setLoading(false)
                setShowRewardInput(false)
              }}
              className="text-xs px-2 py-1 rounded font-medium bg-primary text-white hover:opacity-90 disabled:opacity-50"
            >
              {loading ? '...' : 'Confirm'}
            </button>
            <button
              onClick={() => {
                setShowRewardInput(false)
                setRewardAmount('')
              }}
              className="text-xs px-2 py-1 rounded font-medium text-text-light hover:text-text"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    )
  }

  // No referral code assigned
  if (!approveReferralId && !referralCode) {
    return null
  }

  // Build the referral URL — use relative path for SSR, full URL after mount
  const relativePath = `/auth/signup?org=${orgSlug}&ref=${referralCode}`
  const [referralUrl, setReferralUrl] = useState(relativePath)

  useEffect(() => {
    setReferralUrl(`${window.location.origin}${relativePath}`)
  }, [relativePath])

  function handleCopy() {
    navigator.clipboard.writeText(referralUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 3000)
  }

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join Player Portal!',
          text: 'Sign up using my referral link and we both benefit!',
          url: referralUrl,
        })
      } catch {
        // User cancelled share
      }
    } else {
      handleCopy()
    }
  }

  // Compact version for embedding in dashboard
  if (compact) {
    return (
      <div className="bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 rounded-2xl p-5 text-white relative overflow-hidden">
        {/* Decorative */}
        <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full" />
        <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-white/10 rounded-full" />

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">🎁</span>
            <h3 className="text-base font-bold">Refer a Friend</h3>
          </div>
          <p className="text-sm text-white/80 mb-4">
            Share your link and earn rewards when friends sign up!
          </p>

          <div className="bg-white/15 backdrop-blur rounded-lg px-3 py-2 mb-3 flex items-center gap-2">
            <span className="text-xs font-mono truncate flex-1 text-white/90">{referralUrl}</span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                copied
                  ? 'bg-green-400 text-green-900'
                  : 'bg-white text-purple-600 hover:bg-white/90'
              }`}
            >
              {copied ? '✓ Copied!' : 'Copy Link'}
            </button>
            <button
              onClick={handleShare}
              className="px-4 py-2.5 rounded-xl text-sm font-bold bg-white/20 hover:bg-white/30 transition-colors"
            >
              Share
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Full version for referrals page
  return (
    <div className="bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 rounded-2xl p-6 md:p-8 text-white relative overflow-hidden">
      {/* Decorative circles */}
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full" />
      <div className="absolute -bottom-6 -left-6 w-28 h-28 bg-white/10 rounded-full" />
      <div className="absolute top-1/2 right-1/3 w-16 h-16 bg-white/5 rounded-full" />

      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">🎁</span>
          <div>
            <h2 className="text-xl font-bold">Refer a Friend</h2>
            <p className="text-sm text-white/80">Share the love and earn rewards!</p>
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur rounded-xl p-4 mt-4 mb-4">
          <p className="text-xs text-white/60 mb-2 font-medium">Your personal referral link:</p>
          <div className="bg-white/15 rounded-lg px-4 py-3 font-mono text-sm break-all">
            {referralUrl}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleCopy}
            className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${
              copied
                ? 'bg-green-400 text-green-900'
                : 'bg-white text-purple-600 hover:bg-white/90 hover:scale-[1.02]'
            }`}
          >
            {copied ? '✓ Link Copied!' : '📋 Copy Link'}
          </button>
          <button
            onClick={handleShare}
            className="flex-1 py-3 rounded-xl text-sm font-bold bg-white/20 hover:bg-white/30 transition-all hover:scale-[1.02]"
          >
            📤 Share
          </button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="bg-white/10 rounded-lg px-3 py-2 text-center">
            <p className="text-lg font-bold">1</p>
            <p className="text-[10px] text-white/70">Share link</p>
          </div>
          <div className="bg-white/10 rounded-lg px-3 py-2 text-center">
            <p className="text-lg font-bold">2</p>
            <p className="text-[10px] text-white/70">Friend signs up</p>
          </div>
          <div className="bg-white/10 rounded-lg px-3 py-2 text-center">
            <p className="text-lg font-bold">3</p>
            <p className="text-[10px] text-white/70">You get rewarded</p>
          </div>
        </div>
      </div>
    </div>
  )
}
