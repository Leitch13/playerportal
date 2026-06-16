'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { buildWhatsappShareUrl } from '@/lib/whatsapp'

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

  // Build the referral URL — use relative path for SSR, full URL after mount.
  // Target preserved exactly (referral attribution unchanged).
  const relativePath = `/auth/signup?org=${orgSlug}&ref=${referralCode}`
  const [referralUrl, setReferralUrl] = useState(relativePath)

  useEffect(() => {
    if (referralCode) {
      setReferralUrl(`${window.location.origin}${relativePath}`)
    }
  }, [relativePath, referralCode])

  // Admin approve reward button (update logic preserved byte-for-byte; dark restyle only)
  if (approveReferralId) {
    return (
      <div className="flex items-center gap-2">
        {!showRewardInput ? (
          <button
            onClick={() => setShowRewardInput(true)}
            className="text-xs px-2.5 py-1 rounded-lg font-medium bg-[#4ecde6]/15 text-[#4ecde6] border border-[#4ecde6]/30 hover:bg-[#4ecde6]/25 transition-colors"
          >
            Approve Reward
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <span className="text-xs text-white/60">&pound;</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={rewardAmount}
              onChange={(e) => setRewardAmount(e.target.value)}
              placeholder="0.00"
              className="w-20 bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-2 focus:ring-[#4ecde6]/40"
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
              className="text-xs px-2.5 py-1 rounded-lg font-medium bg-[#4ecde6] text-[#06222a] hover:bg-[#6fd9ec] disabled:opacity-50 transition-colors"
            >
              {loading ? '...' : 'Confirm'}
            </button>
            <button
              onClick={() => {
                setShowRewardInput(false)
                setRewardAmount('')
              }}
              className="text-xs px-2 py-1 rounded-lg font-medium text-white/60 hover:text-white"
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

  const whatsappHref = buildWhatsappShareUrl(
    'Join Player Portal using my link — we both benefit! ' +
    referralUrl + (referralUrl.includes('?') ? '&' : '?') + 'utm_source=whatsapp&utm_medium=referral',
  )

  const primaryBtn = `w-full py-3 rounded-xl text-sm font-bold transition-all ${
    copied ? 'bg-emerald-500 text-white' : 'bg-[#4ecde6] text-[#06222a] hover:bg-[#6fd9ec]'
  }`
  const secondaryBtn =
    'py-3 rounded-xl text-sm font-semibold bg-white/[0.06] border border-white/[0.12] text-white hover:bg-white/[0.1] transition-colors text-center'

  // Compact version for embedding in dashboard (self-contained, on-brand)
  if (compact) {
    return (
      <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5">
        <div className="flex items-center gap-2.5 mb-3">
          <span className="w-8 h-8 rounded-lg bg-[#4ecde6]/15 border border-[#4ecde6]/30 flex items-center justify-center text-base" aria-hidden>🎁</span>
          <div>
            <h3 className="text-sm font-bold text-white">Refer a friend</h3>
            <p className="text-xs text-white/50">Share your link — you both benefit.</p>
          </div>
        </div>

        <div className="bg-[#0f0f0f] border border-[#1e1e1e] rounded-lg px-3 py-2 mb-3">
          <span className="text-xs font-mono truncate block text-white/70">{referralUrl}</span>
        </div>

        <div className="flex gap-2">
          <button onClick={handleCopy} className={`flex-1 ${copied ? 'bg-emerald-500 text-white' : 'bg-[#4ecde6] text-[#06222a] hover:bg-[#6fd9ec]'} py-2.5 rounded-xl text-sm font-bold transition-all`}>
            {copied ? '✓ Copied' : 'Copy link'}
          </button>
          <button onClick={handleShare} className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-white/[0.06] border border-white/[0.12] text-white hover:bg-white/[0.1] transition-colors">
            Share
          </button>
        </div>
      </div>
    )
  }

  // Full version for the referrals page — share card (dark/cyan, on-brand)
  return (
    <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6 md:p-8">
      <div className="flex items-center gap-3 mb-4">
        <span className="w-11 h-11 rounded-xl bg-[#4ecde6]/15 border border-[#4ecde6]/30 flex items-center justify-center text-2xl" aria-hidden>🎁</span>
        <div>
          <h2 className="text-lg font-bold text-white">Your referral link</h2>
          <p className="text-sm text-white/60">Share it anywhere — copy it, send via WhatsApp, or use your phone's share sheet.</p>
        </div>
      </div>

      <div className="bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl px-4 py-3 mb-4">
        <p className="text-[11px] uppercase tracking-wider text-white/40 mb-1">Your link</p>
        <p className="text-sm text-white/80 font-mono truncate">{referralUrl}</p>
      </div>

      <div className="space-y-2.5">
        <button onClick={handleCopy} className={primaryBtn}>
          {copied ? '✓ Copied!' : 'Copy your link'}
        </button>
        <div className="grid grid-cols-2 gap-2.5">
          {/* Sprint 6 — Click-to-share via WhatsApp. utm_source=whatsapp utm_medium=referral
              so any resulting trial booking attributes via the Sprint 5 trial-source chain. */}
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="referral-whatsapp-share"
            className="py-3 rounded-xl text-sm font-semibold bg-emerald-500 text-white hover:bg-emerald-400 transition-colors text-center"
          >
            WhatsApp
          </a>
          <button onClick={handleShare} className={secondaryBtn}>
            Share
          </button>
        </div>
      </div>

      {/* On-brand 1-2-3 explainer */}
      <div className="mt-5 grid grid-cols-3 gap-3">
        {[
          { n: '1', label: 'Share your link' },
          { n: '2', label: 'Your friend joins' },
          { n: '3', label: 'You get rewarded' },
        ].map((s) => (
          <div key={s.n} className="rounded-xl bg-white/[0.03] border border-white/[0.08] p-3 text-center">
            <div className="w-7 h-7 mx-auto rounded-full bg-[#4ecde6]/15 border border-[#4ecde6]/30 text-[#4ecde6] font-bold text-sm flex items-center justify-center">
              {s.n}
            </div>
            <p className="text-[11px] text-white/60 mt-2">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
