import type { LandingFAQContent } from './types'

export default function LandingFAQ({ eyebrow, headline, headlineHighlight, items }: LandingFAQContent) {
  const faqPageSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  }

  return (
    <section className="relative">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPageSchema) }}
      />
      <div className="mx-auto max-w-5xl px-6 py-32">
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
        </div>

        <div className="space-y-2">
          {items.map((qa, i) => (
            <details
              key={qa.q}
              className="group rounded-2xl border border-white/10 bg-[#0a0a0a] overflow-hidden [&_summary]:list-none open:border-[#4ecde6]/25 transition-colors"
              open={i === 0}
            >
              <summary className="cursor-pointer flex items-center justify-between gap-6 px-6 py-5 hover:bg-white/[0.02] transition-colors">
                <span className="text-lg font-semibold text-white leading-snug">{qa.q}</span>
                <span className="w-8 h-8 shrink-0 rounded-full border border-white/15 flex items-center justify-center group-open:rotate-45 group-open:border-[#4ecde6]/50 group-open:text-[#4ecde6] transition-all">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
              </summary>
              <div className="px-6 pb-6 pt-1 text-base text-white/70 leading-relaxed max-w-3xl">
                {qa.a}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
