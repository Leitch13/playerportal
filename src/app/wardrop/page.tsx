import type { Metadata } from 'next'
import Image from 'next/image'
import { Bebas_Neue } from 'next/font/google'
import WardropForm from './WardropForm'
import { WEBINAR_DATE, WEBINAR_TIME, WEBINAR_PRICE } from './constants'

/**
 * /wardrop — ASCEND webinar registration page.
 *
 * A paid-traffic destination, deliberately NOT linked from the main nav
 * (no TopNav/Footer import): it is ASCEND-branded, not Player Portal, so it
 * carries its own minimal chrome rather than the Player Portal marketing shell.
 *
 * Fonts and base tokens come from the root layout (Inter via --font-inter,
 * globals.css). Bebas Neue is loaded here rather than in the root layout so a
 * single paid-traffic page doesn't add a font to every route in the app.
 */

// Display face. Bebas Neue ships a single weight (400).
const bebas = Bebas_Neue({ weight: '400', subsets: ['latin'], display: 'swap', variable: '--font-bebas' })

const TITLE = 'Social Media Content Workshop with Sam Wardrop'
const DESCRIPTION = `Live workshop on Zoom, ${WEBINAR_DATE} at ${WEBINAR_TIME}. Build a month of academy social content in one sitting. ${WEBINAR_PRICE}.`

export const metadata: Metadata = {
  title: { absolute: `${TITLE} | ASCEND` },
  description: DESCRIPTION,
  // Paid-traffic landing page: keep it out of the index so it never competes
  // with the Player Portal marketing pages for search.
  robots: { index: false, follow: false },
  openGraph: {
    type: 'website',
    locale: 'en_GB',
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: '/ascend/wardrop-flyer.png', width: 1080, height: 1080, alt: TITLE }],
  },
}

/** Display heading — Bebas Neue, uppercase. */
function Display({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <h2 className={`font-[family-name:var(--font-bebas)] uppercase leading-[0.95] tracking-wide ${className}`}>{children}</h2>
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-400">{children}</p>
}

const TAKEAWAYS = [
  {
    n: '01',
    h: 'A content plan you actually follow',
    p: 'The handful of post types that work for academies, mapped across a month — so you never open the app wondering what to put up.',
  },
  {
    n: '02',
    h: 'Filming that looks the part',
    p: 'Angles, light, sound and framing on a phone. The small fixes that separate content that looks professional from content that looks rushed.',
  },
  {
    n: '03',
    h: 'One session, two weeks of posts',
    p: 'How to capture a normal training night once and cut it into clips, stills and stories — instead of starting from nothing every week.',
  },
  {
    n: '04',
    h: 'Content that fills sessions',
    p: 'Turning views into enquiries: what to say, where the call to action goes, and how to stop your best-performing post leading nowhere.',
  },
]

const FAQS = [
  {
    q: 'I can’t make it live — is it worth booking?',
    a: 'Yes. Everyone who registers gets the replay, so you can watch it back whenever suits. You’ll just miss the chance to ask Sam questions on the night.',
  },
  { q: 'How long is it?', a: 'Around 90 minutes — roughly an hour of Sam working through the content system, then questions.' },
  {
    q: 'Do I need any kit?',
    a: 'A phone. That’s genuinely it. Bring a notepad if you like taking notes, and if you’ve got recent footage from a session to hand, even better.',
  },
  {
    q: 'Where does the Zoom link come from?',
    a: 'By email, from ASCEND, in the days before and again on the day. If it hasn’t landed, check your spam folder and then email us.',
  },
]

export default function WardropPage() {
  return (
    <div className={`${bebas.variable} min-h-screen bg-[#0A0A0A] text-white`}>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <header className="relative overflow-hidden border-b border-white/5">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #22d3ee 0%, transparent 62%)' }}
        />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-5 pt-14 pb-14 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-16 lg:pt-20 lg:pb-20">
          <div>
            <Eyebrow>ASCEND · Live workshop on Zoom</Eyebrow>
            <h1 className="font-[family-name:var(--font-bebas)] text-5xl uppercase leading-[0.92] tracking-wide sm:text-6xl lg:text-7xl">
              Social media content{' '}
              <span className="text-cyan-400">with Sam Wardrop</span>
            </h1>

            <p className="mt-7 max-w-xl text-base leading-relaxed text-white/60 sm:text-lg">
              One evening. A repeatable way to make content for your academy that parents actually stop and watch —
              without needing a videographer, a studio, or hours you haven’t got.
            </p>

            <ul className="mt-7 flex flex-wrap gap-2.5">
              {[`${WEBINAR_DATE} · ${WEBINAR_TIME}`, 'Live on Zoom', `${WEBINAR_PRICE} a seat`].map((chip) => (
                <li
                  key={chip}
                  className="rounded-full border border-cyan-400/25 bg-cyan-400/[0.08] px-4 py-2 text-sm font-medium text-white/80"
                >
                  {chip}
                </li>
              ))}
            </ul>

            <a
              href="#register"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-cyan-400 px-8 py-4 text-base font-bold text-black
                hover:bg-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400
                focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0A] motion-safe:transition-colors"
            >
              Save my seat
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
            <p className="mt-4 text-sm text-white/40">
              Takes 30 seconds. Replay sent to everyone who registers, so book even if you can’t make it live.
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-cyan-400/20 bg-white/[0.03] shadow-2xl">
            <Image
              src="/ascend/wardrop-flyer.png"
              alt={`${TITLE} — ${WEBINAR_DATE} at ${WEBINAR_TIME}, delivered on Zoom`}
              width={1080}
              height={1080}
              priority
              className="h-auto w-full"
            />
          </div>
        </div>
      </header>

      {/* ── Takeaways ────────────────────────────────────────────────────── */}
      <section className="border-b border-white/5">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 lg:py-24">
          <Eyebrow>What you’ll take away from it</Eyebrow>
          <Display className="text-4xl sm:text-5xl">Leave with content already made</Display>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/60 sm:text-lg">
            This isn’t a lecture on algorithms. Sam works through what to film, how to shoot it on the phone in your
            pocket, and how to turn one session into a fortnight of posts.
          </p>

          <ul className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-2">
            {TAKEAWAYS.map((t) => (
              <li key={t.n} className="bg-[#0A0A0A] p-6 sm:p-8">
                <p className="font-[family-name:var(--font-bebas)] text-3xl text-cyan-400">{t.n}</p>
                <h3 className="mt-3 text-lg font-bold text-white">{t.h}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/55">{t.p}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Host ─────────────────────────────────────────────────────────── */}
      <section className="border-b border-white/5">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-16 sm:px-6 lg:grid-cols-[0.75fr_1.25fr] lg:items-center lg:gap-14 lg:py-24">
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <Image
              src="/ascend/wardrop-portrait.png"
              alt="Sam Wardrop"
              width={560}
              height={700}
              className="h-auto w-full"
            />
          </div>
          <div>
            <Eyebrow>Your host</Eyebrow>
            <Display className="text-4xl sm:text-5xl">Sam Wardrop</Display>
            {/* EDIT: SAM BIO — swap for Sam's real credits, clients and socials.
                Kept deliberately neutral so nothing untrue ships by accident. */}
            <p className="mt-5 text-base leading-relaxed text-white/60">
              Sam works with coaches and academies on content that actually gets seen — the practical end of it: what to
              film, how to shoot it, and how to keep it going once the initial enthusiasm wears off.
            </p>
            <p className="mt-4 text-base leading-relaxed text-white/60">
              He’s built this session around the reality of running an academy: no crew, no budget, and no spare
              evenings. Everything he shows you, you can do yourself on a phone before next weekend.
            </p>
            <p className="mt-5 text-sm text-white/35">Hosted by John Leitch · ASCEND</p>
          </div>
        </div>
      </section>

      {/* ── Register ─────────────────────────────────────────────────────── */}
      <section id="register" className="scroll-mt-4 border-b border-white/5">
        <div className="mx-auto max-w-xl px-5 py-16 sm:px-6 lg:py-24">
          <div className="text-center">
            <Eyebrow>Save your seat</Eyebrow>
            <Display className="text-4xl sm:text-5xl">
              {WEBINAR_DATE}, {WEBINAR_TIME}
            </Display>
            <p className="mx-auto mt-4 max-w-sm text-base leading-relaxed text-white/60">
              Register below and the Zoom link comes straight to your inbox.
            </p>
            <p className="mt-6 font-[family-name:var(--font-bebas)] text-6xl leading-none text-white sm:text-7xl">
              {WEBINAR_PRICE}
            </p>
            <p className="mt-1 text-sm text-white/40">one-off · includes the replay</p>
          </div>

          <div className="mt-8">
            <WardropForm />
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section>
        <div className="mx-auto max-w-3xl px-5 py-16 sm:px-6 lg:py-24">
          <Eyebrow>Before you ask</Eyebrow>
          <Display className="text-4xl sm:text-5xl">Questions</Display>
          <div className="mt-8 divide-y divide-white/10 border-t border-white/10">
            {FAQS.map((f) => (
              <details key={f.q} className="group py-5">
                <summary
                  className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold text-white
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-4 focus-visible:ring-offset-[#0A0A0A]"
                >
                  {f.q}
                  <span aria-hidden className="text-2xl leading-none text-cyan-400 group-open:hidden">
                    +
                  </span>
                  <span aria-hidden className="hidden text-2xl leading-none text-cyan-400 group-open:inline">
                    –
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-white/55">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-white/5 py-8 text-center text-xs text-white/35">
        ASCEND · by John Leitch Coaching ·{' '}
        <a href="mailto:john.leitch@playitloveit.com" className="underline hover:text-white/60">
          john.leitch@playitloveit.com
        </a>
      </footer>
    </div>
  )
}
