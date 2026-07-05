import Link from 'next/link'
import type { LandingCTAContent } from './types'

export default function LandingCTA({ headline, headlineHighlight, subhead, primaryCta, secondaryCta, microCopy }: LandingCTAContent) {
  return (
    <section className="relative overflow-hidden border-t border-white/5">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full opacity-15" style={{ background: 'radial-gradient(circle, #4ecde6 0%, transparent 60%)' }} />
      </div>

      <div className="relative mx-auto max-w-5xl px-6 py-32 text-center">
        <h2 className="text-5xl sm:text-6xl lg:text-7xl leading-[0.98] tracking-[-0.02em] font-black text-white">
          {headline}
          {headlineHighlight ? (
            <>
              <br />
              <span className="text-white/50">{headlineHighlight}</span>
            </>
          ) : null}
        </h2>
        <p className="mt-10 text-lg lg:text-xl text-white/60 max-w-2xl mx-auto leading-relaxed">
          {subhead}
        </p>

        <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href={primaryCta.href}
            className="inline-flex items-center gap-2 rounded-full bg-[#4ecde6] text-black px-8 py-4 text-base font-semibold hover:bg-[#6eddf2] transition-colors"
          >
            {primaryCta.label}
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </Link>
          <Link
            href={secondaryCta.href}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 text-white px-8 py-4 text-base font-semibold hover:border-[#4ecde6]/50 hover:bg-[#4ecde6]/5 transition-colors"
          >
            {secondaryCta.label}
          </Link>
        </div>

        <p className="mt-8 text-xs text-white/40">{microCopy}</p>
      </div>
    </section>
  )
}
