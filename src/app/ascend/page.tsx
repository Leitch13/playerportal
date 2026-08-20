import type { Metadata } from 'next'
import AscendForm from './AscendForm'

// ASCEND lead-capture landing page (cold ad traffic → email list).
// Lead magnet: the Coaching Business Calculator, delivered BY EMAIL (that's
// the capture) with a reply-bait question that starts mentorship
// conversations. Every capture also lands in the "ASCEND Leads" Resend
// Audience. ASCEND brand (dark #10161c / gold #f2b441), deliberately
// distinct from Player Portal's marketing. noindex — ads only.
export const metadata: Metadata = {
  title: { absolute: 'The Coaching Business Calculator — Free | ASCEND by John Leitch' },
  description:
    'Free calculator for football coaches: put your real numbers in and see what your coaching business should actually be paying you — and where the gap is.',
  robots: { index: false, follow: false },
}

const PROOF = [
  { number: 'Built & sold', label: 'a real grassroots academy — this isn’t theory' },
  { number: '£23k+', label: 'flowing through academies on his software platform' },
  { number: '£50/mo', label: 'is all ASCEND costs — if you ever want more than the free stuff' },
]

const GETS = [
  { title: 'Your real hourly rate', body: 'Sessions, players, fees, hours — the calculator turns them into the number nobody works out: what an hour of your coaching actually earns you.' },
  { title: 'The gap', body: 'What your coaching business should be paying you at sensible pricing and capacity — versus what it pays you now. For most coaches the gap is £1,000+ a month.' },
  { title: 'A first fix, from John', body: 'Reply to the email with your gap and John will tell you the first thing he’d change. A real reply, not an autoresponder.' },
]

export default function AscendPage() {
  return (
    <div className="min-h-screen bg-[#10161c] text-[#eef3f5]">
      {/* Slim bar — brand only, no nav */}
      <header className="px-6 py-5">
        <div className="mx-auto max-w-6xl flex items-center justify-between">
          <div className="select-none" aria-label="ASCEND by John Leitch Coaching">
            <span className="block text-2xl font-black tracking-[0.28em] text-white">ASCEND</span>
            <span className="block text-[9px] tracking-[0.3em] text-[#f2b441] font-semibold mt-0.5">BY JOHN LEITCH COACHING</span>
          </div>
          <span className="hidden sm:inline text-xs text-[#7e8c99]">For coaches who want more than a wage</span>
        </div>
      </header>

      {/* Hero + form */}
      <section className="px-6 pt-8 pb-16 sm:pt-14">
        <div className="mx-auto max-w-6xl grid lg:grid-cols-2 gap-10 lg:gap-16 items-start">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#22d3ee] font-semibold">Free tool for football coaches</p>
            <h1 className="mt-5 text-4xl sm:text-5xl leading-[1.05] tracking-[-0.01em] font-black text-white" style={{ textWrap: 'balance' } as React.CSSProperties}>
              You&apos;re a brilliant coach. Your <span className="text-[#f2b441]">bank account</span> doesn&apos;t know it yet.
            </h1>
            <p className="mt-5 text-lg text-[#b6c2ca] max-w-xl">
              Full pitches, happy parents, a diary with no gaps — and somehow still not the income to show for it.
              The problem isn&apos;t your coaching. It&apos;s that nobody ever taught you the business side.
            </p>
            <p className="mt-4 text-lg font-semibold text-white max-w-xl">
              The <span className="text-[#f2b441]">Coaching Business Calculator</span> shows you, in 2 minutes, what
              your coaching should actually be paying you — and exactly where the gap is.
            </p>
            <ul className="mt-6 space-y-2.5">
              {['Put in your real sessions, players and prices', 'See your true hourly rate and monthly gap', 'Reply with your number — John tells you the first thing he’d fix'].map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-[15px] text-[#eef3f5]">
                  <svg className="w-4 h-4 mt-1 shrink-0 text-[#f2b441]" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 grid grid-cols-3 gap-4 max-w-md">
              {PROOF.map((s) => (
                <div key={s.number}>
                  <div className="text-xl font-black text-white">{s.number}</div>
                  <div className="mt-1 text-[11px] leading-snug text-[#7e8c99]">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div id="form" className="lg:sticky lg:top-6">
            <AscendForm />
          </div>
        </div>
      </section>

      {/* What you get */}
      <section className="px-6 py-16 bg-[#0b1116] border-y border-white/5">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl font-black text-white tracking-[-0.01em]">What the calculator tells you</h2>
          <div className="mt-8 grid sm:grid-cols-3 gap-6">
            {GETS.map((g, i) => (
              <div key={g.title} className="rounded-2xl border border-white/10 bg-[#1a232b] p-6">
                <div className="w-9 h-9 rounded-full flex items-center justify-center font-black text-[#10161c] bg-[#f2b441]">{i + 1}</div>
                <h3 className="mt-4 font-bold text-lg text-white">{g.title}</h3>
                <p className="mt-2 text-sm text-[#b6c2ca] leading-relaxed">{g.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Who is John */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-3xl border border-[#f2b441]/30 bg-[#1a232b] p-8 sm:p-10">
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#f2b441] font-semibold">Who&apos;s John Leitch?</p>
            <h2 className="mt-4 text-2xl sm:text-3xl font-black text-white tracking-[-0.01em]">
              A coach who treated it like a business — and sold the business.
            </h2>
            <p className="mt-4 text-[#b6c2ca] leading-relaxed">
              John built a grassroots football academy from a handful of kids into a real company — memberships,
              camps, staff, systems — and then sold it. He also builds Player Portal, the booking-and-payments
              platform real academies run on today. ASCEND is where he mentors coaches through the same climb:
              pricing, retention, systems, and getting paid what the work is worth.
            </p>
            <p className="mt-4 text-[#b6c2ca] leading-relaxed">
              The calculator is free because it&apos;s the conversation starter — the moment you see your gap in
              actual pounds, you&apos;ll know whether you want help closing it.
            </p>
          </div>
          <div className="mt-10 text-center">
            <a href="#form" className="inline-block rounded-full px-8 py-4 text-base font-black text-[#10161c] bg-[#f2b441] hover:opacity-90 transition-opacity">
              Send me the calculator →
            </a>
            <p className="mt-3 text-xs text-[#7e8c99]">Free · 2 minutes · your numbers stay yours</p>
          </div>
        </div>
      </section>

      <footer className="px-6 py-8 border-t border-white/5">
        <div className="mx-auto max-w-6xl text-center text-xs text-[#7e8c99]">
          © {new Date().getFullYear()} ASCEND · John Leitch Coaching
        </div>
      </footer>
    </div>
  )
}
