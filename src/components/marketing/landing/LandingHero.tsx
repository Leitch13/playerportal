import Link from 'next/link'
import type { LandingHeroContent } from './types'

type Props = LandingHeroContent & {
  visual?: React.ReactNode
}

export default function LandingHero({ eyebrow, h1, h1Highlight, subhead, primaryCta, secondaryCta, trustDots, visual }: Props) {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-32 -left-20 w-[600px] h-[600px] rounded-full opacity-[0.08]" style={{ background: 'radial-gradient(circle, #4ecde6 0%, transparent 70%)' }} />
      </div>

      <div className={`relative mx-auto max-w-7xl px-6 pt-32 pb-24 lg:pt-40 lg:pb-32`}>
        <div className={visual ? 'grid lg:grid-cols-12 gap-16 items-center' : 'max-w-4xl'}>
          <div className={visual ? 'lg:col-span-7' : ''}>
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#4ecde6] font-semibold mb-6">
              {eyebrow}
            </p>
            <h1 className="text-[44px] sm:text-[64px] lg:text-[80px] leading-[0.98] tracking-[-0.02em] font-black text-white">
              {h1}
              {h1Highlight ? (
                <>
                  <br />
                  <span className="text-white/60">{h1Highlight}</span>
                </>
              ) : null}
            </h1>
            <p className="mt-8 text-lg lg:text-xl text-white/60 max-w-2xl leading-relaxed">
              {subhead}
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <Link
                href={primaryCta.href}
                className="inline-flex items-center gap-2 rounded-full bg-[#4ecde6] text-black px-7 py-3.5 text-[15px] font-semibold hover:bg-[#6eddf2] transition-colors"
              >
                {primaryCta.label}
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </Link>
              <Link
                href={secondaryCta.href}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 text-white px-7 py-3.5 text-[15px] font-semibold hover:border-[#4ecde6]/50 hover:bg-[#4ecde6]/5 transition-colors"
              >
                {secondaryCta.label}
              </Link>
            </div>

            {trustDots.length > 0 && (
              <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-white/40">
                {trustDots.map((t) => (
                  <span key={t} className="inline-flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-[#4ecde6]" />
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>

          {visual ? (
            <div className="lg:col-span-5 relative">
              <div className="relative">
                <div className="absolute -inset-8 opacity-30 blur-3xl" style={{ background: 'radial-gradient(circle, #4ecde6 0%, transparent 70%)' }} />
                <div className="relative transform lg:rotate-[1.5deg] lg:hover:rotate-0 transition-transform duration-500">
                  {visual}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
