import type { LandingFeatureGridContent } from './types'

export default function LandingFeatureGrid({ eyebrow, headline, headlineHighlight, intro, features }: LandingFeatureGridContent) {
  return (
    <section className="relative border-t border-white/5 bg-[#080808]">
      <div className="mx-auto max-w-7xl px-6 py-32">
        <div className="max-w-3xl mb-16">
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
            <p className="mt-6 text-lg text-white/60 max-w-2xl leading-relaxed">{intro}</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f) => (
            <div
              key={f.label}
              className="group relative rounded-3xl border border-white/10 bg-[#0a0a0a] p-8 transition-colors hover:border-[#4ecde6]/30"
            >
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#4ecde6] font-semibold">{f.label}</p>
              <p className="text-xl font-bold text-white mt-2 leading-tight">{f.tagline}</p>
              <p className="mt-4 text-sm text-white/60 leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
