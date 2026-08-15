import Link from 'next/link'
import { MigrationMock } from './mocks'

export default function MigrationTeaser() {
  return (
    <section id="solutions" className="relative scroll-mt-16">
      <div className="mx-auto max-w-7xl px-6 py-32">
        <div className="grid lg:grid-cols-12 gap-16 items-center">
          <div className="lg:col-span-7">
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#0a97b6] font-semibold mb-6">
              THE SWITCH
            </p>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl leading-[1.05] tracking-[-0.02em] font-black text-[#0d1b2b]">
              Coming from another provider?
              <br />
              <span className="text-[#93a2ad]">We&apos;ve done that migration. Twice.</span>
            </h2>
            <p className="mt-8 text-lg text-[#5a6b7c] max-w-2xl leading-relaxed">
              Export your CSV. Upload it here. We match parents, players, classes and plans. Every parent gets a one-click confirmation link. First real charge lands on the date you choose.
            </p>
            <p className="mt-3 text-lg text-[#0d1b2b] leading-relaxed max-w-2xl font-medium">
              Zero double-charges. Zero downtime. Usually done in an afternoon.
            </p>

            {/* Competitor strip */}
            <div className="mt-10">
              <p className="text-xs uppercase tracking-widest text-[#93a2ad] font-semibold mb-4">We migrate from</p>
              <div className="flex flex-wrap items-center gap-3">
                {['ClassForKids', 'LoveAdmin', 'TeamFeePay', 'Coacha'].map((p) => (
                  <span key={p} className="text-sm text-[#5a6b7c] font-semibold px-4 py-2 rounded-full border border-[#d3dfe6] bg-white">
                    {p}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-10">
              <Link href="/how-it-works" className="inline-flex items-center gap-2 rounded-full bg-white border border-[#d3dfe6] text-[#0d1b2b] px-7 py-3.5 text-[15px] font-semibold hover:border-[#0a97b6]/50 hover:bg-[#eef4f7] transition-colors shadow-[0_1px_3px_rgba(13,40,54,0.05)]">
                See how migration works
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </Link>
            </div>
          </div>

          <div className="lg:col-span-5 relative">
            <div className="absolute -inset-6 opacity-15 blur-3xl" style={{ background: 'radial-gradient(circle, #14a7c2 0%, transparent 70%)' }} />
            <div className="relative">
              <MigrationMock />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
