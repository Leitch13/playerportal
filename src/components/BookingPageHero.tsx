'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

/**
 * Premium hero for academy public booking pages (`/book/[slug]`).
 *
 * - Bigger, more cinematic gradient background
 * - Animated count-up trust stats (players + sessions + classes)
 * - Live "trusted by" badge if academy has real activity
 * - Brand-colour glow on primary CTA
 * - Subtle floating gradient orbs for depth
 */
export default function BookingPageHero({
  slug,
  orgName,
  orgDescription,
  orgLogo,
  orgHeroImage,
  primaryColor,
  totalPlayers,
  totalSessions,
  totalClasses,
}: {
  slug: string
  orgName: string
  orgDescription?: string | null
  orgLogo?: string | null
  orgHeroImage?: string | null
  primaryColor: string
  totalPlayers: number
  totalSessions: number
  totalClasses: number
}) {
  const showTrust = totalPlayers >= 1 || totalSessions >= 1
  // For brand-new academies with zero activity yet — show a "fresh launch" badge
  // instead of looking empty. Same visual weight, different message.
  const isFreshLaunch = !showTrust

  // Animated counters
  const [playersCount, setPlayersCount] = useState(0)
  const [sessionsCount, setSessionsCount] = useState(0)
  const [classesCount, setClassesCount] = useState(0)

  useEffect(() => {
    const duration = 1400
    const startTime = performance.now()
    let frame: number
    const tick = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setPlayersCount(Math.floor(totalPlayers * eased))
      setSessionsCount(Math.floor(totalSessions * eased))
      setClassesCount(Math.floor(totalClasses * eased))
      if (t < 1) frame = requestAnimationFrame(tick)
      else {
        setPlayersCount(totalPlayers)
        setSessionsCount(totalSessions)
        setClassesCount(totalClasses)
      }
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [totalPlayers, totalSessions, totalClasses])

  return (
    <div
      className="relative py-12 sm:py-28 px-4 sm:px-6 text-center text-white overflow-hidden"
      style={{ background: `linear-gradient(160deg, #060606 0%, #0a0a0a 35%, ${primaryColor}40 100%)` }}
    >
      {/* Hero image backdrop if set */}
      {orgHeroImage && (
        <div className="absolute inset-0 bg-cover bg-center opacity-20" style={{ backgroundImage: `url(${orgHeroImage})` }} />
      )}

      {/* Floating brand-colour orbs */}
      <div
        className="absolute -top-20 left-[20%] w-[400px] h-[400px] rounded-full blur-[120px] opacity-30 pointer-events-none animate-float-1"
        style={{ background: primaryColor }}
      />
      <div
        className="absolute -bottom-20 right-[20%] w-[300px] h-[300px] rounded-full blur-[100px] opacity-20 pointer-events-none animate-float-2"
        style={{ background: primaryColor }}
      />

      {/* Grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />

      {/* Radial vignette to focus attention */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at 50% 110%, ${primaryColor}30 0%, transparent 60%)` }}
      />

      <div className="relative z-10 max-w-3xl mx-auto">
        {/* Trust badge above title — adapts to activity level */}
        {showTrust ? (
          <div className="inline-flex items-center gap-2 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full bg-white/[0.06] border border-white/[0.12] backdrop-blur-sm mb-4 sm:mb-6 animate-fade-in">
            <span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-400">
              <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
            </span>
            <span className="text-[11px] sm:text-xs font-semibold text-white/80">
              {totalPlayers > 0
                ? `Trusted by ${totalPlayers}+ player${totalPlayers === 1 ? '' : 's'}`
                : `${totalSessions}+ sessions delivered`}
            </span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full bg-white/[0.06] border border-white/[0.12] backdrop-blur-sm mb-4 sm:mb-6 animate-fade-in">
            <span className="text-sm sm:text-base">✨</span>
            <span className="text-[11px] sm:text-xs font-semibold text-white/80">
              Newly launched · Be one of the first
            </span>
          </div>
        )}

        {orgLogo && (
          <div className="mb-4 sm:mb-6 flex justify-center animate-fade-in">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={orgLogo}
              alt={`${orgName} logo`}
              className="h-16 sm:h-28 w-auto object-contain rounded-2xl"
              style={{ filter: `drop-shadow(0 0 30px ${primaryColor}40)` }}
            />
          </div>
        )}

        <h1
          className="text-3xl sm:text-6xl md:text-7xl font-extrabold mb-3 sm:mb-4 tracking-tight leading-[1.05] sm:leading-[1] animate-slide-up"
          style={{
            background: `linear-gradient(180deg, #ffffff 0%, #ffffff 50%, ${primaryColor} 100%)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          {orgName}
        </h1>

        <p className="text-sm sm:text-xl text-white/60 mb-6 sm:mb-10 max-w-2xl mx-auto leading-relaxed animate-slide-up" style={{ animationDelay: '0.1s' }}>
          {orgDescription || 'Professional football coaching for all ages and abilities'}
        </p>

        <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 justify-center animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <Link
            href={`/auth/signup?org=${slug}`}
            className="inline-block px-7 py-3.5 sm:px-10 sm:py-4 rounded-full text-base sm:text-lg font-extrabold transition-all hover:scale-[1.05] active:scale-[0.98]"
            style={{
              backgroundColor: primaryColor,
              color: '#0a0a0a',
              boxShadow: `0 12px 40px ${primaryColor}90, 0 0 0 3px ${primaryColor}30, 0 0 80px ${primaryColor}40`,
            }}
          >
            Join Now &rarr;
          </Link>
          <Link
            href={`/book/${slug}/trial/quick`}
            className="inline-block px-7 py-3.5 sm:px-10 sm:py-4 rounded-full text-base sm:text-lg font-extrabold bg-white text-[#0a0a0a] transition-all hover:scale-[1.05] active:scale-[0.98] hover:shadow-2xl"
          >
            Try Free Session
          </Link>
        </div>

        {/* Animated stats row */}
        {showTrust && (
          <div className="grid grid-cols-3 gap-3 sm:gap-8 max-w-2xl mx-auto mt-8 sm:mt-12 animate-slide-up" style={{ animationDelay: '0.3s' }}>
            <div className="text-center">
              <div className="text-3xl sm:text-5xl font-black tracking-tight tabular-nums" style={{ color: primaryColor }}>
                {playersCount.toLocaleString()}
                {totalPlayers > 9 && '+'}
              </div>
              <div className="text-[10px] sm:text-xs uppercase tracking-widest text-white/40 mt-1 font-bold">
                Active Players
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl sm:text-5xl font-black tracking-tight text-white tabular-nums">
                {classesCount.toLocaleString()}
              </div>
              <div className="text-[10px] sm:text-xs uppercase tracking-widest text-white/40 mt-1 font-bold">
                Weekly Classes
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl sm:text-5xl font-black tracking-tight text-emerald-400 tabular-nums">
                {sessionsCount.toLocaleString()}
                {totalSessions > 9 && '+'}
              </div>
              <div className="text-[10px] sm:text-xs uppercase tracking-widest text-white/40 mt-1 font-bold">
                Sessions Delivered
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes float-1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(30px, 20px) scale(1.05); }
        }
        @keyframes float-2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-25px, -15px) scale(0.95); }
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-float-1 { animation: float-1 18s ease-in-out infinite; }
        .animate-float-2 { animation: float-2 22s ease-in-out infinite; }
        .animate-fade-in { animation: fade-in 0.6s ease-out both; }
        .animate-slide-up { animation: slide-up 0.7s ease-out both; }
      `}</style>
    </div>
  )
}
