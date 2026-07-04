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

export const metadata: Metadata = {
  title: 'Player Portal — The Operating System for Football Academies',
  description:
    'Player Portal replaces the six or seven tools you use to run your academy — bookings, memberships, payments, attendance, camps, and the parent hub — with one platform built by someone who runs an academy.',
}

export default function HomePage() {
  return (
    <div className="bg-[#0a0a0a] text-white min-h-screen">
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
