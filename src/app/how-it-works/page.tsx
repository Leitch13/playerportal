import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'How It Works',
  description: 'Sign up, set up your academy, and go live in under 10 minutes. See how Player Portal works step by step.',
}

/* ── Data ── */

const journeySteps = [
  {
    num: '01',
    title: 'Sign Up',
    time: '2 minutes',
    items: [
      'Go to playerportal.com/onboard',
      'Enter academy name, contact details, and slug',
      'Choose your branding colours',
      'Create your admin account',
    ],
    visual: 'screenshot',
  },
  {
    num: '02',
    title: 'Set Up Your Academy',
    time: '5 minutes',
    items: [
      'Create your classes (name, day, time, capacity, age group, price)',
      'Add coaches and assign them to classes',
      'Set up subscription plans (monthly, quarterly with 10% off)',
      'Upload your logo and branding',
    ],
    visual: 'checklist',
  },
  {
    num: '03',
    title: 'Invite Parents',
    time: '2 minutes',
    items: [
      'Share your unique booking page: playerportal.com/book/your-academy',
      'Share individual class links on WhatsApp, Instagram, flyers',
      'Parents sign up, book classes, and pay \u2014 all automated',
      'Referral system kicks in \u2014 parents invite other parents',
    ],
    visual: 'phone',
  },
  {
    num: '04',
    title: 'Run & Grow',
    time: 'ongoing',
    items: [
      'Coaches mark attendance via QR code or app',
      'Progress reviews auto-email to parents',
      'Payments auto-collect, reminders auto-send',
      'Waitlists auto-manage when classes fill up',
      'Analytics dashboard tracks everything',
    ],
    visual: 'dashboard',
  },
]

const academyFeatures = [
  'Class builder with capacity caps',
  'Automated payments via Stripe',
  'Coach session management',
  'Player progress tracking',
  'Bulk announcements',
  'CSV exports & reports',
  'Waitlist management',
  'Trial class bookings',
  'Referral tracking',
  'Revenue analytics',
]

const parentFeatures = [
  'Beautiful mobile dashboard',
  'Book & pay in 60 seconds',
  'Live progress reports',
  'Session reminders (email + app)',
  'QR code check-in',
  'Refer a friend rewards',
  'Printable progress reports',
  'Payment receipts & invoices',
]

const plans = [
  {
    name: 'Starter',
    price: 'Free',
    period: '',
    desc: 'Perfect for small academies getting started.',
    features: [
      'Up to 30 players',
      '1 coach account',
      'Basic scheduling',
      'Payment collection via Stripe',
      'Parent self-service booking',
      'Community support',
    ],
    cta: 'Get Started Free',
    featured: false,
  },
  {
    name: 'Pro',
    price: '\u00a349',
    period: '/mo',
    desc: 'For growing academies that need everything.',
    features: [
      'Up to 200 players',
      'Unlimited coaches',
      'All Starter features included',
      'Progress reviews & radar charts',
      'Automated payment reminders',
      'Waitlist management',
      'Custom branding & colours',
      'Referral tracking & rewards',
      'CSV exports & reports',
      'Priority email & chat support',
    ],
    cta: 'Start Free Trial',
    featured: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    desc: 'For multi-site academies and large organisations.',
    features: [
      'Unlimited players & coaches',
      'All Pro features included',
      'Dedicated account manager',
      'API access & integrations',
      'White-label option',
      'SLA guarantee',
      'Onboarding & migration support',
      'Custom feature development',
    ],
    cta: 'Contact Sales',
    featured: false,
  },
]

const faqs = [
  {
    q: 'How long does setup take?',
    a: 'Under 10 minutes. Most academies are fully set up and accepting bookings within their first session.',
  },
  {
    q: 'Do I need technical skills?',
    a: 'Not at all. Everything is point-and-click. If you can use WhatsApp, you can use Player Portal.',
  },
  {
    q: 'Can I migrate existing players?',
    a: 'Yes. You can import your existing player list via CSV upload and they\u2019ll be ready to go instantly.',
  },
  {
    q: 'How do payments work?',
    a: 'We use Stripe, which means money goes straight to your bank account. Parents can pay by card, Apple Pay, or Google Pay.',
  },
  {
    q: 'What about GDPR?',
    a: 'Fully compliant. All data is stored in UK/EU data centres. We handle consent management and data subject requests.',
  },
  {
    q: 'Can parents pay monthly or upfront?',
    a: 'Both. You can offer monthly subscriptions and quarterly plans. Quarterly automatically includes a 10% discount.',
  },
  {
    q: 'What if a class is full?',
    a: 'Players are automatically added to a waitlist and notified the moment a space opens up. No manual chasing needed.',
  },
  {
    q: 'Can I sell merchandise?',
    a: 'Yes. You can sell branded kit with personalisation options directly through your academy\u2019s portal.',
  },
  {
    q: 'Is there a contract?',
    a: 'No. All plans are pay-as-you-go and you can cancel anytime. No lock-ins, no hidden fees.',
  },
  {
    q: 'How do I get support?',
    a: 'Pro plans get priority email and chat support. Starter plans have access to our community forum and knowledge base.',
  },
]

/* ── Visual icons for each step ── */

function StepVisual({ type }: { type: string }) {
  if (type === 'screenshot') {
    return (
      <div className="w-full aspect-[4/3] rounded-xl bg-white/[0.03] border border-white/[0.08] flex flex-col items-center justify-center gap-3 p-6">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#4ecde6]/20 to-[#4ecde6]/5 flex items-center justify-center">
          <svg className="w-7 h-7 text-[#4ecde6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
          </svg>
        </div>
        <div className="text-xs text-white/30 font-medium text-center">Academy setup screen</div>
      </div>
    )
  }
  if (type === 'checklist') {
    return (
      <div className="w-full aspect-[4/3] rounded-xl bg-white/[0.03] border border-white/[0.08] flex flex-col justify-center gap-3 p-6">
        {['Classes created', 'Coaches assigned', 'Plans configured', 'Branding uploaded'].map((item) => (
          <div key={item} className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-full bg-[#4ecde6]/20 flex items-center justify-center shrink-0">
              <svg className="w-3 h-3 text-[#4ecde6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="text-sm text-white/50">{item}</span>
          </div>
        ))}
      </div>
    )
  }
  if (type === 'phone') {
    return (
      <div className="w-full aspect-[4/3] rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center p-6">
        <div className="w-28 h-48 rounded-2xl border-2 border-white/10 bg-white/[0.02] flex flex-col items-center justify-center gap-2 relative">
          <div className="absolute top-2 w-12 h-1 rounded-full bg-white/10" />
          <svg className="w-8 h-8 text-[#4ecde6]/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
          </svg>
          <div className="text-[10px] text-white/30 text-center px-2">Share & Book</div>
        </div>
      </div>
    )
  }
  // dashboard
  return (
    <div className="w-full aspect-[4/3] rounded-xl bg-white/[0.03] border border-white/[0.08] flex flex-col gap-3 p-6">
      <div className="flex gap-2">
        <div className="flex-1 h-16 rounded-lg bg-[#4ecde6]/10 border border-[#4ecde6]/20 flex items-center justify-center">
          <span className="text-xs text-[#4ecde6] font-semibold">Revenue</span>
        </div>
        <div className="flex-1 h-16 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
          <span className="text-xs text-white/40 font-semibold">Players</span>
        </div>
      </div>
      <div className="flex-1 rounded-lg bg-white/[0.02] border border-white/[0.06] flex items-end gap-1 p-3">
        {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
          <div key={i} className="flex-1 bg-[#4ecde6]/20 rounded-sm" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  )
}

/* ── Page ── */

export default function HowItWorksPage() {
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
            <Link href="/#features" className="text-sm text-white/50 hover:text-white transition-colors font-medium">Features</Link>
            <Link href="/how-it-works" className="text-sm text-[#4ecde6] font-medium">How It Works</Link>
            <Link href="/#pricing" className="text-sm text-white/50 hover:text-white transition-colors font-medium">Pricing</Link>
            <Link href="/#testimonials" className="text-sm text-white/50 hover:text-white transition-colors font-medium">Testimonials</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/auth/signin" className="hidden sm:inline-flex px-4 py-2 text-sm font-medium text-white/60 hover:text-white transition-all">
              Log in
            </Link>
            <Link
              href="/onboard"
              className="px-5 py-2.5 text-sm font-semibold bg-white text-[#0a0a0a] rounded-full hover:bg-white/90 transition-all shadow-lg"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative">
        <div className="absolute inset-0 animated-gradient" />
        <div className="absolute top-10 left-[15%] w-[500px] h-[500px] bg-[#4ecde6]/15 rounded-full blur-[150px] animate-glow" />
        <div className="absolute bottom-10 right-[15%] w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-[120px] animate-glow" style={{ animationDelay: '1.5s' }} />
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '64px 64px' }} />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20 sm:pt-32 sm:pb-28 text-center">
          <div className="inline-flex px-3 py-1 rounded-full bg-[#4ecde6]/10 text-[#4ecde6] text-xs font-semibold uppercase tracking-wider mb-6">
            Step-by-step guide
          </div>
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-[-0.03em] leading-[0.95] mb-8">
            How Player Portal
            <br />
            <span className="gradient-text">Works</span>
          </h1>
          <p className="max-w-2xl mx-auto text-lg sm:text-xl text-white/40 mb-12 leading-relaxed">
            From signup to fully operational in under 10 minutes.
            <br className="hidden sm:block" />
            No technical skills needed. No contracts. No hassle.
          </p>
          <Link
            href="/onboard"
            className="group inline-flex px-8 py-4 bg-[#4ecde6] text-[#0a0a0a] rounded-full font-bold text-lg hover:scale-[1.03] transition-all glow-accent"
          >
            Start Free Trial
            <span className="inline-block ml-2 group-hover:translate-x-1 transition-transform">&rarr;</span>
          </Link>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#060606] to-transparent" />
      </section>

      {/* ── The Journey ── */}
      <section className="relative py-24 sm:py-32">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <div className="inline-flex px-3 py-1 rounded-full bg-[#4ecde6]/10 text-[#4ecde6] text-xs font-semibold uppercase tracking-wider mb-4">
              Your Journey
            </div>
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-5">
              Four steps to a fully automated academy
            </h2>
            <p className="text-white/40 text-lg max-w-2xl mx-auto">
              Follow the path from zero to a professional, automated football academy that parents love.
            </p>
          </div>

          <div className="space-y-20 sm:space-y-28">
            {journeySteps.map((step, i) => (
              <div key={step.num} className={`flex flex-col ${i % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'} gap-10 lg:gap-16 items-center`}>
                {/* Content */}
                <div className="flex-1 w-full">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#4ecde6]/20 to-[#4ecde6]/5 border border-[#4ecde6]/20 flex items-center justify-center shrink-0">
                      <span className="text-xl font-extrabold gradient-text">{step.num}</span>
                    </div>
                    <div>
                      <h3 className="text-2xl sm:text-3xl font-extrabold">{step.title}</h3>
                      <span className="text-sm text-[#4ecde6]/70 font-medium">{step.time}</span>
                    </div>
                  </div>
                  <ul className="space-y-4">
                    {step.items.map((item) => (
                      <li key={item} className="flex items-start gap-3">
                        <svg className="w-5 h-5 mt-0.5 text-[#4ecde6] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-white/50 leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                {/* Visual */}
                <div className="flex-1 w-full max-w-md lg:max-w-none">
                  <StepVisual type={step.visual} />
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Cyan glow separator */}
        <div className="mt-24 sm:mt-32 h-px bg-gradient-to-r from-transparent via-[#4ecde6]/30 to-transparent" />
      </section>

      {/* ── What You Get ── */}
      <section className="relative py-24 sm:py-32">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex px-3 py-1 rounded-full bg-[#4ecde6]/10 text-[#4ecde6] text-xs font-semibold uppercase tracking-wider mb-4">
              What You Get
            </div>
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-5">
              Everything included
            </h2>
            <p className="text-white/40 text-lg max-w-2xl mx-auto">
              Tools for your academy and a beautiful experience for your parents.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* For Your Academy */}
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-xl bg-[#4ecde6]/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-[#4ecde6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold">For Your Academy</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {academyFeatures.map((feat) => (
                  <div key={feat} className="flex items-start gap-3">
                    <svg className="w-4 h-4 mt-0.5 text-[#4ecde6] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm text-white/50">{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* For Your Parents */}
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-xl bg-[#4ecde6]/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-[#4ecde6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold">For Your Parents</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {parentFeatures.map((feat) => (
                  <div key={feat} className="flex items-start gap-3">
                    <svg className="w-4 h-4 mt-0.5 text-[#4ecde6] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm text-white/50">{feat}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        {/* Cyan glow separator */}
        <div className="mt-24 sm:mt-32 h-px bg-gradient-to-r from-transparent via-[#4ecde6]/30 to-transparent" />
      </section>

      {/* ── Pricing ── */}
      <section className="relative py-24 sm:py-32">
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
                  href={plan.name === 'Enterprise' ? 'mailto:hello@playerportal.io' : '/onboard'}
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
        {/* Cyan glow separator */}
        <div className="mt-24 sm:mt-32 h-px bg-gradient-to-r from-transparent via-[#4ecde6]/30 to-transparent" />
      </section>

      {/* ── FAQ ── */}
      <section className="relative py-24 sm:py-32">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex px-3 py-1 rounded-full bg-[#4ecde6]/10 text-[#4ecde6] text-xs font-semibold uppercase tracking-wider mb-4">
              FAQ
            </div>
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-5">
              Common questions
            </h2>
            <p className="text-white/40 text-lg max-w-xl mx-auto">
              Everything you need to know before getting started.
            </p>
          </div>
          <div className="space-y-4">
            {faqs.map((faq) => (
              <div
                key={faq.q}
                className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 hover:border-white/[0.12] transition-all duration-300"
              >
                <h3 className="font-bold text-base mb-2">{faq.q}</h3>
                <p className="text-sm text-white/40 leading-relaxed">{faq.a}</p>
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
            Ready to modernise
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
            Start Free Trial &mdash; No Card Required
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
              <Link href="/#features" className="hover:text-white/60 transition-colors">Features</Link>
              <Link href="/how-it-works" className="hover:text-white/60 transition-colors">How It Works</Link>
              <Link href="/#pricing" className="hover:text-white/60 transition-colors">Pricing</Link>
              <Link href="/terms" className="hover:text-white/60 transition-colors">Terms</Link>
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
