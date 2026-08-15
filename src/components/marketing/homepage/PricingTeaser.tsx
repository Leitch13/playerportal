import Link from 'next/link'

// Kept in sync with platform_plans (DB) and src/app/onboard/page.tsx PLATFORM_PLANS.
// Every tier includes unlimited players — the ladder is features, not member caps.
const TIERS = [
  {
    name: 'Starter',
    price: '£20',
    tag: 'Everything to go live',
    features: ['Unlimited players & classes', 'Bookings, payments & attendance', 'Free migration included'],
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
    <section id="pricing" className="relative border-t border-[#e3ebf0] bg-[#f6f9fb] scroll-mt-16">
      <div className="mx-auto max-w-7xl px-6 py-32">
        <div className="max-w-3xl mb-16">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#0a97b6] font-semibold mb-6">
            PRICING
          </p>
          <h2 className="text-4xl sm:text-5xl leading-[1.05] tracking-[-0.02em] font-black text-[#0d1b2b]">
            Simple monthly pricing.
            <br />
            <span className="text-[#93a2ad]">No player limits.</span>
          </h2>
          <p className="mt-6 text-lg text-[#5a6b7c]">
            14-day free trial. Cancel any time. No card required to start.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {TIERS.map((t) => (
            <div
              key={t.name}
              className={`rounded-3xl p-8 transition-colors bg-white ${
                t.featured
                  ? 'border-2 border-[#0a97b6] relative shadow-[0_1px_3px_rgba(13,40,54,0.05),0_18px_40px_-20px_rgba(10,151,182,0.45)]'
                  : 'border border-[#e3ebf0] hover:border-[#d3dfe6] shadow-[0_1px_3px_rgba(13,40,54,0.05),0_10px_24px_-18px_rgba(13,40,54,0.18)]'
              }`}
            >
              {t.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span
                    className="text-[10px] uppercase tracking-widest text-white px-3 py-1 rounded-full font-bold"
                    style={{ background: 'linear-gradient(170deg,#12a2bd,#0b7f96)' }}
                  >
                    Most popular
                  </span>
                </div>
              )}
              <p className="text-sm uppercase tracking-widest text-[#93a2ad] font-semibold">{t.name}</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-5xl font-black text-[#0d1b2b] tabular-nums tracking-tight">{t.price}</span>
                <span className="text-[#93a2ad] text-base">/mo</span>
              </div>
              <p className="mt-2 text-sm text-[#5a6b7c]">{t.tag}</p>
              <ul className="mt-8 space-y-3">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <svg className={`w-4 h-4 mt-0.5 shrink-0 ${t.featured ? 'text-[#0a97b6]' : 'text-emerald-600'}`} fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    <span className="text-sm text-[#0d1b2b]">{f}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <Link
                  href="/onboard"
                  className={`block text-center rounded-full py-3 text-sm font-semibold transition-opacity ${
                    t.featured
                      ? 'text-white hover:opacity-90'
                      : 'border border-[#d3dfe6] text-[#0d1b2b] hover:border-[#0a97b6]/50 hover:bg-[#eef4f7] transition-colors'
                  }`}
                  style={t.featured ? { background: 'linear-gradient(170deg,#12a2bd,#0b7f96)' } : undefined}
                >
                  Start free trial
                </Link>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link href="/how-it-works" className="text-sm text-[#5a6b7c] hover:text-[#0a97b6] transition-colors">
            See full pricing details →
          </Link>
        </div>
      </div>
    </section>
  )
}
