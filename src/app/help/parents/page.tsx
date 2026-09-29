import type { Metadata } from 'next'
import Link from 'next/link'

// Public how-to videos for parents, the same for every academy (recorded on the
// demo academy, shown as "Your Academy"). No login, so the link works straight
// from an email. Videos live in /public/help; source configs in marketing/videos.

export const metadata: Metadata = {
  title: 'How-to videos for parents',
  description: 'Short videos: confirming your place, booking a class, your parent page, missing a session or changing your card.',
}

const CLIPS = [
  { id: 'confirm', file: 'confirming-your-place', title: 'Confirming your place', blurb: 'Your academy has moved to Player Portal and emailed you a link. Open it, check the class and price, add your card.' },
  { id: 'booking', file: 'booking', title: 'Booking a class', blurb: 'New to the academy? Pick a class, choose a plan or a free session, fill in your details and pay.' },
  { id: 'parent-page', file: 'parent-page', title: 'Your parent page', blurb: 'Next session, what you pay, your child’s schedule, and adding a brother or sister.' },
  { id: 'missing-a-session', file: 'cant-make-it', title: 'Missing a session or a new card', blurb: 'Tell the coach in Messages, and update your card from Membership → Manage Billing.' },
] as const

export default function ParentHelpPage() {
  return (
    <main className="min-h-screen bg-[#080e18] text-white" style={{ backgroundImage: 'radial-gradient(60rem 28rem at 50% -8rem, #4ecde624, transparent 70%)' }}>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
        <header className="mb-8 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#4ecde6]">Help for parents</p>
          <h1 className="mt-2 text-3xl font-bold leading-tight sm:text-4xl">How-to videos</h1>
          <p className="mt-2 text-sm leading-relaxed text-white/60">Each one is about 30 seconds. They work the same at every academy on Player Portal; yours will show its own name and colours.</p>
          <Link href="/dashboard" className="mt-4 inline-block text-sm font-semibold text-[#4ecde6] hover:underline">&larr; Back to your dashboard</Link>
        </header>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {CLIPS.map((c) => (
            <section key={c.id} id={c.id} className="scroll-mt-6 rounded-2xl border border-white/[0.08] bg-[#0f1a2b] p-3">
              <video
                className="aspect-[9/16] w-full rounded-xl bg-black object-cover"
                src={`/help/${c.file}.mp4`}
                poster={`/help/${c.file}.jpg`}
                controls
                playsInline
                preload="none"
              />
              <h2 className="mt-3 px-1 text-base font-semibold">{c.title}</h2>
              <p className="mt-1 px-1 pb-1 text-[13px] leading-snug text-white/55">{c.blurb}</p>
            </section>
          ))}
        </div>

        <p className="mt-8 text-sm text-white/50">Still stuck? Reply to any email from your academy, or message them from your dashboard. They&apos;ll sort it out with you.</p>
      </div>
    </main>
  )
}
