import type { Metadata } from 'next'
import TopNav from '@/components/marketing/homepage/TopNav'
import TrustStrip from '@/components/marketing/homepage/TrustStrip'
import Footer from '@/components/marketing/homepage/Footer'
import LandingHero from '@/components/marketing/landing/LandingHero'
import LandingProblem from '@/components/marketing/landing/LandingProblem'
import LandingWhyBar from '@/components/marketing/landing/LandingWhyBar'
import LandingSolution from '@/components/marketing/landing/LandingSolution'
import LandingFeatureGrid from '@/components/marketing/landing/LandingFeatureGrid'
import LandingFAQ from '@/components/marketing/landing/LandingFAQ'
import LandingCTA from '@/components/marketing/landing/LandingCTA'
import LandingInternalLinks from '@/components/marketing/landing/LandingInternalLinks'
import { ParentHubMock } from '@/components/marketing/homepage/mocks'
import { canonicalFor } from '@/components/marketing/landing/types'

const SLUG = 'football-academy-management-software'
const CANONICAL = canonicalFor(SLUG)

// Layout's Metadata title template appends " | Player Portal" already, so
// pass only the keyword phrase here to avoid a duplicated brand suffix.
const TITLE = 'Football Academy Management Software'
const OG_TITLE = `${TITLE} | Player Portal`
const DESCRIPTION =
  'Football academy management software that runs bookings, memberships, payments, attendance, camps and parent communication from one login. Built for UK academy owners who are done juggling six tools.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: CANONICAL },
  openGraph: {
    type: 'website',
    locale: 'en_GB',
    url: CANONICAL,
    siteName: 'Player Portal',
    title: OG_TITLE,
    description: DESCRIPTION,
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Football academy management software — Player Portal' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: OG_TITLE,
    description: DESCRIPTION,
    images: ['/og-image.png'],
  },
}

const softwareApplicationSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Player Portal — Football Academy Management Software',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  url: CANONICAL,
  description: DESCRIPTION,
  offers: {
    '@type': 'Offer',
    price: '29',
    priceCurrency: 'GBP',
    priceSpecification: {
      '@type': 'UnitPriceSpecification',
      price: '29',
      priceCurrency: 'GBP',
      unitText: 'MONTH',
    },
    availability: 'https://schema.org/InStock',
  },
  provider: {
    '@type': 'Organization',
    name: 'Player Portal',
    url: 'https://www.theplayerportal.net',
  },
}

export default function Page() {
  return (
    <div className="bg-[#0a0a0a] text-white min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationSchema) }}
      />
      <TopNav />
      <main className="pt-16">
        <LandingHero
          eyebrow="FOOTBALL ACADEMY MANAGEMENT SOFTWARE"
          h1="One platform to run the whole academy."
          h1Highlight="Not six tabs and a spreadsheet."
          subhead="Player Portal is the football academy management software UK academy owners use to handle bookings, memberships, payments, attendance, camps and parent communication from a single login. Set up in a day. Cancel in a click."
          primaryCta={{ label: 'Try free for 14 days', href: '/onboard' }}
          secondaryCta={{ label: 'See it in action', href: '/how-it-works' }}
          trustDots={['Built by an academy', 'No card required', 'Migrate from ClassForKids', 'UK-hosted, GDPR-ready']}
          visual={<ParentHubMock />}
        />

        <TrustStrip />

        <LandingProblem
          eyebrow="WHY ACADEMY OWNERS SWITCH"
          headline="You started an academy to coach kids."
          headlineHighlight="Not to run a mini ops department."
          body="Most growing academies end up stitched together across ClassForKids for bookings, a spreadsheet for members, Stripe for payments, Mailchimp for updates, WhatsApp groups for coaches, and a personal phone for chasing overdue parents. Every tool has a login. None of them talk to each other."
          punchline="That's not a stack. That's a tax on your evenings."
          beforeCard={{
            title: 'Running an academy on six tools.',
            subtitle: 'Bookings live over there. Payments over here. Parents in the group chat. You in the middle at 9:47pm.',
            items: [
              { icon: '🗓️', label: 'ClassForKids', tail: 'bookings' },
              { icon: '📊', label: 'Google Sheets', tail: 'members_v14.xlsx' },
              { icon: '💳', label: 'Stripe', tail: 'who paid?' },
              { icon: '💬', label: 'WhatsApp', tail: '48 unread' },
              { icon: '📧', label: 'Mailchimp', tail: 'not synced' },
              { icon: '📱', label: 'Personal phone', tail: 'reminders at 21:47' },
            ],
          }}
          afterCard={{
            title: 'One place. Everything joined up.',
            subtitle: 'When a parent books, the register updates. When a payment fails, the parent hub tells them. When a coach checks in, the report writes itself.',
            bullets: [
              'Bookings, trials & camps',
              'Memberships & subscriptions',
              'Payments & Stripe billing',
              'Attendance & registers',
              'Parent hub & messaging',
              'Reports the founder built for herself',
            ],
            closingLine: 'Same data. Same permissions. Same login. Same place.',
          }}
        />

        <LandingWhyBar
          eyebrow="WHY THIS MATTERS"
          headline="What managing an academy on six tools actually costs."
          intro="Not the £30/month per tool. The evenings, the drop-outs, and the coaches who don't have the register when they need it."
          points={[
            {
              stat: '5 hrs',
              label: 'saved per week',
              sub: 'per academy owner, once bookings and billing live in the same place. Confirmed against a paying academy on Player Portal.',
            },
            {
              stat: '<24h',
              label: 'to switch in',
              sub: 'Export from ClassForKids, upload, confirm with parents, first real charge on the date you pick.',
            },
            {
              stat: '£0',
              label: 'booking fees',
              sub: 'Flat monthly subscription. No 5% per-booking cut. What parents pay is what your academy sees.',
            },
          ]}
        />

        <LandingSolution
          eyebrow="HOW IT WORKS"
          headline="One login. Every surface your academy needs."
          headlineHighlight="Set up in a day. Not in a demo call series."
          paragraphs={[
            'Player Portal was built by an academy owner who was fed up losing a Sunday every quarter reconciling Stripe against a Google Sheet. Every surface in the platform exists because we needed it ourselves — not because a product manager thought it was a feature.',
            'The academy owner side of the platform handles bookings, memberships, trials, camps, plans, waitlists, payment status, attendance registers, coach schedules, session notes, GDPR consents, DBS tracking, and revenue reporting. The parent side handles their own hub — payment status, booking history, invoices, kit sizes, medical info and consents — so they stop DMing you at 9pm.',
            'You do not need three onboarding calls to start. You do not need a compliance sign-off. You do not need a data warehouse consultant. You set up your first class, connect Stripe, invite parents, and you are live.',
          ]}
          checklist={[
            'Single login covers admin, coaches and parents (with distinct permissions)',
            'Data model is player-first — one player, one record, everywhere',
            'Migrate from ClassForKids in an afternoon with parent-confirmation links',
            'UK-hosted on Supabase in London, DPA on request, no US data transfer',
            'Cancel in a click and export everything as CSV — your data stays yours',
          ]}
        />

        <LandingFeatureGrid
          eyebrow="MANAGEMENT SURFACES"
          headline="Every part of the academy in one product."
          intro="These are the operational surfaces admins actually spend time in. Each links to the same data — a change in one place propagates everywhere."
          features={[
            { label: 'Bookings', tagline: 'Public booking page for classes, camps and trials.', description: 'Parents self-serve at the URL you share. Capacity limits, waitlists, trial-to-member conversions and instant confirmations — no back-and-forth phone tag.' },
            { label: 'Memberships', tagline: 'Monthly subscriptions on Stripe.', description: 'Set plans by class, age group or bundle. Player Portal handles pro-rata joins, term-based billing, family discounts and cancellations without you touching the Stripe dashboard.' },
            { label: 'Attendance', tagline: 'A register that takes 30 seconds.', description: 'Coach opens the app pitch-side, taps present or absent, done. Attendance links to the player record and surfaces on progress reports automatically.' },
            { label: 'Parent hub', tagline: 'Where parents live.', description: 'Kit size, medical info, invoice history, payment method, booking status, consents. Update once, works everywhere. Kills the "quick question?" WhatsApp.' },
            { label: 'Messaging', tagline: 'In-app comms with delivery tracking.', description: 'Send updates to one parent, one class or the whole academy. Optional email fallback via Resend. Not another WhatsApp group.' },
            { label: 'Reports', tagline: 'The numbers your last platform never gave you.', description: 'Weekly revenue, at-risk members, trial-conversion funnel, coach attendance rates, camp fill-rates. Built for founder-operators, not analysts.' },
          ]}
        />

        <LandingFAQ
          eyebrow="FREQUENTLY ASKED"
          headline="What academy owners ask before switching."
          items={[
            {
              q: 'Is Player Portal a real replacement for ClassForKids?',
              a: 'Yes. Player Portal handles bookings, memberships, payments, attendance, camps and the parent hub — the same operational surface ClassForKids does — plus the reporting and communication layers ClassForKids doesn\'t. Migration is one afternoon: export CSV, upload, confirm with parents, first real charge on the date you choose. Zero double-charges.',
            },
            {
              q: 'How is Player Portal priced compared to ClassForKids?',
              a: 'Flat monthly subscription from £29/month for up to 25 members, £59/month for up to 200, £119/month unlimited. No per-booking fee. Stripe fees pass through at 2% (1.5% on Pro). ClassForKids typically charges 5% per booking on top of a base fee — for a 100-member academy taking £4,000/month, that is around £200/month in fees Player Portal doesn\'t take.',
            },
            {
              q: 'Do we have to migrate everything before we can start?',
              a: 'No. Start with one class and add the rest as you go, or migrate the whole membership on day one. The migration wizard handles both. You can also run Player Portal alongside your existing tool for a term while you get comfortable — nothing double-charges anyone.',
            },
            {
              q: 'What about GDPR, DBS checks and safeguarding?',
              a: 'Data is UK-hosted on Supabase in London. DPA is available on request. Consent forms (medical, photo, terms) are collected at signup with parent signatures stored per player. DBS status is tracked per coach with expiry reminders. Nothing is trained on your data. Nothing is sold. Nothing leaves the UK.',
            },
            {
              q: 'Who uses Player Portal today?',
              a: 'Growing UK football academies with 30-300 members. Every academy on the platform migrated from another tool (mostly ClassForKids or a spreadsheet). Jamie Allan Football Academy and Gold & Gray Soccer Academy are two of them.',
            },
            {
              q: 'What if we cancel?',
              a: 'Cancel in a click, from your settings. No forms, no calls, no lock-in. Export every player, parent, payment and message as CSV on the way out. Your data stays yours.',
            },
          ]}
        />

        <LandingCTA
          headline="Stop juggling tools."
          headlineHighlight="Start running the academy."
          subhead="Player Portal is the football academy management software UK academies switch to when they hit the wall of six tabs and a spreadsheet. 14-day free trial. Cancel any time. Migrate in an afternoon."
          primaryCta={{ label: 'Try free for 14 days', href: '/onboard' }}
          secondaryCta={{ label: 'Book a demo', href: '/how-it-works' }}
          microCopy="Built by an academy. Trusted by growing academies. Made in Aberdeen."
        />

        <LandingInternalLinks currentSlug={SLUG} />
      </main>
      <Footer />
    </div>
  )
}
