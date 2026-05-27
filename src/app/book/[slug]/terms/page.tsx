import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'

/**
 * Public T&Cs page for an academy. Shows whatever the academy admin set in
 * their settings → policies → Terms & Conditions. Linked from signup, the
 * cancel modal, and footers across the booking flow.
 *
 * Falls back to a generic placeholder if the academy hasn't set custom terms.
 */
export default async function AcademyTermsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: org } = await supabase
    .from('organisations')
    .select('id, name, slug, primary_color, logo_url, terms_text, refund_policy, cancellation_notice_days, late_payment_grace_days, contact_email')
    .ilike('slug', slug)
    .single()

  if (!org) notFound()

  const primaryColor = (org.primary_color as string) || '#4ecde6'
  const hasCustomTerms = !!(org.terms_text as string | null | undefined)?.trim()

  return (
    <div className="min-h-screen bg-[#060606] text-white">
      <div
        className="absolute inset-x-0 top-0 h-48 opacity-25 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at top, ${primaryColor}40 0%, transparent 60%)` }}
      />

      <div className="relative max-w-3xl mx-auto px-4 py-12">
        <Link
          href={`/book/${slug}`}
          className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors mb-6"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to {org.name}
        </Link>

        <div className="flex items-center gap-4 mb-8">
          {org.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={org.logo_url as string} alt={org.name as string} className="w-14 h-14 rounded-xl object-cover bg-[#1a1a1a]" />
          ) : null}
          <div>
            <h1 className="text-3xl font-extrabold">{org.name}</h1>
            <p className="text-sm text-white/50">Terms &amp; Conditions</p>
          </div>
        </div>

        {/* Key policies summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
          <div className="bg-[#141414] border border-white/[0.08] rounded-xl p-4">
            <p className="text-[10px] uppercase tracking-widest text-white/40">Notice period</p>
            <p className="text-lg font-bold mt-1">
              {Number(org.cancellation_notice_days || 0) > 0 ? `${org.cancellation_notice_days} days` : 'Cancel anytime'}
            </p>
          </div>
          <div className="bg-[#141414] border border-white/[0.08] rounded-xl p-4">
            <p className="text-[10px] uppercase tracking-widest text-white/40">Late payment grace</p>
            <p className="text-lg font-bold mt-1">
              {Number(org.late_payment_grace_days || 0) > 0 ? `${org.late_payment_grace_days} days` : 'Immediate'}
            </p>
          </div>
          <div className="bg-[#141414] border border-white/[0.08] rounded-xl p-4">
            <p className="text-[10px] uppercase tracking-widest text-white/40">Refunds</p>
            <p className="text-sm mt-1">
              {(org.refund_policy as string | null) ? 'See policy below' : 'Contact academy'}
            </p>
          </div>
        </div>

        {/* Refund policy */}
        {(org.refund_policy as string | null)?.trim() && (
          <section className="bg-[#141414] border border-white/[0.08] rounded-2xl p-6 mb-6">
            <h2 className="text-lg font-bold mb-2">Refund Policy</h2>
            <p className="text-sm text-white/70 whitespace-pre-wrap">{org.refund_policy as string}</p>
          </section>
        )}

        {/* Custom T&Cs */}
        <section className="bg-[#141414] border border-white/[0.08] rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-bold mb-4">Terms &amp; Conditions</h2>
          {hasCustomTerms ? (
            <div className="text-sm text-white/70 whitespace-pre-wrap leading-relaxed">
              {org.terms_text as string}
            </div>
          ) : (
            <p className="text-sm text-white/50 italic">
              This academy hasn&apos;t yet published their full terms. Please contact{' '}
              {org.contact_email ? (
                <a href={`mailto:${org.contact_email}`} className="text-white/80 hover:text-white underline">
                  {org.contact_email}
                </a>
              ) : (
                <span>them</span>
              )}{' '}
              for full terms.
            </p>
          )}
        </section>

        <div className="text-center text-xs text-white/30 pt-6 border-t border-white/[0.06]">
          Player Portal also has its own platform-level terms available at{' '}
          <Link href="/terms" className="text-white/50 hover:text-white underline">
            theplayerportal.net/terms
          </Link>
        </div>
      </div>
    </div>
  )
}
