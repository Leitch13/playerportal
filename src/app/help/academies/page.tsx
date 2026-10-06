import type { Metadata } from 'next'
import Link from 'next/link'

// Public how-to videos for academy owners and admins, the same for every academy
// (recorded on a demo academy, shown as "Your Academy"). No login, so the link
// works from an email or a text. Videos live in /public/help; source configs in
// marketing/videos (config-admin-*.json).

export const metadata: Metadata = {
  title: 'How-to videos for academies',
  description: 'Short videos for academy owners: your first ten minutes, adding a class and a plan, who has paid, camps and waiting lists, and 1-2-1s.',
}

const CLIPS = [
  { id: 'first-ten-minutes', file: 'academy-first-ten-minutes', title: 'Your first ten minutes', blurb: 'Just signed up? Your home page, making it yours, adding classes, and your booking page.' },
  { id: 'class-and-plan', file: 'academy-class-and-plan', title: 'Add a class and a plan', blurb: 'Create a class, set its price under Plans & Pricing, and see what parents see.' },
  { id: 'who-has-paid', file: 'academy-who-has-paid', title: 'Who has paid', blurb: 'See who’s paying in each class, find anyone who isn’t, and send them a payment link.' },
  { id: 'camps', file: 'academy-camps', title: 'Camps and waiting lists', blurb: 'Set up a camp. When it fills, parents join the waiting list and you invite them when a place opens.' },
  { id: 'one-to-ones', file: 'academy-one-to-ones', title: '1-2-1s and 2-to-1s', blurb: 'Regular slots, adding a pair in one go, resending a pay link, and the week’s timetable.' },
] as const

export default function AcademyHelpPage() {
  return (
    <main className="min-h-screen bg-[#080e18] text-white" style={{ backgroundImage: 'radial-gradient(60rem 28rem at 50% -8rem, #4ecde624, transparent 70%)' }}>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
        <header className="mb-8 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#4ecde6]">Help for academies</p>
          <h1 className="mt-2 text-3xl font-bold leading-tight sm:text-4xl">How-to videos</h1>
          <p className="mt-2 text-sm leading-relaxed text-white/60">Each one is 30 to 40 seconds and shows exactly where to press. They&apos;re recorded on a demo academy; yours will show its own name, classes and families.</p>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm font-semibold">
            <Link href="/dashboard" className="text-[#4ecde6] hover:underline">&larr; Back to your dashboard</Link>
            <Link href="/help/parents" className="text-white/60 hover:text-white hover:underline">Videos to send your parents</Link>
          </div>
        </header>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5" data-testid="academy-videos">
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

        <p className="mt-8 text-sm text-white/50">Still stuck? Email support@theplayerportal.net and we&apos;ll sort it out with you.</p>
      </div>
    </main>
  )
}
