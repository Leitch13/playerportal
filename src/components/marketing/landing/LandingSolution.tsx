import type { LandingSolutionContent } from './types'

type Props = LandingSolutionContent & {
  visual?: React.ReactNode
}

export default function LandingSolution({ eyebrow, headline, headlineHighlight, paragraphs, checklist, visual }: Props) {
  return (
    <section className="relative">
      <div className="mx-auto max-w-7xl px-6 py-32">
        <div className={visual ? 'grid lg:grid-cols-12 gap-12 items-start' : 'max-w-4xl'}>
          <div className={visual ? 'lg:col-span-7' : ''}>
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
            <div className="mt-8 space-y-5 text-lg text-white/70 max-w-2xl leading-relaxed">
              {paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>

            {checklist && checklist.length > 0 && (
              <ul className="mt-10 space-y-3 max-w-xl">
                {checklist.map((c) => (
                  <li key={c} className="flex items-start gap-3">
                    <svg className="w-5 h-5 mt-0.5 shrink-0 text-[#4ecde6]" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    <span className="text-[15px] text-white/85 leading-relaxed">{c}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {visual ? (
            <div className="lg:col-span-5">
              <div className="relative">
                <div className="absolute -inset-4 opacity-20 blur-3xl" style={{ background: 'radial-gradient(circle, #4ecde6 0%, transparent 70%)' }} />
                <div className="relative">{visual}</div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
