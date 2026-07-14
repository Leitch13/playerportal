'use client'

import { useState } from 'react'

/**
 * Owner → owner referral share card ("Refer another academy").
 *
 * Renders the academy's /onboard?ref=<slug> link with copy + WhatsApp share.
 * Attribution is captured by the onboarding wizard and stamped as
 * organisations.referred_by_org_id (migration 098). Rewards are manual at
 * MVP — the copy below states the offer; John applies the platform-bill
 * credit when the referred academy pays its first invoice.
 */
export default function ReferAcademyCard({ orgSlug, orgName }: { orgSlug: string; orgName: string }) {
  const [copied, setCopied] = useState(false)
  const link = `https://www.theplayerportal.net/onboard?ref=${orgSlug}`
  const waText = encodeURIComponent(
    `We run ${orgName} on Player Portal — bookings, memberships, payments and parent comms in one place. If you sign up with my link we both get a free month: ${link}`
  )

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard unavailable — the input below is selectable */
    }
  }

  return (
    <div className="bg-white/[0.05] backdrop-blur-xl border border-[#4ecde6]/25 rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-[#4ecde6] font-bold">Refer another academy</p>
          <h2 className="text-lg font-semibold text-white mt-1">Know another academy owner? You both get a month free.</h2>
          <p className="text-sm text-white/60 mt-1 max-w-xl">
            Share your link. When an academy signs up through it and pays their first month,
            we credit a free month to their bill — and to yours.
          </p>
        </div>
      </div>
      <div className="flex gap-2 mt-4 flex-wrap">
        <input
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          className="flex-1 min-w-[240px] bg-[#141414] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white/80 focus:outline-none focus:ring-2 focus:ring-[#4ecde6]/40"
        />
        <button
          onClick={copy}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#4ecde6] text-[#0a0a0a] hover:bg-[#4ecde6]/90 transition-colors"
        >
          {copied ? 'Copied ✓' : 'Copy link'}
        </button>
        <a
          href={`https://wa.me/?text=${waText}`}
          target="_blank"
          rel="noopener noreferrer"
          className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#25D366]/15 text-[#25D366] border border-[#25D366]/30 hover:bg-[#25D366]/25 transition-colors"
        >
          Share on WhatsApp
        </a>
      </div>
    </div>
  )
}
