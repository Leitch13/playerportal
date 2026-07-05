import type { LandingWhyContent } from './types'

export default function LandingWhyBar({ eyebrow, headline, headlineHighlight, intro, points }: LandingWhyContent) {
  return (
    <section className="relative border-t border-white/5 bg-[#080808]">
      <div className="mx-auto max-w-7xl px-6 py-32">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#4ecde6] font-semibold mb-6">
            {eyebrow}
          </p>
          <h2 className="text-4xl sm:text-5xl leading-[1.05] tracking-[-0.02em] font-black text-white">
            {headline}
            {headlineHighlight ? (
              <>
                <br />
                <span className="text-white/50">{headlineHighlight}</span>
              </>
            ) : null}
          </h2>
          {intro && (
            <p className="mt-8 text-lg text-white/60 max-w-3xl mx-auto leading-relaxed">{intro}</p>
          )}
        </div>

        <div className="mt-16 grid md:grid-cols-3 gap-4">
          {points.map((p) => (
            <div key={p.label} className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-8 text-center">
              <p className="text-4xl lg:text-5xl font-black text-[#4ecde6] tabular-nums tracking-tight">
                {p.stat}
              </p>
              <p className="mt-3 text-lg font-bold text-white">{p.label}</p>
              <p className="mt-2 text-sm text-white/60 leading-relaxed">{p.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
