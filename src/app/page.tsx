import type { Metadata } from 'next'
import Link from 'next/link'
import LandingMobileMenu from '@/components/LandingMobileMenu'

export const metadata: Metadata = {
  title: 'Player Portal by playit loveit — The All-in-One Platform for Football Academies',
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

const allFeatures = [
  'Unlimited players', 'Unlimited classes', 'Full analytics', 'Priority support',
  'Custom branding', 'Merch shop', 'Session planner', 'Drill library',
  'White-label', 'QR attendance', 'Parent portal', 'Messaging',
  'Camps & events', 'CSV exports', 'Audit log',
]

const plans = [
  {
    name: 'Starter',
    price: '£20',
    period: '/mo',
    fee: '3.5% transaction fee',
    desc: 'All features included. Best if you process low volume.',
    cta: 'Start Free Trial',
    featured: false,
  },
  {
    name: 'Pro',
    price: '£30',
    period: '/mo',
    fee: '2% transaction fee',
    desc: 'All features included. The sweet spot for most academies.',
    cta: 'Start Free Trial',
    featured: true,
  },
  {
    name: 'Enterprise',
    price: '£50',
    period: '/mo',
    fee: '1% transaction fees',
    desc: 'All features included. Lowest fees — keep more of every penny.',
    cta: 'Start Free Trial',
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
            <img src="/logo.png" alt="Player Portal" className="h-9 w-auto object-contain" />
          </Link>
          <LandingMobileMenu />
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-white/50 hover:text-white transition-colors font-medium">Features</a>
            <Link href="/how-it-works" className="text-sm text-white/50 hover:text-white transition-colors font-medium">How It Works</Link>
            <a href="#pricing" className="text-sm text-white/50 hover:text-white transition-colors font-medium">Pricing</a>
            <a href="#testimonials" className="text-sm text-white/50 hover:text-white transition-colors font-medium">Testimonials</a>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/auth/signin" className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white/60 hover:text-white transition-all">
              Log in
            </Link>
            <Link
              href="/onboard"
              className="px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold bg-white text-[#0a0a0a] rounded-full hover:bg-white/90 transition-all shadow-lg"
            >
              Get Started
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
            <Link
              href="/demo"
              className="px-8 py-4 border border-white/15 text-white/70 rounded-full font-semibold text-lg hover:bg-white/5 hover:text-white hover:border-white/25 transition-all"
            >
              Try the Demo
            </Link>
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

          {/* Hero Device Mockup */}
          <div className="mt-20 animate-slide-up" style={{ animationDelay: '0.4s' }}>
            <div className="relative mx-auto max-w-[320px] sm:max-w-[360px] animate-float">
              {/* Phone frame */}
              <div className="relative rounded-[2.5rem] border-[3px] border-white/[0.12] bg-[#0a0a0a] p-3 shadow-2xl shadow-[#4ecde6]/10">
                {/* Notch */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-6 bg-[#0a0a0a] rounded-b-2xl border-b-[3px] border-x-[3px] border-white/[0.12] z-10" />
                {/* Screen */}
                <div className="rounded-[2rem] bg-[#0a0a0a] overflow-hidden pt-6 pb-4 px-4 space-y-4">
                  {/* Status bar */}
                  <div className="flex items-center justify-between text-[10px] text-white/30 px-1">
                    <span>9:41</span>
                    <div className="flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3a4.24 4.24 0 00-6 0zm-4-4l2 2a8.49 8.49 0 0112 0l2-2c-4.42-4.42-11.58-4.42-16 0z"/></svg>
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M17 7H7v10h10V7zm-8 8V9h6v6H9z"/><rect x="2" y="7" width="3" height="10" rx="1"/><rect x="19" y="7" width="3" height="10" rx="1"/></svg>
                    </div>
                  </div>
                  {/* Greeting */}
                  <div className="pt-1">
                    <h3 className="text-lg font-bold text-white">Hi Sarah <span role="img" aria-label="wave">&#128075;</span></h3>
                    <p className="text-[11px] text-white/30 mt-0.5">Welcome back to Player Portal</p>
                  </div>
                  {/* Next Session card */}
                  <div className="rounded-xl bg-[#141414] border border-white/[0.06] p-3.5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-semibold text-[#4ecde6] uppercase tracking-wider">Next Session</span>
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    </div>
                    <p className="text-sm font-semibold text-white">Monday 5:00 PM</p>
                    <p className="text-[11px] text-white/40 mt-0.5">1-2-1 Training &middot; Coach Williams</p>
                  </div>
                  {/* Progress section */}
                  <div className="rounded-xl bg-[#141414] border border-white/[0.06] p-3.5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">Jake&apos;s Progress</span>
                      <span className="text-[10px] text-[#4ecde6] font-semibold">View All</span>
                    </div>
                    {/* Dribbling bar */}
                    <div className="mb-2.5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] text-white/60">Dribbling</span>
                        <span className="text-[11px] font-bold text-white">85%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/[0.06]">
                        <div className="h-full rounded-full bg-gradient-to-r from-[#4ecde6] to-[#2ba8c3]" style={{ width: '85%' }} />
                      </div>
                    </div>
                    {/* Passing bar */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] text-white/60">Passing</span>
                        <span className="text-[11px] font-bold text-white">72%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/[0.06]">
                        <div className="h-full rounded-full bg-gradient-to-r from-[#4ecde6] to-[#2ba8c3]" style={{ width: '72%' }} />
                      </div>
                    </div>
                  </div>
                  {/* Book button */}
                  <button className="w-full py-2.5 rounded-xl bg-[#4ecde6] text-[#0a0a0a] text-xs font-bold">
                    Book Next Session
                  </button>
                </div>
              </div>
              {/* Glow behind phone */}
              <div className="absolute -inset-8 bg-[#4ecde6]/[0.06] rounded-full blur-3xl -z-10" />
            </div>
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
          {/* Featured top 3 with visual previews */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
            {/* Player Management */}
            <div className="group relative bg-white/[0.02] border border-white/[0.06] rounded-2xl p-7 hover:bg-white/[0.04] hover:border-[#4ecde6]/20 transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-white/[0.05] flex items-center justify-center text-2xl mb-5 group-hover:bg-[#4ecde6]/10 group-hover:scale-110 transition-all duration-300">
                {features[0].icon}
              </div>
              <h3 className="text-base font-bold mb-2 group-hover:text-[#4ecde6] transition-colors">{features[0].title}</h3>
              <p className="text-sm text-white/40 leading-relaxed mb-5">{features[0].desc}</p>
              {/* Mini player card mockup */}
              <div className="rounded-xl bg-[#0a0a0a] border border-white/[0.06] p-3.5 flex items-center gap-3">
                <div className="relative w-10 h-10 shrink-0">
                  {/* Avatar circle */}
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#4ecde6]/30 to-[#2ba8c3]/10 flex items-center justify-center">
                    <span className="text-sm font-bold text-[#4ecde6]">JW</span>
                  </div>
                  {/* Progress ring (SVG) */}
                  <svg className="absolute inset-0 w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="16" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2" />
                    <circle cx="18" cy="18" r="16" fill="none" stroke="#4ecde6" strokeWidth="2" strokeDasharray="100" strokeDashoffset="22" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-white truncate">Jake Williams</p>
                  <p className="text-[10px] text-white/30">U12 &middot; Advanced</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[9px] font-semibold">Active</span>
                    <span className="text-[9px] text-white/20">78% progress</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Progress Reviews */}
            <div className="group relative bg-white/[0.02] border border-white/[0.06] rounded-2xl p-7 hover:bg-white/[0.04] hover:border-[#4ecde6]/20 transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-white/[0.05] flex items-center justify-center text-2xl mb-5 group-hover:bg-[#4ecde6]/10 group-hover:scale-110 transition-all duration-300">
                {features[1].icon}
              </div>
              <h3 className="text-base font-bold mb-2 group-hover:text-[#4ecde6] transition-colors">{features[1].title}</h3>
              <p className="text-sm text-white/40 leading-relaxed mb-5">{features[1].desc}</p>
              {/* Mini radar chart mockup (pure SVG) */}
              <div className="rounded-xl bg-[#0a0a0a] border border-white/[0.06] p-4 flex items-center justify-center">
                <svg viewBox="0 0 200 200" className="w-full max-w-[160px] h-auto">
                  {/* Grid hexagons */}
                  {[0.3, 0.6, 0.9].map((scale) => (
                    <polygon key={scale} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1"
                      points={[0,1,2,3,4,5].map((i) => {
                        const angle = (Math.PI / 3) * i - Math.PI / 2
                        return `${100 + 80 * scale * Math.cos(angle)},${100 + 80 * scale * Math.sin(angle)}`
                      }).join(' ')} />
                  ))}
                  {/* Axis lines */}
                  {[0,1,2,3,4,5].map((i) => {
                    const angle = (Math.PI / 3) * i - Math.PI / 2
                    return <line key={i} x1="100" y1="100" x2={100 + 72 * Math.cos(angle)} y2={100 + 72 * Math.sin(angle)} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
                  })}
                  {/* Data polygon */}
                  <polygon
                    fill="rgba(78,205,230,0.12)" stroke="#4ecde6" strokeWidth="1.5"
                    points={[0.85, 0.72, 0.65, 0.78, 0.90, 0.68].map((v, i) => {
                      const angle = (Math.PI / 3) * i - Math.PI / 2
                      return `${100 + 72 * v * Math.cos(angle)},${100 + 72 * v * Math.sin(angle)}`
                    }).join(' ')}
                  />
                  {/* Data points */}
                  {[0.85, 0.72, 0.65, 0.78, 0.90, 0.68].map((v, i) => {
                    const angle = (Math.PI / 3) * i - Math.PI / 2
                    return <circle key={i} cx={100 + 72 * v * Math.cos(angle)} cy={100 + 72 * v * Math.sin(angle)} r="3" fill="#4ecde6" />
                  })}
                  {/* Labels */}
                  {[
                    { label: 'Dribbling', v: 0.85 },
                    { label: 'Passing', v: 0.72 },
                    { label: 'Shooting', v: 0.65 },
                    { label: 'Defending', v: 0.78 },
                    { label: 'Pace', v: 0.90 },
                    { label: 'Vision', v: 0.68 },
                  ].map((item, i) => {
                    const angle = (Math.PI / 3) * i - Math.PI / 2
                    const lx = 100 + 95 * Math.cos(angle)
                    const ly = 100 + 95 * Math.sin(angle)
                    return <text key={i} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" className="fill-white/40 text-[8px]">{item.label}</text>
                  })}
                </svg>
              </div>
            </div>

            {/* Automated Payments */}
            <div className="group relative bg-white/[0.02] border border-white/[0.06] rounded-2xl p-7 hover:bg-white/[0.04] hover:border-[#4ecde6]/20 transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-white/[0.05] flex items-center justify-center text-2xl mb-5 group-hover:bg-[#4ecde6]/10 group-hover:scale-110 transition-all duration-300">
                {features[2].icon}
              </div>
              <h3 className="text-base font-bold mb-2 group-hover:text-[#4ecde6] transition-colors">{features[2].title}</h3>
              <p className="text-sm text-white/40 leading-relaxed mb-5">{features[2].desc}</p>
              {/* Mini payment card mockup */}
              <div className="rounded-xl bg-[#0a0a0a] border border-white/[0.06] p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-white/30 uppercase tracking-wider font-semibold">Monthly Fee</p>
                    <p className="text-xl font-extrabold text-white mt-0.5">&pound;30<span className="text-xs font-medium text-white/30">/mo</span></p>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span className="text-[10px] font-bold text-emerald-400">Paid</span>
                  </span>
                </div>
                <div className="h-px bg-white/[0.06]" />
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-white/30">Next: 1st April</span>
                  <span className="text-white/30">Visa ****4242</span>
                </div>
              </div>
            </div>
          </div>

          {/* Remaining features */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.slice(3).map((f, i) => (
              <div
                key={f.title}
                className="group relative bg-white/[0.02] border border-white/[0.06] rounded-2xl p-7 hover:bg-white/[0.04] hover:border-[#4ecde6]/20 transition-all duration-300"
                style={{ animationDelay: `${(i + 3) * 0.05}s` }}
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

      {/* ── See It In Action ── */}
      <section className="relative py-24 sm:py-32">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#4ecde6]/[0.02] to-transparent" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex px-3 py-1 rounded-full bg-[#4ecde6]/10 text-[#4ecde6] text-xs font-semibold uppercase tracking-wider mb-4">
              Product Preview
            </div>
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-5">
              See it in action
            </h2>
            <p className="text-white/40 text-lg max-w-2xl mx-auto leading-relaxed">
              Three dashboards, one platform. Every user gets a tailored experience.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-10">
            {/* Admin Dashboard */}
            <div className="text-center group">
              <div className="relative rounded-2xl border border-white/[0.08] bg-[#0a0a0a] p-3 shadow-xl group-hover:border-[#4ecde6]/20 transition-all duration-300">
                {/* Browser chrome */}
                <div className="flex items-center gap-1.5 px-2 py-2 border-b border-white/[0.06] mb-3">
                  <span className="w-2 h-2 rounded-full bg-red-400/60" />
                  <span className="w-2 h-2 rounded-full bg-yellow-400/60" />
                  <span className="w-2 h-2 rounded-full bg-green-400/60" />
                  <div className="ml-2 flex-1 h-4 rounded bg-white/[0.04] flex items-center justify-center">
                    <span className="text-[8px] text-white/20">app.playerportal.net/admin</span>
                  </div>
                </div>
                {/* Screen content */}
                <div className="space-y-3 px-1.5 pb-2">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-white">Academy Dashboard</span>
                    <span className="w-5 h-5 rounded-full bg-[#4ecde6]/20 flex items-center justify-center text-[8px] text-[#4ecde6]">M</span>
                  </div>
                  {/* Stat row */}
                  <div className="grid grid-cols-3 gap-2">
                    {[{ v: '124', l: 'Players' }, { v: '18', l: 'Classes' }, { v: '96%', l: 'Retention' }].map((s) => (
                      <div key={s.l} className="rounded-lg bg-[#141414] border border-white/[0.04] p-2 text-center">
                        <div className="text-sm font-extrabold text-white">{s.v}</div>
                        <div className="text-[8px] text-white/30">{s.l}</div>
                      </div>
                    ))}
                  </div>
                  {/* Revenue chart mockup */}
                  <div className="rounded-lg bg-[#141414] border border-white/[0.04] p-2.5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[9px] text-white/40 font-semibold">Revenue</span>
                      <span className="text-[9px] font-bold text-emerald-400">+12%</span>
                    </div>
                    <svg viewBox="0 0 200 50" className="w-full h-8">
                      <polyline fill="none" stroke="#4ecde6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                        points="0,40 30,35 60,28 90,32 120,18 150,22 180,12 200,8" />
                      <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4ecde6" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#4ecde6" stopOpacity="0" />
                      </linearGradient>
                      <polygon fill="url(#chartGrad)" points="0,40 30,35 60,28 90,32 120,18 150,22 180,12 200,8 200,50 0,50" />
                    </svg>
                  </div>
                  {/* Recent list */}
                  <div className="space-y-1.5">
                    {['Jake W. — Registered', 'Emma R. — Payment received', 'Session plan uploaded'].map((item, i) => (
                      <div key={i} className="flex items-center gap-2 text-[9px] text-white/30">
                        <span className="w-1 h-1 rounded-full bg-[#4ecde6]/60" />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <p className="mt-4 text-sm font-semibold text-white/60">For Academies</p>
              <p className="text-xs text-white/30 mt-1">Full control over players, classes, and revenue</p>
            </div>

            {/* Parent Dashboard */}
            <div className="text-center group md:-mt-4">
              <div className="relative rounded-2xl border border-white/[0.08] bg-[#0a0a0a] p-3 shadow-xl group-hover:border-[#4ecde6]/20 transition-all duration-300 ring-1 ring-[#4ecde6]/10">
                {/* Browser chrome */}
                <div className="flex items-center gap-1.5 px-2 py-2 border-b border-white/[0.06] mb-3">
                  <span className="w-2 h-2 rounded-full bg-red-400/60" />
                  <span className="w-2 h-2 rounded-full bg-yellow-400/60" />
                  <span className="w-2 h-2 rounded-full bg-green-400/60" />
                  <div className="ml-2 flex-1 h-4 rounded bg-white/[0.04] flex items-center justify-center">
                    <span className="text-[8px] text-white/20">app.playerportal.net/parent</span>
                  </div>
                </div>
                {/* Screen content */}
                <div className="space-y-3 px-1.5 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#4ecde6]/30 to-[#4ecde6]/10 flex items-center justify-center">
                      <span className="text-[8px] font-bold text-[#4ecde6]">S</span>
                    </div>
                    <div>
                      <span className="text-[11px] font-bold text-white">Hi Sarah</span>
                      <span className="text-[11px] ml-1" role="img" aria-label="wave">&#128075;</span>
                    </div>
                  </div>
                  {/* Child card */}
                  <div className="rounded-lg bg-[#141414] border border-white/[0.04] p-2.5">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 rounded-full bg-white/[0.06] flex items-center justify-center text-[10px] font-bold text-white">J</div>
                      <div>
                        <p className="text-[10px] font-semibold text-white">Jake Williams</p>
                        <p className="text-[8px] text-white/30">U12 Advanced</p>
                      </div>
                    </div>
                    {/* Mini progress bars */}
                    {[{ l: 'Dribbling', w: '85%' }, { l: 'Passing', w: '72%' }, { l: 'Shooting', w: '65%' }].map((bar) => (
                      <div key={bar.l} className="mb-1.5 last:mb-0">
                        <div className="flex justify-between text-[8px] mb-0.5">
                          <span className="text-white/40">{bar.l}</span>
                          <span className="text-white/60 font-semibold">{bar.w}</span>
                        </div>
                        <div className="h-1 rounded-full bg-white/[0.06]">
                          <div className="h-full rounded-full bg-[#4ecde6]" style={{ width: bar.w }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Upcoming */}
                  <div className="rounded-lg bg-[#141414] border border-white/[0.04] p-2.5">
                    <span className="text-[8px] text-[#4ecde6] font-semibold uppercase tracking-wider">Upcoming</span>
                    <p className="text-[10px] font-semibold text-white mt-1">Mon 5:00 PM — 1-2-1 Training</p>
                    <p className="text-[10px] text-white/30 mt-0.5">Wed 6:00 PM — Group Session</p>
                  </div>
                  {/* Badge */}
                  <div className="flex items-center gap-2 rounded-lg bg-yellow-400/5 border border-yellow-400/10 p-2">
                    <span className="text-sm">&#127942;</span>
                    <div>
                      <p className="text-[9px] font-semibold text-yellow-400">New Badge!</p>
                      <p className="text-[8px] text-white/30">10 Sessions Completed</p>
                    </div>
                  </div>
                </div>
              </div>
              <p className="mt-4 text-sm font-semibold text-white/60">For Parents</p>
              <p className="text-xs text-white/30 mt-1">Track progress, book sessions, stay connected</p>
            </div>

            {/* Coach View */}
            <div className="text-center group">
              <div className="relative rounded-2xl border border-white/[0.08] bg-[#0a0a0a] p-3 shadow-xl group-hover:border-[#4ecde6]/20 transition-all duration-300">
                {/* Browser chrome */}
                <div className="flex items-center gap-1.5 px-2 py-2 border-b border-white/[0.06] mb-3">
                  <span className="w-2 h-2 rounded-full bg-red-400/60" />
                  <span className="w-2 h-2 rounded-full bg-yellow-400/60" />
                  <span className="w-2 h-2 rounded-full bg-green-400/60" />
                  <div className="ml-2 flex-1 h-4 rounded bg-white/[0.04] flex items-center justify-center">
                    <span className="text-[8px] text-white/20">app.playerportal.net/coach</span>
                  </div>
                </div>
                {/* Screen content */}
                <div className="space-y-3 px-1.5 pb-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-white">Today&apos;s Sessions</span>
                    <span className="text-[9px] text-[#4ecde6] font-semibold">3 sessions</span>
                  </div>
                  {/* Session cards */}
                  {[
                    { time: '4:00 PM', name: 'U10 Group', count: '12/14', color: 'bg-emerald-400' },
                    { time: '5:00 PM', name: '1-2-1 Jake W.', count: '1/1', color: 'bg-[#4ecde6]' },
                    { time: '6:30 PM', name: 'U14 Advanced', count: '8/10', color: 'bg-amber-400' },
                  ].map((session) => (
                    <div key={session.name} className="rounded-lg bg-[#141414] border border-white/[0.04] p-2.5 flex items-center gap-2.5">
                      <div className={`w-1 h-8 rounded-full ${session.color}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-semibold text-white">{session.name}</p>
                        <p className="text-[8px] text-white/30">{session.time}</p>
                      </div>
                      <span className="text-[9px] text-white/40 font-medium">{session.count}</span>
                    </div>
                  ))}
                  {/* Drill plan */}
                  <div className="rounded-lg bg-[#141414] border border-white/[0.04] p-2.5">
                    <span className="text-[8px] text-white/40 font-semibold uppercase tracking-wider">Session Plan</span>
                    <div className="mt-1.5 space-y-1">
                      {['Warm-up: Rondo (10 min)', 'Drill: 1v1 attacking', 'Match play: 5v5'].map((d, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-[9px] text-white/40">
                          <span className="w-3.5 h-3.5 rounded border border-white/10 flex items-center justify-center text-[7px] text-white/20">{i + 1}</span>
                          {d}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <p className="mt-4 text-sm font-semibold text-white/60">For Coaches</p>
              <p className="text-xs text-white/30 mt-1">Session plans, attendance, and player notes</p>
            </div>
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
        {/* Background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-[#4ecde6]/[0.04] rounded-full blur-[150px] pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex px-3 py-1 rounded-full bg-[#4ecde6]/10 text-[#4ecde6] text-xs font-semibold uppercase tracking-wider mb-4">
              Pricing
            </div>
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-5">
              Simple, transparent pricing
            </h2>
            <p className="text-white/40 text-lg max-w-xl mx-auto">
              Pick your plan. Start your 14-day free trial. No credit card required.
            </p>
          </div>
          <p className="text-sm text-white/40 mt-4 max-w-xl mx-auto text-center">
            Every plan includes everything. Choose based on your transaction volume.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto items-start mt-10">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl p-8 flex flex-col transition-all duration-300 ${
                  plan.featured
                    ? 'bg-gradient-to-b from-[#4ecde6]/[0.08] to-[#4ecde6]/[0.02] border-2 border-[#4ecde6]/30 shadow-2xl shadow-[#4ecde6]/10 md:scale-[1.06] md:-my-6 ring-1 ring-[#4ecde6]/20'
                    : 'bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.15] hover:bg-white/[0.03]'
                }`}
              >
                {plan.featured && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-5 py-1.5 bg-gradient-to-r from-[#4ecde6] to-[#2ba8c3] text-white text-[11px] font-bold rounded-full uppercase tracking-wider shadow-lg shadow-[#4ecde6]/30">
                    Most Popular
                  </div>
                )}
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-4">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className={`text-5xl font-extrabold tracking-tight ${plan.featured ? 'gradient-text' : ''}`}>{plan.price}</span>
                    {plan.period && <span className="text-white/30 text-sm font-medium">{plan.period}</span>}
                  </div>
                  <div className={`text-sm font-semibold mb-3 ${plan.fee === '1% transaction fees' ? 'text-emerald-400' : 'text-white/40'}`}>
                    {plan.fee}
                  </div>
                  <p className="text-sm text-white/30">{plan.desc}</p>
                </div>
                <div className="flex items-center gap-2 mb-6 px-3 py-2 rounded-lg bg-[#4ecde6]/5 border border-[#4ecde6]/10">
                  <svg className="w-4 h-4 text-[#4ecde6] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-xs font-semibold text-[#4ecde6]">All features included</span>
                </div>
                <Link
                  href="/onboard"
                  className={`block text-center py-3.5 rounded-full font-semibold text-sm transition-all ${
                    plan.featured
                      ? 'bg-[#4ecde6] text-[#0a0a0a] hover:bg-[#7dddf0] shadow-lg shadow-[#4ecde6]/25 glow-accent hover:shadow-xl hover:shadow-[#4ecde6]/30'
                      : 'border border-white/15 text-white/70 hover:bg-white/5 hover:text-white hover:border-white/25'
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
          {/* Shared feature list */}
          <div className="max-w-3xl mx-auto mt-14">
            <h3 className="text-center text-sm font-semibold text-white/50 uppercase tracking-wider mb-6">
              Included in every plan
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {allFeatures.map((feat) => (
                <div key={feat} className="flex items-center gap-2.5 text-sm text-white/50">
                  <svg className="w-4 h-4 text-[#4ecde6] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {feat}
                </div>
              ))}
            </div>
          </div>
          {/* Notes */}
          <div className="text-center mt-12 space-y-3">
            <p className="text-sm text-white/40">
              All plans include a 14-day free trial. No credit card required.
            </p>
            <p className="text-xs text-white/25 max-w-lg mx-auto">
              Processing &pound;2,000/month? Starter costs &pound;90, Pro costs &pound;70, Enterprise costs &pound;50 &mdash; the best value at scale.
            </p>
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
              <img src="/logo.png" alt="Player Portal" className="h-7 w-auto object-contain" />
              <span className="text-sm font-semibold text-white/60">by playit loveit</span>
            </div>
            <div className="flex gap-8 text-sm text-white/30">
              <a href="#features" className="hover:text-white/60 transition-colors">Features</a>
              <a href="#pricing" className="hover:text-white/60 transition-colors">Pricing</a>
              <Link href="/terms" className="hover:text-white/60 transition-colors">Terms</Link>
              <Link href="/privacy" className="hover:text-white/60 transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-white/60 transition-colors">Cookies</Link>
            </div>
            <div className="text-xs text-white/20">
              &copy; 2026 Play It Love It Ltd. All rights reserved. Player Portal is a trademark of Play It Love It Ltd.
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
