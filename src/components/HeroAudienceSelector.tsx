'use client'

import { useState } from 'react'
import Link from 'next/link'
import AcademySearch from './AcademySearch'

type Audience = 'academy' | 'parent' | 'browse'

/**
 * Segmented audience selector shown in the homepage hero. Lets the visitor
 * self-identify so we can show the relevant CTAs:
 *  - Academy owner → free trial + demo (current default)
 *  - Parent       → find your academy + try the demo
 *  - Just browsing → demo + features
 *
 * Animated sliding pill + brand-glow CTA button, all client-side state.
 */
export default function HeroAudienceSelector() {
  const [audience, setAudience] = useState<Audience>('academy')
  const [showSearch, setShowSearch] = useState(false)

  const segments: { id: Audience; label: string; emoji: string }[] = [
    { id: 'academy', label: 'I run an academy', emoji: '🏟️' },
    { id: 'parent', label: "I'm a parent", emoji: '👋' },
    { id: 'browse', label: 'Just browsing', emoji: '👀' },
  ]

  const selectedIndex = segments.findIndex((s) => s.id === audience)

  return (
    <div className="flex flex-col items-center gap-6 mb-20 animate-slide-up" style={{ animationDelay: '0.2s' }}>
      {/* "I'm a..." label above for discoverability */}
      <p className="text-xs sm:text-sm font-semibold uppercase tracking-widest text-white/40">
        I&apos;m a…
      </p>

      {/* Segmented selector — beefed up for visibility */}
      <div
        className="relative inline-flex items-center p-2 rounded-full bg-white/[0.06] border border-white/15 backdrop-blur-md shadow-2xl"
        style={{ boxShadow: '0 0 40px rgba(78, 205, 230, 0.15), 0 10px 30px rgba(0, 0, 0, 0.4)' }}
      >
        {/* Animated sliding background — much stronger glow now */}
        <div
          className="absolute top-2 bottom-2 rounded-full bg-white transition-all duration-500 ease-out"
          style={{
            width: `calc((100% - 16px) / ${segments.length})`,
            transform: `translateX(calc(${selectedIndex * 100}% + ${selectedIndex * 0}px))`,
            left: '8px',
            boxShadow: '0 0 30px rgba(78, 205, 230, 0.6), 0 0 60px rgba(78, 205, 230, 0.3), 0 4px 16px rgba(0, 0, 0, 0.4)',
          }}
        />
        {segments.map((seg) => (
          <button
            key={seg.id}
            onClick={() => {
              setAudience(seg.id)
              setShowSearch(false)
            }}
            className={`relative z-10 px-5 sm:px-6 py-3 rounded-full text-sm sm:text-base font-bold transition-colors duration-300 whitespace-nowrap ${
              audience === seg.id ? 'text-black' : 'text-white/70 hover:text-white'
            }`}
          >
            <span className="mr-2 text-base sm:text-lg">{seg.emoji}</span>
            <span className="hidden sm:inline">{seg.label}</span>
            <span className="sm:hidden">
              {seg.id === 'academy' ? 'Academy' : seg.id === 'parent' ? 'Parent' : 'Browse'}
            </span>
          </button>
        ))}
      </div>

      {/* CTAs adapt to audience */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center min-h-[60px]">
        {audience === 'academy' && (
          <>
            <Link
              href="/onboard"
              className="group relative px-8 py-4 bg-[#4ecde6] text-[#0a0a0a] rounded-full font-bold text-lg hover:scale-[1.03] transition-all glow-accent"
            >
              Start Free Trial
              <span className="inline-block ml-2 group-hover:translate-x-1 transition-transform">&rarr;</span>
            </Link>
            <Link
              href="/demo"
              className="px-8 py-4 border border-white/15 text-white/70 rounded-full font-semibold text-lg hover:bg-white/5 hover:text-white hover:border-white/25 transition-all"
            >
              Try the Demo
            </Link>
          </>
        )}

        {audience === 'parent' && (
          <>
            {showSearch ? (
              <div className="w-full max-w-md mx-auto">
                <AcademySearch
                  onSelect={(academy) => {
                    window.location.href = `/book/${academy.slug}`
                  }}
                  inputClassName="w-full px-5 py-4 bg-white/[0.04] border border-white/15 text-white rounded-full text-base focus:outline-none focus:border-[#4ecde6] focus:ring-2 focus:ring-[#4ecde6]/20 placeholder:text-white/40"
                />
                <button
                  onClick={() => setShowSearch(false)}
                  className="block mx-auto mt-3 text-xs text-white/40 hover:text-white/70 transition-colors"
                >
                  Or back to options
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={() => setShowSearch(true)}
                  className="group relative px-8 py-4 bg-[#4ecde6] text-[#0a0a0a] rounded-full font-bold text-lg hover:scale-[1.03] transition-all glow-accent"
                >
                  Find Your Academy
                  <span className="inline-block ml-2 group-hover:translate-x-1 transition-transform">&rarr;</span>
                </button>
                <Link
                  href="/auth/signin"
                  className="px-8 py-4 border border-white/15 text-white/70 rounded-full font-semibold text-lg hover:bg-white/5 hover:text-white hover:border-white/25 transition-all"
                >
                  I already have an account
                </Link>
              </>
            )}
          </>
        )}

        {audience === 'browse' && (
          <>
            <Link
              href="/demo"
              className="group relative px-8 py-4 bg-[#4ecde6] text-[#0a0a0a] rounded-full font-bold text-lg hover:scale-[1.03] transition-all glow-accent"
            >
              Try the Demo
              <span className="inline-block ml-2 group-hover:translate-x-1 transition-transform">&rarr;</span>
            </Link>
            <Link
              href="#features"
              className="px-8 py-4 border border-white/15 text-white/70 rounded-full font-semibold text-lg hover:bg-white/5 hover:text-white hover:border-white/25 transition-all"
            >
              See Features
            </Link>
          </>
        )}
      </div>

      {/* Helper line — adapts to audience */}
      <p className="text-xs text-white/30 -mt-2">
        {audience === 'academy' && '14-day free trial · No card required · Cancel anytime'}
        {audience === 'parent' && 'Find the academy you booked with to sign in or subscribe'}
        {audience === 'browse' && 'Real interface · Real data · Zero commitment'}
      </p>
    </div>
  )
}
