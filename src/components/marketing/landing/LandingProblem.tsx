import type { LandingProblemContent } from './types'

export default function LandingProblem({ eyebrow, headline, headlineHighlight, body, punchline, beforeCard, afterCard }: LandingProblemContent) {
  return (
    <section className="relative">
      <div className="mx-auto max-w-7xl px-6 py-32">
        <div className="max-w-4xl">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#4ecde6] font-semibold mb-6">
            {eyebrow}
          </p>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl leading-[1.05] tracking-[-0.02em] font-black text-white">
            {headline}
            {headlineHighlight ? (
              <>
                <br />
                <span className="text-white/50">{headlineHighlight}</span>
              </>
            ) : null}
          </h2>
          <p className="mt-8 text-lg text-white/60 max-w-2xl leading-relaxed">
            {body}
          </p>
          <p className="mt-3 text-lg text-white/80 max-w-2xl leading-relaxed font-medium">
            {punchline}
          </p>
        </div>

        {(beforeCard || afterCard) && (
          <div className="mt-20 grid lg:grid-cols-2 gap-6">
            {beforeCard && (
              <div className="rounded-2xl border border-white/10 bg-[#0f0f0f] p-8">
                <p className="text-xs uppercase tracking-widest text-white/40 font-semibold mb-4">Before</p>
                <p className="text-lg font-bold text-white mb-6">{beforeCard.title}</p>
                <p className="text-sm text-white/50 mb-6 leading-relaxed">{beforeCard.subtitle}</p>
                <div className="space-y-2">
                  {beforeCard.items.map((c) => (
                    <div key={c.label} className="flex items-center gap-3 rounded-lg bg-white/[0.03] border border-white/5 px-3 py-2.5">
                      <span className="text-lg grayscale opacity-60">{c.icon}</span>
                      <span className="text-sm text-white/80 flex-1 font-medium">{c.label}</span>
                      <span className="text-xs text-white/40 font-mono">{c.tail}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {afterCard && (
              <div className="rounded-2xl border border-[#4ecde6]/25 bg-gradient-to-br from-[#4ecde6]/[0.03] to-transparent p-8 relative overflow-hidden">
                <div className="absolute -top-32 -right-32 w-64 h-64 rounded-full opacity-20 blur-3xl" style={{ background: 'radial-gradient(circle, #4ecde6 0%, transparent 70%)' }} />
                <div className="relative">
                  <p className="text-xs uppercase tracking-widest text-[#4ecde6] font-semibold mb-4">After</p>
                  <p className="text-lg font-bold text-white mb-6">{afterCard.title}</p>
                  <p className="text-sm text-white/50 mb-6 leading-relaxed">{afterCard.subtitle}</p>
                  <div className="rounded-xl border border-white/10 bg-[#0f0f0f] p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-6 h-6 rounded-md bg-[#4ecde6]/20 flex items-center justify-center">
                        <span className="text-[10px] font-black text-[#4ecde6]">P</span>
                      </div>
                      <span className="text-sm font-bold text-white">Player Portal</span>
                    </div>
                    <div className="space-y-2">
                      {afterCard.bullets.map((f) => (
                        <div key={f} className="flex items-center gap-2">
                          <svg className="w-3.5 h-3.5 text-[#4ecde6]" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          <span className="text-xs text-white/80 font-medium">{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className="mt-6 text-sm text-white/60">{afterCard.closingLine}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
