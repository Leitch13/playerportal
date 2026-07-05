import Link from 'next/link'

// Kept in sync with platform_plans (DB) and src/app/onboard/page.tsx PLATFORM_PLANS.
// Every tier includes unlimited players — the ladder is features, not member caps.
const TIERS = [
  {
    name: 'Starter',
    price: '£20',
    tag: 'Everything to go live',
    features: ['Unlimited players & classes', 'Bookings, payments & attendance', 'Migration from ClassForKids'],
    featured: false,
  },
  {
    name: 'Pro',
    price: '£35',
    tag: 'Retention & growth',
    features: ['Everything in Starter', 'Waitlists, referrals, messaging', 'Progress reviews & analytics'],
    featured: true,
  },
  {
    name: 'Enterprise',
    price: '£60',
    tag: 'White-label & scale',
    features: ['Everything in Pro', 'Custom branding, merch shop, API', 'Priority support & onboarding'],
    featured: false,
  },
]

export default function PricingTeaser() {
  return (
    <section id="pricing" className="relative border-t border-white/5 bg-[#080808] scroll-mt-16">
      <div className="mx-auto max-w-7xl px-6 py-32">
        <div className="max-w-3xl mb-16">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#4ecde6] font-semibold mb-6">
            PRICING
          </p>
          <h2 className="text-4xl sm:text-5xl leading-[1.05] tracking-[-0.02em] font-black text-white">
            Simple monthly pricing.
            <br />
            <span className="text-white/50">No player limits.</span>
          </h2>
          <p className="mt-6 text-lg text-white/60">
            14-day free trial. Cancel any time. No card required to start.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {TIERS.map((t) => (
            <div
              key={t.name}
              className={`rounded-3xl p-8 transition-colors ${
                t.featured
                  ? 'border-2 border-[#4ecde6] bg-[#4ecde6]/[0.04] relative'
                  : 'border border-white/10 bg-[#0a0a0a] hover:border-white/25'
              }`}
            >
              {t.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="text-[10px] uppercase tracking-widest bg-[#4ecde6] text-black px-3 py-1 rounded-full font-bold">
                    Most popular
                  </span>
                </div>
              )}
              <p className="text-sm uppercase tracking-widest text-white/50 font-semibold">{t.name}</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-5xl font-black text-white tabular-nums tracking-tight">{t.price}</span>
                <span className="text-white/50 text-base">/mo</span>
              </div>
              <p className="mt-2 text-sm text-white/60">{t.tag}</p>
              <ul className="mt-8 space-y-3">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <svg className={`w-4 h-4 mt-0.5 shrink-0 ${t.featured ? 'text-[#4ecde6]' : 'text-emerald-400'}`} fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    <span className="text-sm text-white/80">{f}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <Link
                  href="/onboard"
                  className={`block text-center rounded-full py-3 text-sm font-semibold transition-colors ${
                    t.featured
                      ? 'bg-[#4ecde6] text-black hover:bg-[#6eddf2]'
                      : 'border border-white/20 text-white hover:border-[#4ecde6]/50 hover:bg-[#4ecde6]/5'
                  }`}
                >
                  Start free trial
                </Link>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link href="/how-it-works" className="text-sm text-white/50 hover:text-[#4ecde6] transition-colors">
            See full pricing details →
          </Link>
        </div>
      </div>
    </section>
  )
}
