import Link from 'next/link'
import { MigrationMock } from './mocks'

export default function MigrationTeaser() {
  return (
    <section id="solutions" className="relative scroll-mt-16">
      <div className="mx-auto max-w-7xl px-6 py-32">
        <div className="grid lg:grid-cols-12 gap-16 items-center">
          <div className="lg:col-span-7">
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#4ecde6] font-semibold mb-6">
              THE SWITCH
            </p>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl leading-[1.05] tracking-[-0.02em] font-black text-white">
              Coming from another provider?
              <br />
              <span className="text-white/50">We&apos;ve done that migration. Twice.</span>
            </h2>
            <p className="mt-8 text-lg text-white/70 max-w-2xl leading-relaxed">
              Export your CSV. Upload it here. We match parents, players, classes and plans. Every parent gets a one-click confirmation link. First real charge lands on the date you choose.
            </p>
            <p className="mt-3 text-lg text-white leading-relaxed max-w-2xl font-medium">
              Zero double-charges. Zero downtime. Usually done in an afternoon.
            </p>

            {/* Competitor strip */}
            <div className="mt-10">
              <p className="text-xs uppercase tracking-widest text-white/40 font-semibold mb-4">We migrate from</p>
              <div className="flex flex-wrap items-center gap-3">
                {['ClassForKids', 'LoveAdmin', 'TeamFeePay', 'Coacha'].map((p) => (
                  <span key={p} className="text-sm text-white/70 font-semibold px-4 py-2 rounded-full border border-white/10 bg-white/[0.02]">
                    {p}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-10">
              <Link href="/how-it-works" className="inline-flex items-center gap-2 rounded-full bg-white/5 border border-white/15 text-white px-7 py-3.5 text-[15px] font-semibold hover:border-[#4ecde6]/50 hover:bg-[#4ecde6]/5 transition-colors">
                See how migration works
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </Link>
            </div>
          </div>

          <div className="lg:col-span-5 relative">
            <div className="absolute -inset-6 opacity-25 blur-3xl" style={{ background: 'radial-gradient(circle, #4ecde6 0%, transparent 70%)' }} />
            <div className="relative">
              <MigrationMock />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
