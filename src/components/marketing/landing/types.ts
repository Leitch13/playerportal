// Shared prop types for landing-page components.
// One content object per page; pages are thin skeletons that pass this
// down through props. Keeps landing pages copy-first, structure-shared.

export type CTA = { label: string; href: string }

export type LandingHeroContent = {
  eyebrow: string
  h1: string
  h1Highlight?: string
  subhead: string
  primaryCta: CTA
  secondaryCta: CTA
  trustDots: string[]
}

export type BeforeItem = { icon: string; label: string; tail: string }

export type LandingProblemContent = {
  eyebrow: string
  headline: string
  headlineHighlight?: string
  body: string
  punchline: string
  beforeCard?: { title: string; subtitle: string; items: BeforeItem[] }
  afterCard?: { title: string; subtitle: string; bullets: string[]; closingLine: string }
}

export type LandingWhyPoint = { stat: string; label: string; sub: string }

export type LandingWhyContent = {
  eyebrow: string
  headline: string
  headlineHighlight?: string
  intro?: string
  points: LandingWhyPoint[]
}

export type LandingSolutionContent = {
  eyebrow: string
  headline: string
  headlineHighlight?: string
  paragraphs: string[]
  checklist?: string[]
}

export type FeatureCard = {
  label: string
  tagline: string
  description: string
}

export type LandingFeatureGridContent = {
  eyebrow: string
  headline: string
  headlineHighlight?: string
  intro?: string
  features: FeatureCard[]
}

export type FAQItem = { q: string; a: string }

export type LandingFAQContent = {
  eyebrow: string
  headline: string
  headlineHighlight?: string
  items: FAQItem[]
}

export type LandingCTAContent = {
  headline: string
  headlineHighlight?: string
  subhead: string
  primaryCta: CTA
  secondaryCta: CTA
  microCopy: string
}

export type LandingPageMeta = {
  slug: string
  title: string
  shortLabel: string
  description: string
}

// Registry of every live landing page. LandingInternalLinks reads this
// and auto-omits the current page. When a P2 page ships, add its meta
// entry here so cross-linking updates everywhere at once.
export const LANDING_PAGES: LandingPageMeta[] = [
  {
    slug: 'football-academy-management-software',
    title: 'Football Academy Management Software',
    shortLabel: 'Academy management',
    description: 'Run the whole academy from one login: bookings, memberships, attendance, comms, reports.',
  },
  {
    slug: 'football-booking-system',
    title: 'Football Booking System',
    shortLabel: 'Bookings & trials',
    description: 'Online bookings, waiting lists, trial slots and instant confirmations — no phone tag.',
  },
  {
    slug: 'academy-payment-collection',
    title: 'Academy Payment Collection',
    shortLabel: 'Payments & billing',
    description: 'Monthly memberships on Stripe with failed-payment recovery, family billing and revenue visibility.',
  },
]

export const CANONICAL_ORIGIN = 'https://www.theplayerportal.net'
export const canonicalFor = (slug: string) => `${CANONICAL_ORIGIN}/${slug}`
