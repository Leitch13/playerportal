import Link from 'next/link'
import { ParentHubMock } from './mocks'

// Inline stroke icons (24x24, strokeWidth 1.9) — replaced the old emoji grid.
const ICONS = {
  card: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18" />
    </svg>
  ),
  refresh: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <path d="M21 3v6h-6" />
    </svg>
  ),
  tent: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 20L12 4l9 16z" />
      <path d="M12 12l4 8" />
      <path d="M3 20h18" />
    </svg>
  ),
  chat: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a8 8 0 0 1-8 8H4l2.3-2.9A8 8 0 1 1 21 12z" />
    </svg>
  ),
  chart: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20V10" />
      <path d="M10 20V4" />
      <path d="M16 20v-8" />
      <path d="M22 20H2" />
    </svg>
  ),
  personPlus: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3 20a6 6 0 0 1 12 0" />
      <path d="M19 8v6" />
      <path d="M16 11h6" />
    </svg>
  ),
} as const

const PARENT_ACTIONS = [
  { icon: ICONS.card, title: 'See what\'s due, when', desc: 'Next payment, plan details, invoices — all one tap away.' },
  { icon: ICONS.refresh, title: 'Manage their own subscription', desc: 'Pause, upgrade or cancel without messaging you.' },
  { icon: ICONS.tent, title: 'Book camps in three clicks', desc: 'No more phone calls. No more forms.' },
  { icon: ICONS.chat, title: 'Message you (and only you)', desc: 'One thread. Searchable. Never lost in WhatsApp.' },
  { icon: ICONS.chart, title: 'See their child\'s progress', desc: 'Session-by-session reports. Photo highlights.' },
  { icon: ICONS.personPlus, title: 'Add another child', desc: 'One account, one card, siblings on the same plan.' },
]

export default function ParentHubShowcase() {
  return (
    <section className="relative border-y border-[#e3ebf0] bg-white">
      <div className="mx-auto max-w-7xl px-6 py-32">
        <div className="max-w-4xl">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#0a97b6] font-semibold mb-6">
            THE FLAGSHIP · PARENT HUB
          </p>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl leading-[1.05] tracking-[-0.02em] font-black text-[#0d1b2b]">
            The Parent Hub is why
            <br />
            <span className="text-[#93a2ad]">parents will love you.</span>
          </h2>
          <p className="mt-8 text-lg text-[#5a6b7c] max-w-2xl leading-relaxed">
            One login. Everything they need. No more WhatsApp updates. No more &ldquo;did you get my email?&rdquo; No more calls to ask when the next class is.
          </p>
        </div>

        {/* Two-column: hub mockup + capabilities grid */}
        <div className="mt-16 grid lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-5">
            <div className="relative">
              <div className="absolute -inset-6 opacity-15 blur-3xl" style={{ background: 'radial-gradient(circle, #14a7c2 0%, transparent 70%)' }} />
              <div className="relative">
                <ParentHubMock />
              </div>
            </div>
            <p className="mt-6 text-sm text-[#5a6b7c] max-w-md">
              Every parent gets this. Every child, every payment, every message — in one place they actually use.
            </p>
          </div>

          <div className="lg:col-span-7">
            <div className="grid sm:grid-cols-2 gap-3">
              {PARENT_ACTIONS.map((a) => (
                <div key={a.title} className="rounded-2xl border border-[#e3ebf0] bg-white p-5 hover:border-[#0a97b6]/40 transition-colors shadow-[0_1px_3px_rgba(13,40,54,0.05),0_10px_24px_-18px_rgba(13,40,54,0.18)]">
                  <div
                    className="w-[34px] h-[34px] rounded-[9px] grid place-items-center text-white mb-3 [&_svg]:w-[17px] [&_svg]:h-[17px]"
                    style={{ background: 'linear-gradient(170deg,#12a2bd,#0b7f96)' }}
                  >
                    {a.icon}
                  </div>
                  <p className="text-sm font-bold text-[#0d1b2b] leading-tight">{a.title}</p>
                  <p className="mt-1.5 text-xs text-[#5a6b7c] leading-relaxed">{a.desc}</p>
                </div>
              ))}
            </div>

            <div className="mt-8">
              <Link href="/how-it-works" className="inline-flex items-center gap-2 text-[#0a97b6] font-semibold text-sm hover:gap-3 transition-all">
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
