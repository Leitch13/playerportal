import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { adminClient } from '@/lib/one-to-one/db'
import { setupLinkState } from '@/lib/one-to-one/agree'
import AgreeAndPay from './AgreeAndPay'

export const dynamic = 'force-dynamic'

// A regular's set-up link lands here first: the cancellation policy, a tick, then Stripe.
// Works for every academy with 1-2-1s, published booking page or not.

export const metadata: Metadata = { title: 'Your regular slot', robots: { index: false } }

function inkOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim()); if (!m) return '#04141a'
  const n = parseInt(m[1], 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.55 ? '#04141a' : '#ffffff'
}

export default async function AgreePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ cs?: string }> }) {
  const { slug } = await params
  const { cs = '' } = await searchParams
  const { data: org } = await adminClient().from('organisations').select('id, name, slug, logo_url, primary_color').eq('slug', slug).maybeSingle()
  if (!org) notFound()
  const link = await setupLinkState(cs)
  if (link.organisationId && link.organisationId !== org.id) notFound()
  const primary = (org.primary_color as string) || '#4ecde6'

  return (
    <main className="min-h-screen bg-[#080e18] text-white" style={{ backgroundImage: `radial-gradient(60rem 28rem at 50% -8rem, ${primary}24, transparent 70%)` }}>
      <div className="mx-auto max-w-xl px-4 py-8 sm:py-12">
        <header className="mb-6 flex items-center gap-3.5">
          {org.logo_url ? <img src={org.logo_url as string} alt="" className="h-14 w-14 rounded-2xl object-cover ring-1 ring-white/10" /> : <div className="h-14 w-14 rounded-2xl" style={{ background: primary }} />}
          <div className="min-w-0">
            <div className="truncate text-xs font-semibold uppercase tracking-[0.08em] text-white/50">{org.name}</div>
            <h1 className="text-2xl font-bold leading-tight">Your regular slot</h1>
          </div>
        </header>
        <section className="rounded-3xl border border-white/[0.1] bg-[#0f1a2b] p-5 sm:p-6">
          {link.state === 'open' ? (
            <>
              <p className="mb-4 text-sm leading-relaxed text-white/70">One step before you pay: please read and accept how cancellations work. Then you&apos;ll go to Stripe to pay securely and save your card for the 1st of each month.</p>
              <AgreeAndPay checkoutId={cs} academy={org.name as string} accent={primary} ink={inkOn(primary)} />
            </>
          ) : link.state === 'paid' ? (
            <p className="text-sm text-white/75">This link has already been paid. You&apos;re all set: the dates are on your Player Portal page.</p>
          ) : link.state === 'expired' ? (
            <p className="text-sm text-white/75">This link has expired. Pay links last 24 hours. Ask {org.name} to send you a fresh one.</p>
          ) : (
            <p className="text-sm text-white/75">This link isn&apos;t right. Ask {org.name} to send it again.</p>
          )}
        </section>
      </div>
    </main>
  )
}
