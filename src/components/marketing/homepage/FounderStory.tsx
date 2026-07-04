import Link from 'next/link'

export default function FounderStory() {
  return (
    <section id="why" className="relative border-y border-white/5 bg-gradient-to-b from-[#0a0a0a] via-[#0b0d0e] to-[#0a0a0a] scroll-mt-16">
      <div className="mx-auto max-w-7xl px-6 py-32">
        <div className="grid lg:grid-cols-12 gap-16 items-center">
          {/* Portrait placeholder */}
          <div className="lg:col-span-5 order-2 lg:order-1">
            <div className="relative">
              <div className="absolute -inset-6 opacity-20 blur-3xl" style={{ background: 'radial-gradient(circle, #4ecde6 0%, transparent 70%)' }} />
              <FounderPortrait />
            </div>
          </div>

          {/* Copy */}
          <div className="lg:col-span-7 order-1 lg:order-2">
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#4ecde6] font-semibold mb-6">
              BUILT BY AN ACADEMY
            </p>
            <blockquote className="text-3xl sm:text-4xl lg:text-5xl leading-[1.15] tracking-[-0.02em] font-black text-white">
              &ldquo;I got tired of paying £120 a month for software
              that couldn&apos;t tell me who owed me money.
              <span className="text-white/50"> So I built the thing I wished I&apos;d had.&rdquo;</span>
            </blockquote>
            <div className="mt-10 flex items-center gap-4">
              <div className="w-1 h-12 bg-[#4ecde6] rounded-full" />
              <div>
                <p className="text-white font-bold">John Leitch</p>
                <p className="text-sm text-white/50">Academy operator &middot; Founder, Player Portal</p>
              </div>
            </div>
            <p className="mt-8 text-lg text-white/70 leading-relaxed max-w-2xl">
              Every other academy platform was built by developers who saw an opportunity. Player Portal was built by someone still in the trenches — running an academy, dealing with parents, chasing payments, and taking training on Saturday mornings.
            </p>
            <div className="mt-8">
              <Link href="/how-it-works" className="inline-flex items-center gap-2 text-[#4ecde6] font-semibold text-sm hover:gap-3 transition-all">
                Read the full story
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// Founder portrait — John on the pitch at PlayIt Loveit, Aberdeen.
// Reinforces the "built by someone still in the trenches" positioning.
function FounderPortrait() {
  return (
    <div className="relative aspect-[4/5] rounded-3xl overflow-hidden border border-white/10 bg-[#0a0a0a]">
      <img
        src="/founder.jpg"
        alt="John Leitch — founder of Player Portal, on the pitch at PlayIt Loveit, Aberdeen"
        className="absolute inset-0 w-full h-full object-cover object-center"
      />

      {/* Bottom gradient for caption legibility */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

      {/* Caption */}
      <div className="absolute bottom-0 left-0 right-0 p-6">
        <p className="text-[10px] uppercase tracking-widest text-white/50 font-semibold">SATURDAY · 09:00</p>
        <p className="text-sm text-white/85 mt-1">Training. Where every academy decision starts.</p>
      </div>
    </div>
  )
}
