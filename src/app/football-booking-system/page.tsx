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
import BreadcrumbSchema from '@/components/seo/BreadcrumbSchema'
import { CampsMock } from '@/components/marketing/homepage/mocks'
import { canonicalFor } from '@/components/marketing/landing/types'

const SLUG = 'football-booking-system'
const CANONICAL = canonicalFor(SLUG)

// Layout's title template appends " | Player Portal" — pass keyword only.
const TITLE = 'Football Booking System'
const OG_TITLE = `${TITLE} | Player Portal`
const DESCRIPTION =
  'A football booking system built for academies: online bookings, waiting lists, trial slots, capacity limits and instant confirmations. Parents self-serve; you stop answering "is there a space?" texts on a Sunday.'

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
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Football booking system for academies — Player Portal' }],
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
  name: 'Player Portal — Football Booking System',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  url: CANONICAL,
  description: DESCRIPTION,
  offers: {
    '@type': 'Offer',
    price: '20',
    priceCurrency: 'GBP',
    priceSpecification: {
      '@type': 'UnitPriceSpecification',
      price: '20',
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
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: 'https://www.theplayerportal.net' },
          { name: 'Football Booking System', url: CANONICAL },
        ]}
      />
      <TopNav />
      <main className="pt-16">
        <LandingHero
          eyebrow="FOOTBALL BOOKING SYSTEM"
          h1="A booking system parents actually use."
          h1Highlight="Not a form that gets ignored."
          subhead="Player Portal's football booking system lets parents book classes, trials and camps at the URL you share. Capacity limits, automatic waitlists and instant confirmations — you stop being the phone tag."
          primaryCta={{ label: 'Try free for 14 days', href: '/onboard' }}
          secondaryCta={{ label: 'See how it works', href: '/how-it-works' }}
          trustDots={['Public booking page', 'Waitlists included', 'Trial-to-member conversion', '14-day free trial']}
          visual={<CampsMock />}
        />

        <TrustStrip />

        <LandingProblem
          eyebrow="THE BOOKING PROBLEM"
          headline="Every academy loses bookings the same way."
          headlineHighlight="On a Sunday night. In a WhatsApp group."
          body="A parent asks in the group chat if there's a space in Wednesday's U9s. You screenshot the register. Someone else asks. Another parent DMs you privately. You forget to reply. By Monday, someone has signed up with a rival academy that had a clean booking page."
          punchline="Booking friction costs you players you'd otherwise keep."
          beforeCard={{
            title: 'Bookings by DM and gut.',
            subtitle: 'Parents ask. You reply. You forget who\'s in. You double-book. You miss the waitlist. You lose the family.',
            items: [
              { icon: '💬', label: 'WhatsApp DMs', tail: '"is there space?"' },
              { icon: '📞', label: 'Voicemails', tail: 'called back Tuesday' },
              { icon: '📊', label: 'Register in Sheets', tail: 'v11_actual.xlsx' },
              { icon: '❌', label: 'Missed replies', tail: '3 signups lost' },
              { icon: '🗓️', label: 'Overbooked class', tail: 'coach unhappy' },
              { icon: '📱', label: 'No waitlist', tail: 'no follow-up' },
            ],
          }}
          afterCard={{
            title: 'A URL. A capacity. A confirmation.',
            subtitle: 'Parents book themselves. You see the register update live. When a class fills, waitlist opens automatically.',
            bullets: [
              'Public booking URL per class',
              'Capacity + waitlist rules',
              'Trial slots with time-boxed expiry',
              'Instant email confirmation',
              'Auto-enrolment on payment',
              'Register updates the moment they book',
            ],
            closingLine: 'You share the link once. Bookings run themselves.',
          }}
        />

        <LandingWhyBar
          eyebrow="WHY THIS MATTERS"
          headline="A friction-free booking page is a growth channel."
          intro="Not a form. A conversion funnel. Every academy on Player Portal fills classes faster once the booking friction goes away — because the buying moment lands on a URL, not a Sunday-night DM."
          points={[
            {
              stat: '<60s',
              label: 'to book',
              sub: 'From landing on the class page to a confirmed slot. Parent enters child\'s name, DOB, chooses a plan, pays or books a trial.',
            },
            {
              stat: '24/7',
              label: 'bookings open',
              sub: 'Parents book at 21:47 when they finally get five minutes. You don\'t have to be online to say yes.',
            },
            {
              stat: 'Unlimited',
              label: 'players every tier',
              sub: '£20 (Starter) gets you the whole booking system — pages, waitlists, trials, capacity — for unlimited players. Pro (£35) adds waitlist automation and referrals. Enterprise (£60) adds white-label. Transaction fee steps down as you scale (3.5% → 2%); no per-booking surcharge.',
            },
          ]}
        />

        <LandingSolution
          eyebrow="HOW BOOKINGS WORK"
          headline="Parents self-serve."
          headlineHighlight="You do less. More families join."
          paragraphs={[
            'Every class, camp and trial slot in Player Portal has its own public page. You share the URL — website, social, WhatsApp bio, printed flyer QR code, doesn\'t matter. The parent lands on a page that matches your branding, sees the class details, capacity, price, day and coach, and books their child in three steps.',
            'If the class has a capacity limit and it\'s full, the page shows a waitlist option instead of "no bookings available." Waitlist parents get an automatic email the moment a slot opens. You don\'t chase; the system does.',
            'Trials are their own flow — a time-boxed slot at a trial price (£0 or £5 or whatever you set), converting to a full membership automatically if the parent decides to sign up. Nothing manual. No "I\'ll add you to the register." No dropped conversions.',
          ]}
          checklist={[
            'One URL per class — share it anywhere',
            'Waitlists auto-open when capacity is reached',
            'Trial slots convert to memberships on the parent\'s next click',
            'Capacity rules by class, by age group, or by term',
            'Instant email confirmation (branded) on every successful booking',
            'Booking updates the register immediately — coaches see the child before Wednesday',
          ]}
        />

        <LandingFeatureGrid
          eyebrow="BOOKING FEATURES"
          headline="Everything a booking system for an academy actually needs."
          intro="Booking a football class is not booking a hotel room. These are the surfaces built for how parents actually decide, and how academies actually run."
          features={[
            { label: 'Public booking page', tagline: 'A URL your parents will actually use.', description: 'One page per class or camp. Class details, coach, day, time, venue, price. Mobile-first. Loads in under two seconds even on train wifi.' },
            { label: 'Waitlists', tagline: 'Full class ≠ lost family.', description: 'When a class hits capacity, the page shows a waitlist option instead of a dead-end. When a spot opens, the top of the waitlist gets emailed automatically.' },
            { label: 'Trial bookings', tagline: 'Try before you commit.', description: 'Time-boxed trial slots at a price you set. If the parent signs up during the trial window, the booking upgrades to a full membership automatically — no re-entry.' },
            { label: 'Capacity limits', tagline: 'Never overbook a coach.', description: 'Set max per class, per age group, per session. The booking page shows real availability. Coaches never turn up to a session with more kids than pitches.' },
            { label: 'Instant confirmations', tagline: 'Email lands before they close the tab.', description: 'Branded confirmation email fires the moment payment (or trial booking) succeeds. Includes class details, first-session date, kit list and your contact info.' },
            { label: 'Auto-enrolment', tagline: 'Booked = on the register.', description: 'A successful booking creates the player record, links them to the class, updates the register, and slots them into the subscription. Zero manual re-entry.' },
          ]}
        />

        <LandingFAQ
          eyebrow="COMMON QUESTIONS"
          headline="Booking questions academy owners ask."
          items={[
            {
              q: 'Can parents book without creating an account first?',
              a: 'Yes. The booking flow creates the parent + player records for you at the moment they pay or confirm a trial. They don\'t hit a "create account first" wall. First real interaction is a booking, not a signup form.',
            },
            {
              q: 'What happens when a class fills up?',
              a: 'The class page automatically shows a waitlist form instead of a dead-end. Parents on the waitlist get an email the moment a slot opens — usually because someone cancelled or a subscription lapsed. First-come-first-served, or you can promote a specific family manually.',
            },
            {
              q: 'Can I take bookings for trial sessions and one-off camps at the same time as memberships?',
              a: 'Yes. Trials, camps and monthly memberships are three separate booking types — parents choose the one that fits. A trial can auto-convert to a membership if the parent signs up within the trial window. Camps are one-off bookings that don\'t create a recurring subscription.',
            },
            {
              q: 'Does the booking page take payment?',
              a: 'Yes, through your connected Stripe account. Parents enter card details on the booking page (never on the phone) and the money lands in your Stripe balance. Player Portal never touches the money. Player Portal takes a transaction fee that steps down by tier (3.5% Starter, 2.5% Pro, 2% Enterprise); Stripe\'s own card fee is separate. There\'s no per-booking surcharge on top of that.',
            },
            {
              q: 'Can I embed the booking on my own website?',
              a: 'Yes. Every class has a public page you can link to, and there\'s an embed URL for putting the booking flow inside your own site. Most academies just link out — cleaner, faster to load, and the parent lands on a page that already handles mobile properly.',
            },
            {
              q: 'What information does the booking capture?',
              a: 'Child\'s name, DOB, parent contact details, medical info, photo consent, terms consent, and any custom fields you configure. Consents are stored per-player with signature timestamps for safeguarding audit trails.',
            },
          ]}
        />

        <LandingCTA
          headline={'Turn “is there space?”'}
          headlineHighlight="into a link you share once."
          subhead="Set up your first class, get your public booking URL, share it with parents. Player Portal handles capacity, waitlists, confirmations and enrolment automatically. 14 days free."
          primaryCta={{ label: 'Try free for 14 days', href: '/onboard' }}
          secondaryCta={{ label: 'See the demo', href: '/how-it-works' }}
          microCopy="No card required. Migrate existing bookings from ClassForKids in an afternoon."
        />

        <LandingInternalLinks currentSlug={SLUG} />
      </main>
      <Footer />
    </div>
  )
}
