import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Player Portal — The All-in-One Platform for Football Academies',
  description: 'Manage players, track progress, handle payments, and keep parents engaged. Start free today.',
}

const features = [
  { icon: '⚽', title: 'Player Management', desc: 'Track every player from signup to graduation with profiles, medical info, and development history.' },
  { icon: '📊', title: 'Progress Reviews', desc: '6-category scoring with radar charts and parent-friendly summaries. Show parents real value.' },
  { icon: '💳', title: 'Automated Payments', desc: 'Stripe-powered billing with monthly or quarterly options. Auto-chase overdue payments.' },
  { icon: '📅', title: 'Smart Scheduling', desc: 'Capacity caps, waitlists, and real-time availability. Parents book in seconds.' },
  { icon: '👨‍👩‍👧', title: 'Parent Portal', desc: 'Stunning dashboard with weekly digests, live notifications, and full visibility into progress.' },
  { icon: '📱', title: 'Mobile First', desc: 'Installable PWA that works beautifully on every device. Feels like a native app.' },
  { icon: '🏆', title: 'Achievements', desc: 'Celebrate milestones with badges and certificates. Keep kids motivated and parents engaged.' },
  { icon: '🎁', title: 'Referral Engine', desc: 'Automated referral tracking with unique codes. Turn happy parents into your growth engine.' },
  { icon: '📸', title: 'Photo Gallery', desc: 'Share session photos in a beautiful, secure gallery. Parents absolutely love this.' },
]

const steps = [
  { num: '01', title: 'Sign Up', desc: 'Create your academy account in under 2 minutes. No credit card required.' },
  { num: '02', title: 'Set Up Classes', desc: 'Add sessions, coaches, pricing, and capacity. We guide you through it.' },
  { num: '03', title: 'Go Live', desc: 'Share your booking page. Watch signups, payments, and reviews flow in automatically.' },
]

const plans = [
  {
    name: 'Starter',
    price: 'Free',
    period: '',
    desc: 'Perfect for small academies getting started.',
    features: ['Up to 30 players', '1 coach account', 'Basic scheduling', 'Payment collection', 'Community support'],
    cta: 'Get Started Free',
    featured: false,
  },
  {
    name: 'Pro',
    price: '£49',
    period: '/mo',
    desc: 'For growing academies that need everything.',
    features: ['Up to 200 players', 'Unlimited coaches', 'All features included', 'Progress reviews & reports', 'Priority support', 'Custom branding'],
    cta: 'Start Free Trial',
    featured: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    desc: 'For multi-site academies and large orgs.',
    features: ['Unlimited everything', 'Dedicated account manager', 'API access', 'White-label option', 'SLA guarantee', 'Onboarding support'],
    cta: 'Contact Sales',
    featured: false,
  },
]

const testimonials = [
  {
    quote: 'Player Portal completely transformed how we run our academy. Parents love it, payments come in on time, and I save 10+ hours a week.',
    name: 'Marcus Thompson',
    role: 'Head Coach & Owner',
    academy: 'Southside FA',
  },
  {
    quote: 'We went from spreadsheets and WhatsApp to a proper system overnight. The progress reviews alone have been a game-changer.',
    name: 'Sarah Mitchell',
    role: 'Academy Director',
    academy: 'North London Elite',
  },
  {
    quote: 'The referral system paid for itself in month one. We grew from 40 to 120 players in six months.',
    name: 'James Okafor',
    role: 'Founder',
    academy: 'Premier Skills',
  },
]

export default function Home() {
  return (
    <div className="min-h-screen bg-[#060606] text-white overflow-hidden">
      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 glass-dark border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#4ecde6] to-[#2ba8c3] flex items-center justify-center shadow-lg shadow-[#4ecde6]/20">
              <span className="text-white font-extrabold text-xs">PP</span>
            </div>
            <span className="text-lg font-bold tracking-tight">Player Portal</span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-white/50 hover:text-white transition-colors font-medium">Features</a>
            <Link href="/how-it-works" className="text-sm text-white/50 hover:text-white transition-colors font-medium">How It Works</Link>
            <a href="#pricing" className="text-sm text-white/50 hover:text-white transition-colors font-medium">Pricing</a>
            <a href="#testimonials" className="text-sm text-white/50 hover:text-white transition-colors font-medium">Testimonials</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/auth/signin" className="hidden sm:inline-flex px-4 py-2 text-sm font-medium text-white/60 hover:text-white transition-all">
              Log in
            </Link>
            <Link
              href="/onboard"
              className="px-5 py-2.5 text-sm font-semibold bg-white text-[#0a0a0a] rounded-full hover:bg-white/90 transition-all shadow-lg"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative">
        {/* Background layers */}
        <div className="absolute inset-0 animated-gradient" />
        <div className="absolute inset-0 bg-cover bg-center opacity-20 mix-blend-luminosity" style={{ backgroundImage: 'url(/hero-banner.png)' }} />
        {/* Gradient orbs */}
        <div className="absolute top-10 left-[15%] w-[500px] h-[500px] bg-[#4ecde6]/15 rounded-full blur-[150px] animate-glow" />
        <div className="absolute bottom-10 right-[15%] w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-[120px] animate-glow" style={{ animationDelay: '1.5s' }} />
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '64px 64px' }} />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20 sm:pt-32 sm:pb-28 text-center">
          {/* Trust badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.05] border border-white/[0.08] text-sm text-white/50 mb-10 animate-fade-in">
            <span className="relative inline-block w-2 h-2 rounded-full bg-emerald-400">
              <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
            </span>
            Trusted by 50+ football academies across the UK
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-8xl font-extrabold tracking-[-0.03em] leading-[0.95] mb-8 animate-slide-up">
            Run your academy
            <br />
            <span className="gradient-text">like a pro</span>
          </h1>

          <p className="max-w-2xl mx-auto text-lg sm:text-xl text-white/40 mb-12 leading-relaxed animate-slide-up" style={{ animationDelay: '0.1s' }}>
            Players. Progress. Payments. Parents.
            <br className="hidden sm:block" />
            One platform that handles it all — so you can focus on coaching.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-20 animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <Link
              href="/onboard"
              className="group relative px-8 py-4 bg-[#4ecde6] text-[#0a0a0a] rounded-full font-bold text-lg hover:scale-[1.03] transition-all glow-accent"
            >
              Start Free Trial
              <span className="inline-block ml-2 group-hover:translate-x-1 transition-transform">&rarr;</span>
            </Link>
            <a
              href="#how-it-works"
              className="px-8 py-4 border border-white/15 text-white/70 rounded-full font-semibold text-lg hover:bg-white/5 hover:text-white hover:border-white/25 transition-all"
            >
              See How It Works
            </a>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-6 max-w-lg mx-auto animate-slide-up" style={{ animationDelay: '0.3s' }}>
            {[
              { value: '50+', label: 'Academies' },
              { value: '3,000+', label: 'Players' },
              { value: '4.9★', label: 'Rating' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl sm:text-3xl font-extrabold tracking-tight">{stat.value}</div>
                <div className="text-xs text-white/30 mt-1 uppercase tracking-wider font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Fade to next section */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#060606] to-transparent" />
      </section>

      {/* ── Features ── */}
      <section id="features" className="relative py-24 sm:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex px-3 py-1 rounded-full bg-[#4ecde6]/10 text-[#4ecde6] text-xs font-semibold uppercase tracking-wider mb-4">
              Features
            </div>
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-5">
              Everything your academy needs
            </h2>
            <p className="text-white/40 text-lg max-w-2xl mx-auto leading-relaxed">
              From player registration to parent engagement — every tool to run a world-class football academy.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <div
                key={f.title}
                className="group relative bg-white/[0.02] border border-white/[0.06] rounded-2xl p-7 hover:bg-white/[0.04] hover:border-[#4ecde6]/20 transition-all duration-300"
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                <div className="w-12 h-12 rounded-xl bg-white/[0.05] flex items-center justify-center text-2xl mb-5 group-hover:bg-[#4ecde6]/10 group-hover:scale-110 transition-all duration-300">
                  {f.icon}
                </div>
                <h3 className="text-base font-bold mb-2 group-hover:text-[#4ecde6] transition-colors">{f.title}</h3>
                <p className="text-sm text-white/40 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" className="relative py-24 sm:py-32">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/[0.01] to-transparent" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex px-3 py-1 rounded-full bg-[#4ecde6]/10 text-[#4ecde6] text-xs font-semibold uppercase tracking-wider mb-4">
              How it works
            </div>
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-5">
              Live in minutes, not months
            </h2>
            <p className="text-white/40 text-lg max-w-xl mx-auto">
              No complex setup. No training needed. Three steps and you&apos;re done.
            </p>
          </div>
          <div className="relative grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Connecting line */}
            <div className="hidden md:block absolute top-16 left-[calc(16.67%+2rem)] right-[calc(16.67%+2rem)] h-px">
              <div className="h-full bg-gradient-to-r from-[#4ecde6]/30 via-[#4ecde6]/10 to-[#4ecde6]/30" />
            </div>
            {steps.map((s) => (
              <div key={s.num} className="relative text-center group">
                <div className="relative inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/[0.08] mb-6 group-hover:border-[#4ecde6]/30 group-hover:from-[#4ecde6]/10 group-hover:to-[#4ecde6]/5 transition-all duration-300">
                  <span className="text-2xl font-extrabold gradient-text">{s.num}</span>
                </div>
                <h3 className="text-lg font-bold mb-2">{s.title}</h3>
                <p className="text-sm text-white/40 leading-relaxed max-w-xs mx-auto">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="relative py-24 sm:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex px-3 py-1 rounded-full bg-[#4ecde6]/10 text-[#4ecde6] text-xs font-semibold uppercase tracking-wider mb-4">
              Pricing
            </div>
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-5">
              Simple, transparent pricing
            </h2>
            <p className="text-white/40 text-lg max-w-xl mx-auto">
              Start free. Upgrade when you&apos;re ready. Cancel anytime.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto items-start">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl p-8 flex flex-col transition-all duration-300 ${
                  plan.featured
                    ? 'bg-gradient-to-b from-[#4ecde6]/[0.08] to-transparent border-2 border-[#4ecde6]/30 shadow-2xl shadow-[#4ecde6]/10 md:scale-105 md:-my-4'
                    : 'bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12]'
                }`}
              >
                {plan.featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-[#4ecde6] to-[#2ba8c3] text-white text-[11px] font-bold rounded-full uppercase tracking-wider shadow-lg">
                    Most Popular
                  </div>
                )}
                <div className="mb-8">
                  <h3 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-3">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mb-2">
                    <span className="text-4xl font-extrabold tracking-tight">{plan.price}</span>
                    {plan.period && <span className="text-white/30 text-sm font-medium">{plan.period}</span>}
                  </div>
                  <p className="text-sm text-white/30">{plan.desc}</p>
                </div>
                <ul className="space-y-3.5 mb-8 flex-1">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-3 text-sm text-white/50">
                      <svg className="w-4 h-4 mt-0.5 text-[#4ecde6] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      {feat}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/onboard"
                  className={`block text-center py-3.5 rounded-full font-semibold text-sm transition-all ${
                    plan.featured
                      ? 'bg-[#4ecde6] text-[#0a0a0a] hover:bg-[#7dddf0] shadow-lg shadow-[#4ecde6]/20 glow-accent'
                      : 'border border-white/15 text-white/70 hover:bg-white/5 hover:text-white hover:border-white/25'
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section id="testimonials" className="relative py-24 sm:py-32">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/[0.01] to-transparent" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex px-3 py-1 rounded-full bg-[#4ecde6]/10 text-[#4ecde6] text-xs font-semibold uppercase tracking-wider mb-4">
              Testimonials
            </div>
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-5">
              Loved by academy owners
            </h2>
            <p className="text-white/40 text-lg max-w-xl mx-auto">
              See why coaches across the UK trust Player Portal to run their business.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div
                key={t.name}
                className="relative bg-white/[0.02] border border-white/[0.06] rounded-2xl p-8 hover:border-white/[0.12] transition-all duration-300"
              >
                {/* Stars */}
                <div className="flex gap-0.5 mb-5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <svg key={i} className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  ))}
                </div>
                <blockquote className="text-white/60 text-sm leading-relaxed mb-6">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#4ecde6]/20 to-[#4ecde6]/5 flex items-center justify-center">
                    <span className="text-sm font-bold text-[#4ecde6]">{t.name[0]}</span>
                  </div>
                  <div>
                    <div className="font-semibold text-sm">{t.name}</div>
                    <div className="text-xs text-white/30">{t.role} &middot; {t.academy}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="relative py-24 sm:py-32">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#4ecde6]/[0.03] to-transparent" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-6">
            Ready to transform
            <br />
            <span className="gradient-text">your academy?</span>
          </h2>
          <p className="text-white/40 text-lg mb-10 max-w-xl mx-auto">
            Join 50+ football academies already saving time, impressing parents, and growing faster with Player Portal.
          </p>
          <Link
            href="/onboard"
            className="inline-flex px-10 py-5 bg-[#4ecde6] text-[#0a0a0a] rounded-full font-bold text-lg hover:scale-[1.03] transition-all glow-accent"
          >
            Get Started Free &mdash; No Card Required
          </Link>
          <p className="mt-8 text-sm text-white/30">
            Or{' '}
            <a href="mailto:hello@playerportal.io" className="text-[#4ecde6]/70 underline underline-offset-2 hover:text-[#4ecde6] transition-colors">
              book a demo
            </a>{' '}
            with our team
          </p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.06] py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-md bg-gradient-to-br from-[#4ecde6] to-[#2ba8c3] flex items-center justify-center">
                <span className="text-white font-bold text-[8px]">PP</span>
              </div>
              <span className="text-sm font-semibold text-white/60">Player Portal</span>
            </div>
            <div className="flex gap-8 text-sm text-white/30">
              <a href="#features" className="hover:text-white/60 transition-colors">Features</a>
              <a href="#pricing" className="hover:text-white/60 transition-colors">Pricing</a>
              <Link href="/terms" className="hover:text-white/60 transition-colors">Terms</Link>
              <Link href="/privacy" className="hover:text-white/60 transition-colors">Privacy</Link>
            </div>
            <div className="text-xs text-white/20">
              &copy; {new Date().getFullYear()} Player Portal. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
