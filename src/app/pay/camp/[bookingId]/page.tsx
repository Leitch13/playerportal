import { createClient } from '@supabase/supabase-js'
import PayClient from '../../[id]/PayClient'

export const dynamic = 'force-dynamic'

/**
 * Parent-facing page for paying for a camp place, from the academy's emailed link.
 * The link never runs out: every "Pay" opens a fresh Stripe payment
 * (src/lib/camp-payment-link.ts). No login — the booking id is the bearer
 * capability, the same model as /pay/[id] for invoices.
 */
export default async function PayCampPage({ params, searchParams }: { params: Promise<{ bookingId: string }>; searchParams: Promise<{ cancelled?: string }> }) {
  const { bookingId } = await params
  const sp = await searchParams
  if (!/^[0-9a-f-]{36}$/i.test(bookingId)) return <Message text="This payment link is invalid." />
  const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: b } = await svc.from('camp_bookings')
    .select('id, child_name, parent_name, amount_paid, payment_status, camp:camps(name, start_date, end_date), org:organisations(name, primary_color, logo_url, contact_email)')
    .eq('id', bookingId).maybeSingle()
  if (!b) return <Message text="This payment link is invalid." />
  const camp = b.camp as unknown as { name: string; start_date: string | null; end_date: string | null } | null
  const org = b.org as unknown as { name: string; primary_color: string | null; logo_url: string | null; contact_email: string | null } | null
  if (b.payment_status !== 'pending' && b.payment_status !== 'paid') {
    return <Message text={`This booking is no longer open for payment. Please contact ${org?.name || 'the academy'}.`} />
  }
  return (
    <PayClient
      paymentId={b.id as string}
      checkoutPath={`/api/camp-bookings/${b.id}/checkout`}
      description={camp?.name || 'Camp place'}
      amount={Number(b.amount_paid || 0)}
      dueDate={camp?.start_date || null}
      settled={b.payment_status === 'paid'}
      justPaid={false}
      cancelled={sp.cancelled === '1'}
      parentName={(b.parent_name as string | null) || null}
      childName={(b.child_name as string | null) || null}
      academyName={org?.name || 'Your academy'}
      primaryColor={org?.primary_color || '#4ecde6'}
      logoUrl={org?.logo_url || null}
      contactEmail={org?.contact_email || null}
    />
  )
}

function Message({ text }: { text: string }) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#12121a] p-8 text-center">
        <p className="text-sm text-white/70">{text}</p>
      </div>
    </div>
  )
}
