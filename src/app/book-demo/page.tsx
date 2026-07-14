import type { Metadata } from 'next'
import TopNav from '@/components/marketing/homepage/TopNav'
import Footer from '@/components/marketing/homepage/Footer'
import BookDemoForm from './BookDemoForm'

export const metadata: Metadata = {
  title: { absolute: 'Book a demo | Player Portal' },
  description: 'See Player Portal in action. Book a quick demo — we&rsquo;ll show you how academies run bookings, memberships, payments and parent comms in one place.',
  alternates: { canonical: 'https://www.theplayerportal.net/book-demo' },
}

export default function BookDemoPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <TopNav />
      <main className="mx-auto max-w-2xl px-6 pt-28 pb-20">
        <div className="text-center mb-8">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#4ecde6] font-bold mb-3">Talk to us</p>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">See Player Portal in action</h1>
          <p className="text-white/60 mt-3 max-w-lg mx-auto leading-relaxed">
            Prefer a walkthrough before you dive in? Tell us a little about your academy or club and we&rsquo;ll show you around — bookings, memberships, payments and the parent app, all in one place.
          </p>
        </div>

        <BookDemoForm />

        <div className="mt-8 text-center">
          <p className="text-sm text-white/40">
            Ready to jump straight in?{' '}
            <a href="/onboard" className="text-[#4ecde6] hover:underline font-medium">Start your free trial &rarr;</a>
          </p>
        </div>
      </main>
      <Footer />
    </div>
  )
}
