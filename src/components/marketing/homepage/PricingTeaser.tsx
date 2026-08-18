import Link from 'next/link'

// Kept in sync with platform_plans (DB) and src/app/onboard/page.tsx PLATFORM_PLANS.
// ONE plan since 2026-08: £35/mo + 3.5% all-in, everything included.
const FEATURES = [
  'Unlimited players, classes & coaches',
  'Bookings, payments & attendance',
  'Waitlists, referrals & messaging',
  'Progress reviews & analytics',
  'Camps, events & merch shop',
  'White-label branding',
  'Free migration from any provider',
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
            One plan. Everything included.
            <br />
            <span className="text-[#93a2ad]">No player limits. No tiers.</span>
          </h2>
          <p className="mt-6 text-lg text-[#5a6b7c]">
            14-day free trial. Cancel any time. No card required to start.
          </p>
        </div>

        <div className="mx-auto max-w-lg">
          <div className="rounded-3xl p-10 bg-white border-2 border-[#0a97b6] relative shadow-[0_1px_3px_rgba(13,40,54,0.05),0_18px_40px_-20px_rgba(10,151,182,0.45)]">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span
                className="text-[10px] uppercase tracking-widest text-white px-3 py-1 rounded-full font-bold"
                style={{ background: 'linear-gradient(170deg,#12a2bd,#0b7f96)' }}
              >
                Everything included
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-6xl font-black text-[#0d1b2b] tabular-nums tracking-tight">£35</span>
              <span className="text-[#93a2ad] text-lg">/mo</span>
            </div>
            <p className="mt-3 text-base font-semibold text-[#0d1b2b]">
              + 3.5% per transaction — you keep 96.5p of every pound.
            </p>
            <p className="mt-1 text-sm text-[#5a6b7c]">
              That covers card processing too. No booking fees for parents. No surprises.
            </p>
            <ul className="mt-8 space-y-3">
              {FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5">
                  <svg className="w-4 h-4 mt-0.5 shrink-0 text-[#0a97b6]" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  <span className="text-sm text-[#0d1b2b]">{f}</span>
                </li>
              ))}
            </ul>
            <div className="mt-10">
              <Link
                href="/onboard"
                className="block text-center rounded-full py-3.5 text-base font-semibold text-white hover:opacity-90 transition-opacity"
                style={{ background: 'linear-gradient(170deg,#12a2bd,#0b7f96)' }}
              >
                Start free trial
              </Link>
            </div>
          </div>
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
