import Link from 'next/link'
import { ParentHubMock } from './mocks'
import TourVideoButton from './TourVideo'

// Numbers mirror NumbersProof.tsx — keep the two in sync when stats refresh.
const HERO_PROOF = [
  { value: '£23k+', label: 'processed · live Stripe' },
  { value: '100%', label: 'subs on auto-billing' },
  { value: '£6,431', label: 'best single day' },
]

export default function Hero() {
  return (
    <section
      className="relative overflow-hidden text-white"
      style={{ background: 'linear-gradient(168deg,#14a7c2 0%,#0b8199 55%,#0a7184 100%)' }}
    >
      {/* Radial glows */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(120% 70% at 78% -18%, rgba(120,235,252,0.35), transparent 55%), radial-gradient(110% 80% at 0% 120%, rgba(4,56,70,0.55), transparent 60%)',
        }}
      />

      {/* Faint pitch-circle line art on the left edge */}
      <svg
        className="absolute -left-16 top-0 bottom-0 h-full w-[420px] opacity-[0.15] pointer-events-none"
        viewBox="0 0 300 600"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <g fill="none" stroke="#fff" strokeWidth="1.6">
          <circle cx="60" cy="300" r="130" />
          <line x1="60" y1="0" x2="60" y2="600" />
          <circle cx="60" cy="300" r="4" fill="#fff" />
        </g>
      </svg>

      <div className="relative mx-auto max-w-7xl px-6 pt-32 pb-24 lg:pt-40 lg:pb-32">
        <div className="grid lg:grid-cols-12 gap-16 items-center">
          {/* Copy */}
          <div className="lg:col-span-7">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/85 font-semibold mb-6">
              THE OPERATING SYSTEM FOR FOOTBALL ACADEMIES
            </p>
            <h1 className="text-[44px] sm:text-[64px] lg:text-[80px] leading-[0.98] tracking-[-0.02em] font-black text-white">
              You didn&apos;t start an academy
              <br />
              <span className="text-[rgba(6,32,40,0.85)]">to send payment reminders.</span>
            </h1>
            <p className="mt-8 text-lg lg:text-xl text-white/85 max-w-2xl leading-relaxed">
              Player Portal replaces the six or seven tools you use to run your academy — bookings, memberships, payments, attendance, camps, and the parent hub — with one platform built by someone who runs an academy.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <Link
                href="/onboard"
                className="inline-flex items-center gap-2 rounded-full bg-white text-[#0a1420] px-7 py-3.5 text-[15px] font-semibold hover:bg-[#e8f6fa] transition-colors"
              >
                Try free for 14 days
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </Link>
              <Link
                href="/how-it-works"
                className="inline-flex items-center gap-2 rounded-full border border-white/40 text-white px-7 py-3.5 text-[15px] font-semibold hover:bg-white/10 transition-colors"
              >
                See it in action
              </Link>
              <TourVideoButton />
            </div>

            {/* Live proof — mirrors NumbersProof */}
            <div className="mt-10 flex flex-wrap gap-x-8 gap-y-4">
              {HERO_PROOF.map((p) => (
                <div key={p.label}>
                  <p className="text-2xl font-black text-white tabular-nums tracking-tight">{p.value}</p>
                  <p className="mt-0.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-white/60">{p.label}</p>
                </div>
              ))}
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-white/60">
              <TrustDot>Built by JSL Sports</TrustDot>
              <TrustDot>No card required</TrustDot>
              <TrustDot>Migrate from anything</TrustDot>
              <TrustDot>UK hosted</TrustDot>
            </div>
          </div>

          {/* Product mockup — tilted */}
          <div className="lg:col-span-5 relative">
            <div className="relative">
              <div className="absolute -inset-8 opacity-25 blur-3xl" style={{ background: 'radial-gradient(circle, #063846 0%, transparent 70%)' }} />
              <div className="relative transform lg:rotate-[1.5deg] lg:hover:rotate-0 transition-transform duration-500">
                <ParentHubMock />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function TrustDot({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="w-1 h-1 rounded-full bg-white" />
      {children}
    </span>
  )
}
