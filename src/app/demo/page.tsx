import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Try the Demo — Player Portal',
  description: 'Explore Player Portal from the perspective of a parent, coach, or academy admin. No signup required.',
}

const roles = [
  {
    slug: 'admin',
    title: 'Academy Admin',
    icon: (
      <svg className="w-8 h-8 text-[#4ecde6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
      </svg>
    ),
    description: 'See revenue analytics, player stats, class management, today\'s schedule, and full academy operations.',
    stats: ['142 Players', '8 Classes', '\u00a312,400/mo'],
  },
  {
    slug: 'parent',
    title: 'Parent',
    icon: (
      <svg className="w-8 h-8 text-[#4ecde6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
    description: 'View your children\'s progress, upcoming sessions, payment history, and achievement badges.',
    stats: ['2 Children', '3 Sessions/wk', '4.8 Rating'],
  },
  {
    slug: 'coach',
    title: 'Coach',
    icon: (
      <svg className="w-8 h-8 text-[#4ecde6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.636 50.636 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
      </svg>
    ),
    description: 'Manage today\'s classes, write session plans, submit player reviews, and track attendance.',
    stats: ['4 Classes Today', '36 Players', '12 Reviews'],
  },
]

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-[#060606] text-white overflow-hidden">
      {/* Nav */}
      <nav className="sticky top-0 z-50 glass-dark border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="Player Portal" className="h-9 w-auto object-contain" />
          </Link>
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

      {/* Hero */}
      <section className="relative">
        <div className="absolute inset-0 animated-gradient" />
        <div className="absolute top-10 left-[15%] w-[500px] h-[500px] bg-[#4ecde6]/15 rounded-full blur-[150px] animate-glow" />
        <div className="absolute bottom-10 right-[15%] w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-[120px] animate-glow" style={{ animationDelay: '1.5s' }} />
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '64px 64px' }} />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-10 sm:pt-28 sm:pb-16 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.05] border border-white/[0.08] text-sm text-white/50 mb-8">
            <span className="relative inline-block w-2 h-2 rounded-full bg-emerald-400">
              <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
            </span>
            Interactive demo &mdash; no signup required
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-[-0.03em] leading-[0.95] mb-6">
            Explore Player Portal
            <br />
            <span className="gradient-text">your way</span>
          </h1>

          <p className="max-w-2xl mx-auto text-lg sm:text-xl text-white/40 mb-16 leading-relaxed">
            Choose a perspective and see exactly what your academy dashboard looks like.
            <br className="hidden sm:block" />
            Real interface. Real data. Zero commitment.
          </p>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#060606] to-transparent" />
      </section>

      {/* Role Cards */}
      <section className="relative -mt-8 pb-24 sm:pb-32">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {roles.map((role) => (
              <Link
                key={role.slug}
                href={`/demo/${role.slug}`}
                className="group relative bg-white/[0.02] border border-white/[0.06] rounded-2xl p-8 hover:bg-white/[0.05] hover:border-[#4ecde6]/30 transition-all duration-300 hover:shadow-xl hover:shadow-[#4ecde6]/5"
              >
                {/* Icon */}
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#4ecde6]/15 to-[#4ecde6]/5 border border-[#4ecde6]/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  {role.icon}
                </div>

                {/* Title & Description */}
                <h3 className="text-xl font-bold mb-3 group-hover:text-[#4ecde6] transition-colors">{role.title}</h3>
                <p className="text-sm text-white/40 leading-relaxed mb-6">{role.description}</p>

                {/* Stats */}
                <div className="flex gap-3 mb-6">
                  {role.stats.map((stat) => (
                    <div key={stat} className="px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] text-[11px] text-white/40 font-medium">
                      {stat}
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <div className="flex items-center gap-2 text-sm font-semibold text-[#4ecde6]/70 group-hover:text-[#4ecde6] transition-colors">
                  Explore {role.title} View
                  <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>

          {/* Bottom note */}
          <div className="text-center mt-16">
            <p className="text-sm text-white/30 mb-4">
              Seen enough? Ready to set up your own academy?
            </p>
            <Link
              href="/onboard"
              className="inline-flex px-8 py-3.5 bg-[#4ecde6] text-[#0a0a0a] rounded-full font-bold text-sm hover:scale-[1.03] transition-all glow-accent"
            >
              Get Started Free &mdash; No Card Required
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="Player Portal" className="h-7 w-auto object-contain" />
              <span className="text-sm font-semibold text-white/60">by JSL Sports</span>
            </div>
            <div className="flex gap-8 text-sm text-white/30">
              <Link href="/#features" className="hover:text-white/60 transition-colors">Features</Link>
              <Link href="/#pricing" className="hover:text-white/60 transition-colors">Pricing</Link>
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
