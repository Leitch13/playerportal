'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

/**
 * Cinematic admin dashboard hero. Replaces the plain "Hi {name}" header.
 *
 * Features:
 *  - Time-of-day greeting (Good morning/afternoon/evening) — feels personal
 *  - Academy logo + name as the primary identity
 *  - Live MRR ticker — animated count-up on mount, pulsing "live" indicator
 *  - This-week snapshot stats (active players, today's sessions, trend %)
 *  - Ambient brand-colour gradient blob behind the hero for depth
 *  - "View Booking Page" CTA repositioned as branded action
 *
 * Designed to feel like the dashboard of a serious SaaS (think Stripe / Linear).
 */
export default function AdminHero({
  firstName,
  orgName,
  orgLogo,
  orgSlug,
  brandColor = '#4ecde6',
  mrr,
  monthlyRevenue,
  revenueTrend,
  activePlayers,
  todaysSessions,
  activeSubs,
}: {
  firstName: string
  orgName: string | null
  orgLogo: string | null
  orgSlug: string | null
  brandColor?: string
  mrr: number
  monthlyRevenue: number
  revenueTrend: number
  activePlayers: number
  todaysSessions: number
  activeSubs: number
}) {
  // Animated count-up for the headline MRR number
  const [displayMrr, setDisplayMrr] = useState(0)
  useEffect(() => {
    if (mrr === 0) {
      setDisplayMrr(0)
      return
    }
    const duration = 1200
    const startTime = performance.now()
    let frame: number
    const tick = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration)
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplayMrr(Math.floor(mrr * eased))
      if (t < 1) frame = requestAnimationFrame(tick)
      else setDisplayMrr(mrr)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [mrr])

  // Time-of-day greeting
  const hour = new Date().getHours()
  const greeting = hour < 5 ? 'Burning the late shift' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const todayLabel = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  const trendColor = revenueTrend > 0 ? '#10b981' : revenueTrend < 0 ? '#ef4444' : '#a3a3a3'
  const trendIcon = revenueTrend > 0 ? '↗' : revenueTrend < 0 ? '↘' : '→'

  return (
    <div className="relative mb-8 overflow-hidden rounded-3xl border border-white/[0.06] bg-gradient-to-br from-[#0e1518] via-[#0a0a0a] to-[#0a0a0a] p-6 sm:p-8">
      {/* Ambient brand-colour glow */}
      <div
        className="absolute -top-32 -right-24 w-[500px] h-[500px] rounded-full blur-[120px] opacity-25 pointer-events-none"
        style={{ background: brandColor }}
      />
      <div
        className="absolute -bottom-32 -left-24 w-[400px] h-[400px] rounded-full blur-[120px] opacity-10 pointer-events-none"
        style={{ background: brandColor }}
      />
      {/* Subtle grid pattern for depth */}
      <div
        className="absolute inset-0 opacity-[0.025] pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      <div className="relative">
        {/* Top row — date + booking page link */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <span className="relative inline-flex w-2 h-2 rounded-full" style={{ background: brandColor }}>
              <span className="absolute inset-0 rounded-full animate-ping" style={{ background: brandColor, opacity: 0.6 }} />
            </span>
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-white/40">
              Live · {todayLabel}
            </p>
          </div>
          {orgSlug && (
            <Link
              href={`/book/${orgSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-white/70 hover:text-white bg-white/[0.04] border border-white/[0.08] hover:border-white/15 transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              View booking page
            </Link>
          )}
        </div>

        {/* Greeting + academy identity */}
        <div className="flex items-center gap-4 mb-7">
          {orgLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={orgLogo}
              alt={orgName || 'Academy'}
              className="w-14 h-14 rounded-xl object-cover border border-white/[0.08] bg-[#1a1a1a] flex-shrink-0"
            />
          ) : (
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 border border-white/[0.08]"
              style={{ background: `${brandColor}15` }}
            >
              ⚽
            </div>
          )}
          <div className="min-w-0">
            <p className="text-xs sm:text-sm text-white/40 mb-0.5">{greeting}, {firstName}</p>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white tracking-tight truncate">
              {orgName || 'Your academy'}
            </h1>
          </div>
        </div>

        {/* Big MRR hero number */}
        <div className="mb-6">
          <div className="flex items-baseline gap-3 flex-wrap">
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-white/40">
              Monthly Recurring Revenue
            </p>
            {revenueTrend !== 0 && (
              <p className="text-xs font-bold inline-flex items-center gap-1" style={{ color: trendColor }}>
                <span>{trendIcon}</span>
                <span>{Math.abs(revenueTrend)}% vs last month</span>
              </p>
            )}
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span
              className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight tabular-nums"
              style={{
                background: `linear-gradient(180deg, #ffffff 0%, ${brandColor} 100%)`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              £{displayMrr.toLocaleString()}
            </span>
            <span className="text-sm sm:text-base text-white/30 font-medium">/mo</span>
          </div>
          <p className="text-xs text-white/30 mt-2">
            Projected annual run rate: <span className="text-white/60 font-semibold tabular-nums">£{(mrr * 12).toLocaleString()}</span>
          </p>
        </div>

        {/* Quick stats row */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 sm:p-4">
            <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold mb-1">Players</p>
            <p className="text-xl sm:text-2xl font-bold text-white tabular-nums">{activePlayers}</p>
            <p className="text-[10px] text-white/30 mt-0.5">Active</p>
          </div>
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 sm:p-4">
            <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold mb-1">Today</p>
            <p className="text-xl sm:text-2xl font-bold tabular-nums text-white" style={todaysSessions > 0 ? { color: brandColor } : undefined}>{todaysSessions}</p>
            <p className="text-[10px] text-white/30 mt-0.5">Sessions</p>
          </div>
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 sm:p-4">
            <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold mb-1">Subscribers</p>
            <p className="text-xl sm:text-2xl font-bold text-emerald-400 tabular-nums">{activeSubs}</p>
            <p className="text-[10px] text-white/30 mt-0.5">Recurring</p>
          </div>
        </div>

        {monthlyRevenue > 0 && monthlyRevenue !== mrr && (
          <p className="text-[10px] text-white/30 mt-4 text-center sm:text-left">
            Banked this month: <span className="text-white/60 font-semibold tabular-nums">£{monthlyRevenue.toLocaleString()}</span>
          </p>
        )}
      </div>
    </div>
  )
}
