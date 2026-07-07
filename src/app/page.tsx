import type { Metadata } from 'next'
import TopNav from '@/components/marketing/homepage/TopNav'
import Hero from '@/components/marketing/homepage/Hero'
import TrustStrip from '@/components/marketing/homepage/TrustStrip'
import ProblemSection from '@/components/marketing/homepage/ProblemSection'
import OperatingSystem from '@/components/marketing/homepage/OperatingSystem'
import BentoGrid from '@/components/marketing/homepage/BentoGrid'
import FounderStory from '@/components/marketing/homepage/FounderStory'
import MigrationTeaser from '@/components/marketing/homepage/MigrationTeaser'
import ParentHubShowcase from '@/components/marketing/homepage/ParentHubShowcase'
import NumbersProof from '@/components/marketing/homepage/NumbersProof'
import PricingTeaser from '@/components/marketing/homepage/PricingTeaser'
import FAQ from '@/components/marketing/homepage/FAQ'
import FinalCTA from '@/components/marketing/homepage/FinalCTA'
import Footer from '@/components/marketing/homepage/Footer'

const CANONICAL_URL = 'https://www.theplayerportal.net'

const HOMEPAGE_TITLE = 'Player Portal — The Operating System for Football Academies'
const HOMEPAGE_DESCRIPTION =
  'Player Portal replaces the six or seven tools you use to run your academy — bookings, memberships, payments, attendance, camps, and the parent hub — with one platform built by someone who runs an academy.'

export const metadata: Metadata = {
  title: HOMEPAGE_TITLE,
  description: HOMEPAGE_DESCRIPTION,
  alternates: {
    canonical: CANONICAL_URL,
  },
  openGraph: {
    type: 'website',
    locale: 'en_GB',
    url: CANONICAL_URL,
    siteName: 'Player Portal',
    title: HOMEPAGE_TITLE,
    description: HOMEPAGE_DESCRIPTION,
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Player Portal — the operating system for football academies' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: HOMEPAGE_TITLE,
    description: HOMEPAGE_DESCRIPTION,
    images: ['/og-image.png'],
  },
}

// Keep FAQ copy for JSON-LD in sync with FAQ.tsx. If FAQ.tsx changes,
// mirror the copy here so Google's rich-result eligibility check still
// matches the on-page answers verbatim.
const FAQ_ITEMS = [
  {
    q: 'Can I migrate my members from another provider?',
    a: 'Yes. Export your current provider\'s CSV, upload it, and Player Portal matches parents, players, classes and plans automatically. Existing memberships, enrolments and billing information are preserved wherever possible to make switching straightforward.',
  },
  {
    q: "What happens if my Stripe account isn't set up?",
    a: 'We walk you through it during onboarding. If you already have a Stripe account, connect it in one click. If not, sign up with Stripe from inside Player Portal — takes about 10 minutes and Stripe verifies your business.',
  },
  {
    q: 'Do you handle GDPR, DBS checks and consent forms?',
    a: 'GDPR — yes, UK-hosted with a proper data-processing agreement. DBS status — track it per coach with expiry reminders. Consent forms — collect them at signup (medical, photo, terms) with parent signatures stored per player.',
  },
  {
    q: 'How much time does the initial setup take?',
    a: 'Most academies are running within a day. Sign up (2 minutes), connect Stripe (10 minutes), add your classes and plans (30 minutes), import your members (an afternoon for a full migration). Then invite parents and go live.',
  },
  {
    q: 'What if I want to cancel?',
    a: 'Cancel in a click, from your settings. No forms, no calls, no lock-in. Your data is yours — export everything, keep everything. If you leave, we help you leave clean.',
  },
  {
    q: 'Who owns my data?',
    a: "You do. Every player, parent, payment, message and report. We're the platform; the data is yours. Export it any time as CSV. We never share it, never sell it, never train models on it.",
  },
]

const softwareApplicationSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Player Portal',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  url: CANONICAL_URL,
  description: HOMEPAGE_DESCRIPTION,
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
    url: CANONICAL_URL,
  },
}

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Player Portal',
  url: CANONICAL_URL,
  logo: `${CANONICAL_URL}/logo.png`,
  description:
    'Player Portal is the operating system for football academies — bookings, memberships, payments, attendance, camps, and the parent hub in one platform.',
  areaServed: 'GB',
}

const faqPageSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ_ITEMS.map(({ q, a }) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: {
      '@type': 'Answer',
      text: a,
    },
  })),
}

export default function HomePage() {
  return (
    <div className="bg-[#0a0a0a] text-white min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPageSchema) }}
      />
      <TopNav />
      <main className="pt-16">
        <Hero />
        <TrustStrip />
        <ProblemSection />
        <OperatingSystem />
        <BentoGrid />
        <FounderStory />
        <MigrationTeaser />
        <ParentHubShowcase />
        <NumbersProof />
        <PricingTeaser />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  )
}
