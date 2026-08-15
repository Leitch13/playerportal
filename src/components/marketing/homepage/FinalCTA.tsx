import Link from 'next/link'

export default function FinalCTA() {
  return (
    <section
      className="relative overflow-hidden text-white"
      style={{ background: 'linear-gradient(168deg,#14a7c2 0%,#0b8199 55%,#0a7184 100%)' }}
    >
      {/* Radial glows */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(120% 70% at 78% -18%, rgba(120,235,252,0.3), transparent 55%), radial-gradient(110% 80% at 0% 120%, rgba(4,56,70,0.45), transparent 60%)',
        }}
      />

      <div className="relative mx-auto max-w-5xl px-6 py-32 text-center">
        <h2 className="text-5xl sm:text-6xl lg:text-7xl leading-[0.98] tracking-[-0.02em] font-black text-white">
          Stop chasing payments.
          <br />
          <span className="text-[rgba(6,32,40,0.85)]">Start growing your academy.</span>
        </h2>
        <p className="mt-10 text-lg lg:text-xl text-white/85 max-w-2xl mx-auto leading-relaxed">
          Try Player Portal free for 14 days. Bring your existing members over in an afternoon. Cancel any time.
        </p>

        <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/onboard"
            className="inline-flex items-center gap-2 rounded-full bg-white text-[#0a1420] px-8 py-4 text-base font-semibold hover:bg-[#e8f6fa] transition-colors"
          >
            Try free for 14 days
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </Link>
          <Link
            href="/how-it-works"
            className="inline-flex items-center gap-2 rounded-full border border-white/40 text-white px-8 py-4 text-base font-semibold hover:bg-white/10 transition-colors"
          >
            Book a demo
          </Link>
        </div>

        <p className="mt-8 text-xs text-white/60">
          Built by an academy. Trusted by growing academies. Made in Aberdeen.
        </p>
      </div>
    </section>
  )
}
