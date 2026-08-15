import Link from 'next/link'

export default function FounderStory() {
  return (
    <section id="why" className="relative border-y border-[#e3ebf0] bg-[#eef4f7] scroll-mt-16">
      <div className="mx-auto max-w-7xl px-6 py-32">
        <div className="grid lg:grid-cols-12 gap-16 items-center">
          {/* Portrait placeholder */}
          <div className="lg:col-span-5 order-2 lg:order-1">
            <div className="relative">
              <div className="absolute -inset-6 opacity-15 blur-3xl" style={{ background: 'radial-gradient(circle, #14a7c2 0%, transparent 70%)' }} />
              <FounderPortrait />
            </div>
          </div>

          {/* Copy */}
          <div className="lg:col-span-7 order-1 lg:order-2">
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#0a97b6] font-semibold mb-6">
              BUILT BY AN ACADEMY
            </p>
            <blockquote className="text-3xl sm:text-4xl lg:text-5xl leading-[1.15] tracking-[-0.02em] font-black text-[#0d1b2b]">
              &ldquo;I got tired of paying £120 a month for software
              that couldn&apos;t tell me who owed me money.
              <span className="text-[#93a2ad]"> So I built the thing I wished I&apos;d had.&rdquo;</span>
            </blockquote>
            <div className="mt-10 flex items-center gap-4">
              <div className="w-1 h-12 bg-[#0a97b6] rounded-full" />
              <div>
                <p className="text-[#0d1b2b] font-bold">John Leitch</p>
                <p className="text-sm text-[#5a6b7c]">Academy operator &middot; Founder, Player Portal</p>
              </div>
            </div>
            <p className="mt-8 text-lg text-[#5a6b7c] leading-relaxed max-w-2xl">
              Every other academy platform was built by developers who saw an opportunity. Player Portal was built by someone still in the trenches — running an academy, dealing with parents, chasing payments, and taking training on Saturday mornings.
            </p>
            <div className="mt-8">
              <Link href="/how-it-works" className="inline-flex items-center gap-2 text-[#0a97b6] font-semibold text-sm hover:gap-3 transition-all">
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
    <div className="relative aspect-[4/5] rounded-3xl overflow-hidden border border-[#e3ebf0] bg-white shadow-[0_1px_3px_rgba(13,40,54,0.05),0_10px_24px_-18px_rgba(13,40,54,0.18)]">
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
