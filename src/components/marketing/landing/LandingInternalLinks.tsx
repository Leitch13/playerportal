import Link from 'next/link'
import { LANDING_PAGES } from './types'

type Props = {
  currentSlug: string
  eyebrow?: string
  headline?: string
}

export default function LandingInternalLinks({
  currentSlug,
  eyebrow = 'RELATED SOLUTIONS',
  headline = 'Other things Player Portal handles.',
}: Props) {
  const others = LANDING_PAGES.filter((p) => p.slug !== currentSlug)
  if (others.length === 0) return null

  return (
    <section className="relative border-t border-white/5 bg-[#080808]">
      <div className="mx-auto max-w-7xl px-6 py-24">
        <div className="max-w-3xl mb-12">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#4ecde6] font-semibold mb-6">
            {eyebrow}
          </p>
          <h2 className="text-3xl sm:text-4xl leading-[1.05] tracking-[-0.02em] font-black text-white">
            {headline}
          </h2>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {others.map((p) => (
            <Link
              key={p.slug}
              href={`/${p.slug}`}
              className="group rounded-2xl border border-white/10 bg-[#0a0a0a] p-6 transition-colors hover:border-[#4ecde6]/40"
            >
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#4ecde6] font-semibold">
                {p.shortLabel}
              </p>
              <p className="mt-2 text-lg font-bold text-white leading-tight group-hover:text-white transition-colors">
                {p.title}
              </p>
              <p className="mt-3 text-sm text-white/60 leading-relaxed">{p.description}</p>
              <p className="mt-5 inline-flex items-center gap-1.5 text-sm text-[#4ecde6] font-semibold">
                Learn more
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
