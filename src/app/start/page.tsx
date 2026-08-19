import type { Metadata } from 'next'
import Link from 'next/link'
import FunnelForm from './FunnelForm'

// Ad-traffic landing page: one page, one promise, one CTA. Deliberately no
// site nav (no escape hatches) and noindex — this exists for paid clicks,
// not search. Copy mirrors the homepage's verified proof numbers; keep in
// sync with NumbersProof.tsx when those refresh.
export const metadata: Metadata = {
  title: 'Get Your Academy’s Booking Page Built Free | Player Portal',
  description:
    'We’ll build your football academy a branded booking page — free, within 24 hours, before you pay a penny. Bookings, memberships and auto-billing in one place.',
  robots: { index: false, follow: false },
}

const STATS = [
  { number: '£23k+', label: 'processed through Player Portal — live Stripe, not projections' },
  { number: '180+', label: 'members migrated for one academy in a single afternoon' },
  { number: '100%', label: 'of subscriptions collected via auto-billing — nobody chases anyone' },
]

const STEPS = [
  { title: 'Tell us about your academy', body: 'The form takes 60 seconds. Name, academy, how many players. That’s it.' },
  { title: 'We build your page within 24 hours', body: 'Your name, your colours, example classes — exactly what parents would see. It lands in your inbox, free.' },
  { title: 'Love it? Go live.', body: 'We migrate your members for free. 14-day free trial, then one plan: £35/month + 3.5% per transaction — you keep 96.5p of every pound. Cancel anytime.' },
]

const FAQS = [
  {
    q: 'What does it cost?',
    a: 'The demo page costs nothing — it’s free whether you sign up or not. If you go live: £35/month + 3.5% per transaction, all-in. That covers card processing too. No booking fees for parents, no player limits, no tiers.',
  },
  {
    q: 'Do I have to move my members over myself?',
    a: 'No — we do the migration for you, free. One academy moved 180+ members over in a single afternoon with zero double-charges.',
  },
  {
    q: 'Am I tied into a contract?',
    a: 'No. Monthly rolling, cancel anytime. The 14-day trial doesn’t need a card to start.',
  },
]

export default function StartPage() {
  return (
    <div className="min-h-screen bg-[#f6f9fb] text-[#0d1b2b]">
      {/* Slim bar — logo only, no nav: ad traffic gets one job to do */}
      <header className="px-6 py-4">
        <div className="mx-auto max-w-6xl flex items-center justify-between">
          <img src="/logo.png" alt="Player Portal" className="h-9 w-auto object-contain" />
          <span className="hidden sm:inline text-xs text-[#93a2ad]">Built by an academy owner</span>
        </div>
      </header>

      {/* Hero + form */}
      <section className="px-6 pt-8 pb-16 sm:pt-14">
        <div className="mx-auto max-w-6xl grid lg:grid-cols-2 gap-10 lg:gap-16 items-start">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#0a97b6] font-semibold">For football academy owners</p>
            <h1 className="mt-5 text-4xl sm:text-5xl leading-[1.05] tracking-[-0.02em] font-black" style={{ textWrap: 'balance' } as React.CSSProperties}>
              We&apos;ll build your academy&apos;s booking page.
              <span className="text-[#0a97b6]"> Free.</span>
            </h1>
            <p className="mt-5 text-lg text-[#5a6b7c] max-w-xl">
              See your academy — your name, your colours, your classes — running on the platform that already collects
              thousands a month for academies like yours. Before you pay a penny.
            </p>
            <ul className="mt-6 space-y-2.5">
              {['Bookings, memberships & auto-billing in one place', 'Parents book and pay from their phone in under 2 minutes', 'Free migration — we move your members for you'].map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-[15px]">
                  <svg className="w-4 h-4 mt-1 shrink-0 text-[#0a97b6]" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 grid grid-cols-3 gap-4 max-w-md">
              {STATS.map((s) => (
                <div key={s.number}>
                  <div className="text-2xl font-black text-[#0d1b2b] tabular-nums">{s.number}</div>
                  <div className="mt-1 text-[11px] leading-snug text-[#93a2ad]">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div id="form" className="lg:sticky lg:top-6">
            <FunnelForm />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 py-16 bg-white border-y border-[#e3ebf0]">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl font-black tracking-[-0.02em]">How it works</h2>
          <div className="mt-8 grid sm:grid-cols-3 gap-6">
            {STEPS.map((s, i) => (
              <div key={s.title} className="rounded-2xl border border-[#e3ebf0] bg-[#f6f9fb] p-6">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-black" style={{ background: 'linear-gradient(170deg,#12a2bd,#0b7f96)' }}>{i + 1}</div>
                <h3 className="mt-4 font-bold text-lg">{s.title}</h3>
                <p className="mt-2 text-sm text-[#5a6b7c] leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-black tracking-[-0.02em]">Fair questions</h2>
          <div className="mt-8 space-y-6">
            {FAQS.map((f) => (
              <div key={f.q} className="rounded-2xl bg-white border border-[#e3ebf0] p-6">
                <h3 className="font-bold">{f.q}</h3>
                <p className="mt-2 text-sm text-[#5a6b7c] leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <a href="#form" className="inline-block rounded-full px-8 py-4 text-base font-bold text-white hover:opacity-90 transition-opacity" style={{ background: 'linear-gradient(170deg,#12a2bd,#0b7f96)' }}>
              Build my free booking page →
            </a>
            <p className="mt-3 text-xs text-[#93a2ad]">60 seconds. No card. No commitment.</p>
          </div>
        </div>
      </section>

      <footer className="px-6 py-8 border-t border-[#e3ebf0]">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#93a2ad]">
          <span>© {new Date().getFullYear()} Player Portal</span>
          <div className="flex gap-5">
            <Link href="/privacy" className="hover:text-[#0a97b6]">Privacy</Link>
            <Link href="/" className="hover:text-[#0a97b6]">theplayerportal.net</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
