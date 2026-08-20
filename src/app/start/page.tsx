import type { Metadata } from 'next'
import Link from 'next/link'
import FunnelForm from './FunnelForm'
import { ReportsMock } from '@/components/marketing/homepage/mocks'

// COLD-traffic ad landing page: this audience has never heard of Player
// Portal, so the structure is pain → proof → who's behind it → why it's
// free → offer. One page, one CTA, deliberately no site nav (no escape
// hatches) and noindex — this exists for paid clicks, not search. Copy
// mirrors the homepage's verified proof numbers; keep in sync with
// NumbersProof.tsx when those refresh.
export const metadata: Metadata = {
  title: { absolute: 'Get Your Academy’s Booking Page Built Free | Player Portal' },
  description:
    'Still chasing subs on WhatsApp? We’ll build your football academy a branded booking page — free, within 24 hours, before you pay a penny.',
  robots: { index: false, follow: false },
}

// Player progress-report mock — mirrors the real report parents receive
// (real SCORE_CATEGORIES labels). Fictional child + initials avatar on
// purpose: never put a real player's photo on a public ad page.
function PlayerReportMock() {
  const skills: Array<[string, number]> = [
    ['Attitude', 5],
    ['Effort', 5],
    ['Technical Quality', 4],
    ['Game Understanding', 3],
    ['Confidence', 4],
  ]
  return (
    <div className="rounded-2xl border border-black/40 bg-[#080e18] overflow-hidden">
      <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-white/5">
        <span className="w-2 h-2 rounded-full bg-white/15" /><span className="w-2 h-2 rounded-full bg-white/15" /><span className="w-2 h-2 rounded-full bg-white/15" />
        <span className="ml-2 text-[9px] text-white/30 tracking-wide">theplayerportal.net / player report</span>
      </div>
      <div className="p-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-black text-[#062a33] shrink-0" style={{ background: 'linear-gradient(170deg,#4ecde6,#12a2bd)' }}>LM</div>
          <div>
            <p className="text-sm font-bold text-white">Leo Mitchell</p>
            <p className="text-[10px] text-white/40">U10 · Development Squad · Term Report</p>
          </div>
          <span className="ml-auto text-[9px] px-2 py-1 rounded-full bg-emerald-400/10 text-emerald-400 font-semibold whitespace-nowrap">92% attendance</span>
        </div>
        <div className="mt-4 space-y-2.5">
          {skills.map(([label, score]) => (
            <div key={label}>
              <div className="flex justify-between text-[10px] mb-1">
                <span className="text-white/60">{label}</span>
                <span className="text-[#4ecde6] font-semibold tabular-nums">{score}/5</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/10">
                <div className="h-full rounded-full bg-[#4ecde6]" style={{ width: `${score * 20}%` }} />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-xl bg-white/5 p-3">
          <p className="text-[9px] uppercase tracking-widest text-white/40 font-semibold">Coach&apos;s note</p>
          <p className="mt-1 text-[11px] text-white/70 leading-relaxed">&ldquo;Leo&apos;s first touch has come on massively this term — brave on the ball and demanding it now. Really proud of him.&rdquo;</p>
        </div>
      </div>
    </div>
  )
}

const STATS = [
  { number: '£23k+', label: 'collected for academies — live Stripe, not projections' },
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
    q: 'What’s the catch?',
    a: 'There isn’t one. A booking page with your academy’s name on it beats any sales pitch we could write — that’s the whole play. If you look at it and it’s not for you, delete the email. No follow-up calls, no hard feelings.',
  },
  {
    q: 'What does it cost?',
    a: 'The demo page costs nothing, whether you sign up or not. If you go live: £35/month + 3.5% per transaction, all-in. That covers card processing too. No booking fees for parents, no player limits, no tiers.',
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
          {/* logo.png is white-on-transparent (invisible on this light page) — text wordmark instead */}
          <div className="italic font-black leading-none select-none" aria-label="The Player Portal">
            <span className="block text-[10px] tracking-widest text-[#0a97b6]">THE</span>
            <span className="block text-lg tracking-tight text-[#0d1b2b]">PLAYER P<span className="text-[#0a97b6]">O</span>RTAL</span>
          </div>
          <span className="hidden sm:inline text-xs text-[#93a2ad]">Built by an academy owner</span>
        </div>
      </header>

      {/* Hero + form — pain first: this audience has never heard of us */}
      <section className="px-6 pt-8 pb-16 sm:pt-14">
        <div className="mx-auto max-w-6xl grid lg:grid-cols-2 gap-10 lg:gap-16 items-start">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#0a97b6] font-semibold">For football academy owners</p>
            <h1 className="mt-5 text-4xl sm:text-5xl leading-[1.05] tracking-[-0.02em] font-black" style={{ textWrap: 'balance' } as React.CSSProperties}>
              Do you know what your academy
              <span className="text-[#0a97b6]"> actually made</span> last month?
            </h1>
            <p className="mt-5 text-lg text-[#5a6b7c] max-w-xl">
              Most academy owners can&apos;t answer that without an hour in a spreadsheet. Player Portal shows you your
              real numbers — revenue, attendance, which classes make money, who&apos;s about to lapse — and collects
              every membership automatically while you coach.
            </p>
            <p className="mt-4 text-lg font-semibold text-[#0d1b2b] max-w-xl">
              And instead of a sales pitch, we&apos;ll prove it: we&apos;ll build your academy&apos;s booking page —
              your name, your colours — <span className="text-[#0a97b6]">free, within 24 hours</span>, before you pay a penny.
            </p>
            <ul className="mt-6 space-y-2.5">
              {['See revenue, attendance & churn per class — numbers your spreadsheet never gave you', 'Auto-billing — subs collect themselves, nobody chases anyone', 'Free migration — we move your members over for you'].map((f) => (
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

      {/* The pain, made visual — running blind vs seeing your numbers */}
      <section className="px-6 py-16 bg-white border-y border-[#e3ebf0]">
        <div className="mx-auto max-w-6xl grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#0a97b6] font-semibold">The bit nobody warns you about</p>
            <h2 className="mt-4 text-3xl font-black tracking-[-0.02em]" style={{ textWrap: 'balance' } as React.CSSProperties}>
              You&apos;re a great coach. But right now you&apos;re running your business blind.
            </h2>
            <p className="mt-4 text-[#5a6b7c] leading-relaxed">
              Which class actually makes money? Which kids are one missed session from quitting? What&apos;s your
              recurring revenue doing month on month? If the answers live in your head, a spreadsheet, and a bank
              statement, you don&apos;t have a business — you have a guess. Player Portal turns every booking,
              payment and register into numbers you can see at a glance.
            </p>
            <p className="mt-4 text-sm text-[#93a2ad]">
              Monthly recurring revenue, per-class revenue, attendance rates, trial conversion, churn — live, on your
              phone, without opening a spreadsheet. And the money side runs itself: 100% of subscriptions on the
              platform collect automatically.
            </p>
            <p className="mt-4 text-[#5a6b7c] leading-relaxed">
              <span className="font-semibold text-[#0d1b2b]">And it&apos;s not just numbers for you</span> — every
              player gets a progress report parents can actually see: skill scores, attendance, coach&apos;s notes.
              Parents who can see their kid improving don&apos;t quit. That&apos;s your retention, sorted.
            </p>
          </div>
          <div className="max-w-md w-full mx-auto lg:mx-0 space-y-4">
            <ReportsMock />
            <PlayerReportMock />
          </div>
        </div>
      </section>

      {/* Who's behind it + why it's free — cold traffic buys from people */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-3xl bg-[#0d1b2b] text-white p-8 sm:p-10">
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#4ecde6] font-semibold">Who&apos;s behind this</p>
            <h2 className="mt-4 text-2xl sm:text-3xl font-black tracking-[-0.02em]">
              Built by an academy owner, not a software company.
            </h2>
            <p className="mt-4 text-white/70 leading-relaxed">
              Player Portal was built by John Leitch — he ran a grassroots football academy for years, lived the
              WhatsApp-chasing and spreadsheet nights, built this to fix it, and later sold the academy. The platform
              now runs real academies day-in, day-out: £23k+ collected, hundreds of players, camps, trials and
              memberships all running through it.
            </p>
            <p className="mt-4 text-white/70 leading-relaxed">
              <span className="text-white font-semibold">Why build your page free?</span> Because your own academy on
              screen beats anything we could write in an ad. If you look at it and shrug, you&apos;ve lost nothing —
              and we&apos;re confident you won&apos;t shrug.
            </p>
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
