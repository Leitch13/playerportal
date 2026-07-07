import Link from 'next/link'

export default function FinalCTA() {
  return (
    <section className="relative overflow-hidden border-t border-white/5">
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full opacity-15" style={{ background: 'radial-gradient(circle, #4ecde6 0%, transparent 60%)' }} />
      </div>

      <div className="relative mx-auto max-w-5xl px-6 py-32 text-center">
        <h2 className="text-5xl sm:text-6xl lg:text-7xl leading-[0.98] tracking-[-0.02em] font-black text-white">
          Stop chasing payments.
          <br />
          <span className="text-white/50">Start growing your academy.</span>
        </h2>
        <p className="mt-10 text-lg lg:text-xl text-white/60 max-w-2xl mx-auto leading-relaxed">
          Try Player Portal free for 14 days. Bring your existing members over in an afternoon. Cancel any time.
        </p>

        <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/onboard"
            className="inline-flex items-center gap-2 rounded-full bg-[#4ecde6] text-black px-8 py-4 text-base font-semibold hover:bg-[#6eddf2] transition-colors"
          >
            Try free for 14 days
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </Link>
          <Link
            href="/how-it-works"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 text-white px-8 py-4 text-base font-semibold hover:border-[#4ecde6]/50 hover:bg-[#4ecde6]/5 transition-colors"
          >
            Book a demo
          </Link>
        </div>

        <p className="mt-8 text-xs text-white/40">
          Built by an academy. Trusted by growing academies. Made in Aberdeen.
        </p>
      </div>
    </section>
  )
}
