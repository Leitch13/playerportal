import type { Metadata } from 'next'
import Link from 'next/link'

// Academy-facing setup guide for the per-academy Meta Pixel feature.
// Light "Daylight" marketing style. Indexable on purpose — it doubles as
// SEO for "meta pixel football academy" searches.
export const metadata: Metadata = {
  title: 'Run Facebook & Instagram Ads for Your Academy — Meta Pixel Setup',
  description:
    'Connect your own Meta Pixel to your Player Portal booking pages in 5 minutes — then run parent-recruitment ads that optimise for real trial bookings, not clicks.',
}

const STEPS = [
  {
    title: 'Create your pixel (2 minutes)',
    body: 'Go to Meta Events Manager (business.facebook.com/events_manager) → Connect data → Web. Give it your academy’s name. If it asks you to "choose a partner" or install code — skip all of that. You just need the ID.',
  },
  {
    title: 'Copy the Dataset ID',
    body: 'On your new pixel’s page you’ll see a long number (15–16 digits) under the name — that’s the Dataset ID (also called Pixel ID). Copy it.',
  },
  {
    title: 'Paste it into Player Portal',
    body: 'Dashboard → Settings → "Meta Pixel ID" → paste → Save. That’s the whole setup. No code, no developer, nothing to install.',
  },
]

const EVENTS = [
  { name: 'PageView', when: 'Any parent visits your booking pages', use: 'Builds retargeting audiences — parents who looked but didn’t book yet' },
  { name: 'Lead', when: 'A parent books a free trial', use: 'The event to optimise ads on — Meta finds more parents like the ones who book' },
  { name: 'InitiateCheckout (with £ value)', when: 'A parent starts a paid signup', use: 'See what your ad spend actually generates in membership value' },
]

export default function MetaPixelGuidePage() {
  return (
    <div className="min-h-screen bg-[#f6f9fb] text-[#0d1b2b]">
      <header className="px-6 py-4 border-b border-[#e3ebf0] bg-white">
        <div className="mx-auto max-w-3xl flex items-center justify-between">
          <Link href="/" className="italic font-black leading-none select-none">
            <span className="block text-[10px] tracking-widest text-[#0a97b6]">THE</span>
            <span className="block text-lg tracking-tight text-[#0d1b2b]">PLAYER P<span className="text-[#0a97b6]">O</span>RTAL</span>
          </Link>
          <span className="text-xs text-[#93a2ad]">Academy guide</span>
        </div>
      </header>

      <main className="px-6 py-12">
        <div className="mx-auto max-w-3xl">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#0a97b6] font-semibold">5-minute setup · free feature</p>
          <h1 className="mt-4 text-3xl sm:text-4xl font-black tracking-[-0.02em]" style={{ textWrap: 'balance' } as React.CSSProperties}>
            Run Facebook &amp; Instagram ads that actually fill your classes
          </h1>
          <p className="mt-4 text-lg text-[#5a6b7c]">
            Your Player Portal booking pages can report to your own Meta Pixel. Once connected, Meta stops
            optimising your ads for random clicks and starts hunting for the thing you actually want:
            <strong className="text-[#0d1b2b]"> parents who book</strong>.
          </p>

          <h2 className="mt-12 text-2xl font-black tracking-[-0.01em]">Setup — three steps, no code</h2>
          <div className="mt-6 space-y-4">
            {STEPS.map((s, i) => (
              <div key={s.title} className="rounded-2xl bg-white border border-[#e3ebf0] p-6 flex gap-4">
                <div className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-white font-black" style={{ background: 'linear-gradient(170deg,#12a2bd,#0b7f96)' }}>{i + 1}</div>
                <div>
                  <h3 className="font-bold">{s.title}</h3>
                  <p className="mt-1.5 text-sm text-[#5a6b7c] leading-relaxed">{s.body}</p>
                </div>
              </div>
            ))}
          </div>

          <h2 className="mt-12 text-2xl font-black tracking-[-0.01em]">What gets tracked (automatically)</h2>
          <p className="mt-3 text-[#5a6b7c]">
            From the moment you save your ID, your public pages fire these events to <em>your</em> pixel —
            consent-gated, so it&apos;s GDPR-compliant out of the box:
          </p>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-sm bg-white rounded-2xl border border-[#e3ebf0] overflow-hidden">
              <thead>
                <tr className="text-left border-b border-[#e3ebf0]">
                  <th className="p-4 font-bold">Event</th>
                  <th className="p-4 font-bold">Fires when</th>
                  <th className="p-4 font-bold">Why it matters</th>
                </tr>
              </thead>
              <tbody>
                {EVENTS.map((e) => (
                  <tr key={e.name} className="border-b border-[#e3ebf0] last:border-0 align-top">
                    <td className="p-4 font-semibold whitespace-nowrap">{e.name}</td>
                    <td className="p-4 text-[#5a6b7c]">{e.when}</td>
                    <td className="p-4 text-[#5a6b7c]">{e.use}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="mt-12 text-2xl font-black tracking-[-0.01em]">Then: your first parent-recruitment ad</h2>
          <ol className="mt-4 space-y-3 text-[#5a6b7c]">
            <li className="flex gap-3"><span className="font-black text-[#0a97b6]">1.</span><span>In Ads Manager, create a campaign with the <strong className="text-[#0d1b2b]">Leads</strong> objective, conversion location <strong className="text-[#0d1b2b]">Website</strong>.</span></li>
            <li className="flex gap-3"><span className="font-black text-[#0a97b6]">2.</span><span>Pick your pixel and choose <strong className="text-[#0d1b2b]">Lead</strong> as the conversion event.</span></li>
            <li className="flex gap-3"><span className="font-black text-[#0a97b6]">3.</span><span>Point the ad at your Player Portal <strong className="text-[#0d1b2b]">trial page</strong> (the &ldquo;free trial, no account needed&rdquo; one converts best for cold audiences).</span></li>
            <li className="flex gap-3"><span className="font-black text-[#0a97b6]">4.</span><span>Target your local area (10&ndash;15 miles), use a real photo from your sessions, and say who it&apos;s for in the first line &mdash; e.g. <em>&ldquo;Parents of 5&ndash;12 year olds in Aberdeen&rdquo;</em>.</span></li>
            <li className="flex gap-3"><span className="font-black text-[#0a97b6]">5.</span><span>Start at &pound;5&ndash;10/day, leave it alone for 3&ndash;4 days, then judge by <strong className="text-[#0d1b2b]">cost per Lead</strong> &mdash; not clicks.</span></li>
          </ol>

          <div className="mt-12 rounded-2xl bg-white border-2 border-[#0a97b6] p-6">
            <h3 className="font-black text-lg">Questions?</h3>
            <p className="mt-2 text-sm text-[#5a6b7c]">
              Message us through your dashboard or reply to any Player Portal email — happy to sanity-check your
              first campaign before you spend a penny.
            </p>
          </div>

          <div className="mt-10 text-center text-xs text-[#93a2ad]">
            <Link href="/" className="hover:text-[#0a97b6]">theplayerportal.net</Link>
          </div>
        </div>
      </main>
    </div>
  )
}
