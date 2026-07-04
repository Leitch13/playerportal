import Link from 'next/link'
import { ParentHubMock } from './mocks'

const PARENT_ACTIONS = [
  { icon: '💳', title: 'See what\'s due, when', desc: 'Next payment, plan details, invoices — all one tap away.' },
  { icon: '🔄', title: 'Manage their own subscription', desc: 'Pause, upgrade or cancel without messaging you.' },
  { icon: '⛺', title: 'Book camps in three clicks', desc: 'No more phone calls. No more forms.' },
  { icon: '💬', title: 'Message you (and only you)', desc: 'One thread. Searchable. Never lost in WhatsApp.' },
  { icon: '📈', title: 'See their child\'s progress', desc: 'Session-by-session reports. Photo highlights.' },
  { icon: '👶', title: 'Add another child', desc: 'One account, one card, siblings on the same plan.' },
]

export default function ParentHubShowcase() {
  return (
    <section className="relative border-y border-white/5 bg-[#080808]">
      <div className="mx-auto max-w-7xl px-6 py-32">
        <div className="max-w-4xl">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#4ecde6] font-semibold mb-6">
            THE FLAGSHIP · PARENT HUB
          </p>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl leading-[1.05] tracking-[-0.02em] font-black text-white">
            The Parent Hub is why
            <br />
            <span className="text-white/50">parents will love you.</span>
          </h2>
          <p className="mt-8 text-lg text-white/70 max-w-2xl leading-relaxed">
            One login. Everything they need. No more WhatsApp updates. No more &ldquo;did you get my email?&rdquo; No more calls to ask when the next class is.
          </p>
        </div>

        {/* Two-column: hub mockup + capabilities grid */}
        <div className="mt-16 grid lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-5">
            <div className="relative">
              <div className="absolute -inset-6 opacity-25 blur-3xl" style={{ background: 'radial-gradient(circle, #4ecde6 0%, transparent 70%)' }} />
              <div className="relative">
                <ParentHubMock />
              </div>
            </div>
            <p className="mt-6 text-sm text-white/50 max-w-md">
              Every parent gets this. Every child, every payment, every message — in one place they actually use.
            </p>
          </div>

          <div className="lg:col-span-7">
            <div className="grid sm:grid-cols-2 gap-3">
              {PARENT_ACTIONS.map((a) => (
                <div key={a.title} className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-5 hover:border-[#4ecde6]/30 transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-[#4ecde6]/10 border border-[#4ecde6]/20 flex items-center justify-center text-xl mb-3">
                    <span className="grayscale-0">{a.icon}</span>
                  </div>
                  <p className="text-sm font-bold text-white leading-tight">{a.title}</p>
                  <p className="mt-1.5 text-xs text-white/50 leading-relaxed">{a.desc}</p>
                </div>
              ))}
            </div>

            <div className="mt-8">
              <Link href="/how-it-works" className="inline-flex items-center gap-2 text-[#4ecde6] font-semibold text-sm hover:gap-3 transition-all">
                Explore the Parent Hub
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
