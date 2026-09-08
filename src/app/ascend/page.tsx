import type { Metadata } from 'next'
import AscendCalculator from './AscendCalculator'

// ASCEND front door (cold ad + Instagram traffic).
// The Coaching Business Calculator is LIVE on the page — no gate to see your
// number. The email gate is on the takeaway (guide + John's first fix), and the
// lead carries the visitor's real numbers so John replies to a figure.
// Every capture also lands in the "ASCEND Leads" Resend Audience.
// ASCEND brand (dark #10161c / gold #f2b441), deliberately distinct from
// Player Portal's marketing. noindex — ads + bio link only.
export const metadata: Metadata = {
  title: { absolute: 'The Coaching Business Calculator — Free | ASCEND by John Leitch' },
  description:
    'Free calculator for football coaches: put your real numbers in and see what an hour of your coaching actually pays you — and the gap at a sensible price.',
  robots: { index: false, follow: false },
}

// The mentorship offer lives on its own site (application-gated, £100 / £300).
const MENTORSHIP_URL = 'https://ascend-mentorship-site.vercel.app'

const PROOF = [
  { number: 'Built & sold', label: 'a real grassroots academy — 350 players a week, then sold. This isn’t theory.' },
  { number: '£23k+', label: 'flowing through academies on his software platform every month' },
  { number: 'From £100/mo', label: 'if you ever want ASCEND itself — the calculator and guide are free' },
]

export default function AscendPage() {
  return (
    <div className="min-h-screen bg-[#10161c] text-[#eef3f5]">
      {/* Slim bar — brand + one quiet link */}
      <header className="px-6 py-5">
        <div className="mx-auto max-w-6xl flex items-center justify-between">
          <div className="select-none" aria-label="ASCEND by John Leitch Coaching">
            <span className="block text-2xl font-black tracking-[0.28em] text-white">ASCEND</span>
            <span className="block text-[9px] tracking-[0.3em] text-[#f2b441] font-semibold mt-0.5">BY JOHN LEITCH COACHING</span>
          </div>
          <a href={MENTORSHIP_URL} className="text-xs font-semibold text-[#b6c2ca] hover:text-white transition-colors">Work with John →</a>
        </div>
      </header>

      {/* Hero */}
      <section className="px-6 pt-6 sm:pt-12 pb-10">
        <div className="mx-auto max-w-6xl">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#22d3ee] font-semibold">Free calculator for football coaches</p>
          <h1 className="mt-5 text-4xl sm:text-5xl lg:text-6xl leading-[1.02] tracking-[-0.01em] font-black text-white max-w-4xl" style={{ textWrap: 'balance' } as React.CSSProperties}>
            What does an hour of your coaching <span className="text-[#f2b441]">actually</span> pay you?
          </h1>
          <p className="mt-5 text-lg text-[#b6c2ca] max-w-2xl">
            Full pitches, happy parents, a diary with no gaps — and somehow not the income to show for it.
            Put your real sessions, players and costs in below. The number updates as you type. No email needed to see it.
          </p>
        </div>
      </section>

      {/* The calculator, live */}
      <section id="calculator" className="px-6 pb-16">
        <div className="mx-auto max-w-6xl">
          <AscendCalculator />
        </div>
      </section>

      {/* Proof */}
      <section className="px-6 py-14 bg-[#0b1116] border-y border-white/5">
        <div className="mx-auto max-w-6xl grid sm:grid-cols-3 gap-8">
          {PROOF.map((s) => (
            <div key={s.number}>
              <div className="text-2xl font-black text-white">{s.number}</div>
              <div className="mt-1.5 text-sm leading-snug text-[#7e8c99] max-w-xs">{s.label}</div>
            </div>
          ))}
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
              camps, staff, systems, 350 players a week — and then sold it. He also builds Player Portal, the
              booking-and-payments platform real academies run on today. ASCEND is where he mentors academy owners
              through the same climb: pricing, systems, marketing, and getting paid what the work is worth.
            </p>
            <p className="mt-4 text-[#b6c2ca] leading-relaxed">
              The calculator is free because it&apos;s the conversation starter. The moment you see your gap in
              actual pounds, you&apos;ll know whether you want help closing it.
            </p>
          </div>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <a href="#get" className="inline-block rounded-full px-8 py-4 text-base font-black text-[#10161c] bg-[#f2b441] hover:opacity-90 transition-opacity">
              Send me the guide →
            </a>
            <a href={MENTORSHIP_URL} className="inline-block rounded-full px-8 py-4 text-base font-bold text-white border border-white/20 hover:border-white/50 transition-colors">
              See how ASCEND works
            </a>
          </div>
          <p className="mt-4 text-center text-xs text-[#7e8c99]">Free · 2 minutes · your numbers stay yours</p>
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
