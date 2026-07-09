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
import { PaymentsMock } from '@/components/marketing/homepage/mocks'
import { canonicalFor } from '@/components/marketing/landing/types'

const SLUG = 'academy-payment-collection'
const CANONICAL = canonicalFor(SLUG)

// Layout's title template appends " | Player Portal" — pass keyword only.
const TITLE = 'Academy Payment Collection Software'
const OG_TITLE = `${TITLE} | Player Portal`
const DESCRIPTION =
  'Academy payment collection on Stripe: monthly memberships, family billing, failed-payment recovery, automatic renewals and payment reminders. Stop chasing 40 parents for £30 on a Sunday night.'

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
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Academy payment collection with Stripe — Player Portal' }],
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
  name: 'Player Portal — Academy Payment Collection',
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
          { name: 'Academy Payment Collection', url: CANONICAL },
        ]}
      />
      <TopNav />
      <main className="pt-16">
        <LandingHero
          eyebrow="ACADEMY PAYMENT COLLECTION"
          h1="Payments that collect themselves."
          h1Highlight="Not a Sunday-night reconciliation ritual."
          subhead="Player Portal handles academy payment collection on Stripe: monthly memberships, family billing, failed-payment recovery, automatic renewals and payment reminders. You stop being the debt collector for £30 twice a month."
          primaryCta={{ label: 'Try free for 14 days', href: '/onboard' }}
          secondaryCta={{ label: 'See it in action', href: '/how-it-works' }}
          trustDots={['Stripe-native billing', 'Family discounts', 'Failed payment recovery', 'Cancel any time']}
          visual={<PaymentsMock />}
        />

        <TrustStrip />

        <LandingProblem
          eyebrow="THE PAYMENTS PROBLEM"
          headline="You chase 12 parents for £30."
          headlineHighlight="Every month. Personally."
          body="Standing orders lapse. Bank details change. A card expires. A parent forgets. Two families have a new baby and forget you exist for six weeks. You end up messaging people individually to say — very politely — that their child's football fees are late. Nobody enjoys this bit."
          punchline="Payment chasing is where academies quietly lose revenue and dignity at the same time."
          beforeCard={{
            title: 'Payments by standing order and hope.',
            subtitle: 'Stripe on one tab. Bank statement on another. Reconciliation happens on the sofa at 22:00 on a Sunday.',
            items: [
              { icon: '🏦', label: 'Standing orders', tail: 'lapsed' },
              { icon: '💳', label: 'Card expired', tail: 'silent fail' },
              { icon: '📊', label: 'Sheet of debtors', tail: '12 rows' },
              { icon: '💬', label: '"Sorry to chase"', tail: 'again' },
              { icon: '📞', label: 'Awkward phone calls', tail: 'unpaid £30' },
              { icon: '❌', label: 'Members quietly leaving', tail: 'no exit reason' },
            ],
          }}
          afterCard={{
            title: 'Stripe billing. Automated recovery. Real numbers.',
            subtitle: 'Failed payments retry themselves. Parents update cards from their own hub. Weekly revenue tells you the truth.',
            bullets: [
              'Monthly subscriptions on Stripe',
              'Auto-retry failed payments (3x smart schedule)',
              'Parents update cards themselves',
              'Family discounts + sibling pricing',
              'Weekly revenue view + at-risk flags',
              'GDPR-compliant invoice history per family',
            ],
            closingLine: 'The money lands in your Stripe balance. Player Portal never touches it.',
          }}
        />

        <LandingWhyBar
          eyebrow="WHY THIS MATTERS"
          headline="Recovered payments are the highest-margin revenue you have."
          intro="Every £30 monthly member you retain instead of losing to a failed payment is £360/year of pure margin. Multiply by your churn. This is the math nobody in your finance stack is doing."
          points={[
            {
              stat: '~7%',
              label: 'monthly failure rate',
              sub: 'is normal for card-on-file subscription billing. Half of those are recoverable with a smart retry schedule and a self-serve card update.',
            },
            {
              stat: '£360',
              label: 'per saved member',
              sub: 'is what one recovered £30/month member is worth in a year of retained revenue. Multiply by your current failed-payment attrition.',
            },
            {
              stat: 'Unlimited',
              label: 'players every tier',
              sub: 'No cap at £20 (Starter), £35 (Pro) or £60 (Enterprise). Player Portal takes a transaction fee that steps down as you scale — 3.5% Starter, 2.5% Pro, 2% Enterprise. Stripe\'s own card fees apply separately.',
            },
          ]}
        />

        <LandingSolution
          eyebrow="HOW BILLING WORKS"
          headline="You set the plan."
          headlineHighlight="Stripe collects. Player Portal recovers."
          paragraphs={[
            'Every plan in Player Portal maps to a Stripe subscription. You define the price, the billing interval, the training group it applies to, and the trial or pro-rata rules. When a parent signs up, a Stripe subscription is created against their card. Every renewal fires without you touching it.',
            'When a payment fails — and it will, 5-10% of the time, because cards expire and banks flag things — Player Portal retries on a smart schedule (day 1, day 3, day 7). The parent gets a branded email at each stage. Their own parent hub shows the payment status and a one-click "update card" button. Most failures self-recover before you have to know they happened.',
            'The academy owner side gives you a weekly revenue view, an at-risk members list (failing payments, cancelling, missed sessions), and a family billing view so a household with three kids sees one bill instead of three. You still see the individual subscriptions in the background — the family view is just how parents want to think about it.',
          ]}
          checklist={[
            'Stripe-native subscriptions — money lands directly in your Stripe balance',
            'Automatic retry schedule for failed cards, no manual chasing needed',
            'Parents self-serve card updates from their hub',
            'Family billing: one invoice per household, still tracked per player internally',
            'Pro-rata joins mid-month, term-based billing, sibling discounts',
            'One-click cancellation from parent side — no phone tag, no lock-in',
          ]}
        />

        <LandingFeatureGrid
          eyebrow="PAYMENT SURFACES"
          headline="Every payment lever an academy owner needs."
          intro="Not a generic subscriptions tool retrofitted for sports. Each surface below exists because academy billing has its own rules — sibling discounts, mid-term joins, pause-for-injury, and parents who need to update their card at 21:47."
          features={[
            { label: 'Monthly memberships', tagline: 'Recurring plans on Stripe.', description: 'Set a price per training group or age tier. Parents pay by card, Stripe collects on the same day every month, money lands in your Stripe balance the next working day.' },
            { label: 'Failed payment recovery', tagline: 'Retry, remind, recover.', description: 'Smart retry schedule (day 1, 3, 7) with branded emails and a one-click card-update link. Most failures self-recover before you have to know about them.' },
            { label: 'Automatic renewals', tagline: 'Renewals fire without you.', description: 'Subscriptions renew on the same day of the month, every month. Term-based billing, mid-month pro-rata joins, pause-for-injury and cancel-at-period-end all handled without touching Stripe.' },
            { label: 'Payment reminders', tagline: 'Nudge, don\'t chase.', description: 'Automated reminders fire before a payment falls due, when it fails, and when a card is about to expire. Parents update themselves. You stop being the debt collector.' },
            { label: 'Family billing', tagline: 'One household, one bill.', description: 'Households with multiple children see a single billing view. Sibling discounts apply automatically. Internally, every subscription is still per-player — reports stay clean.' },
            { label: 'Revenue visibility', tagline: 'Numbers that tell the truth.', description: 'Weekly revenue, at-risk members, failed-payment recovery rate, plan-mix, MRR. Built for founder-operators making Sunday-night decisions — not for a finance team.' },
          ]}
        />

        <LandingFAQ
          eyebrow="BILLING QUESTIONS"
          headline="What academy owners ask about payments."
          items={[
            {
              q: 'Do I need my own Stripe account?',
              a: 'Yes. Player Portal connects to your Stripe account — the money lands in your Stripe balance, not ours. If you don\'t have Stripe yet, you can sign up through Player Portal during onboarding and Stripe verifies your business in about 10 minutes.',
            },
            {
              q: 'What fees does Player Portal take from each payment?',
              a: 'Player Portal is a flat monthly subscription (£20 Starter, £35 Pro, £60 Enterprise) plus a transaction fee on each payment that steps down as you scale (3.5% Starter, 2.5% Pro, 2% Enterprise). Stripe\'s own standard card fees apply separately. There\'s no per-booking surcharge on top of that.',
            },
            {
              q: 'What happens when a parent\'s card fails?',
              a: 'Player Portal retries the payment automatically on day 1, day 3 and day 7 after failure. Each retry triggers a branded email to the parent with a one-click link to update their card from their parent hub. Most failures self-recover within a week. You get a notification only if all retries fail.',
            },
            {
              q: 'Can I offer sibling discounts and family pricing?',
              a: 'Yes. Configure a percentage or fixed-amount sibling discount, and Player Portal applies it automatically when a household adds a second, third or fourth child. Family billing groups those subscriptions into one household view for the parent while keeping per-player tracking on the admin side.',
            },
            {
              q: 'What about pro-rata joins mid-month, or pausing for injury?',
              a: 'A parent joining mid-cycle is pro-rated automatically for the first billing period. Pause-for-injury freezes billing on their record without cancelling the subscription — you set the resume date and Stripe restarts on the same schedule. Nothing manual.',
            },
            {
              q: 'How does a parent cancel?',
              a: 'From their own parent hub. Cancel-at-period-end is one click, no phone tag, no forms. You see the cancellation immediately with the reason field they entered. Your revenue view drops the cancelled MRR from next period. No lock-in.',
            },
          ]}
        />

        <LandingCTA
          headline="Stop chasing £30."
          headlineHighlight="Let Stripe do it."
          subhead="Player Portal handles the retry schedule, the branded reminders, the self-serve card updates and the family billing. You get the weekly number and your Sunday nights back. Free for 14 days."
          primaryCta={{ label: 'Try free for 14 days', href: '/onboard' }}
          secondaryCta={{ label: 'Book a demo', href: '/how-it-works' }}
          microCopy="Stripe-native. Unlimited players every tier. UK-hosted. Cancel any time."
        />

        <LandingInternalLinks currentSlug={SLUG} />
      </main>
      <Footer />
    </div>
  )
}
