import { createClient } from '@supabase/supabase-js'
import PayClient from '../../[id]/PayClient'
import { openMembershipBill } from '@/lib/membership-pay-link'

export const dynamic = 'force-dynamic'

/**
 * Parent-facing page for a class membership payment that didn't go through, from the academy's
 * emailed link. The link never runs out: "Pay" opens Stripe's page for whatever is still open
 * (src/lib/membership-pay-link.ts). No login — the membership id is the bearer capability, as /pay/camp.
 */
export default async function PayMembershipPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ cancelled?: string }> }) {
  const { id } = await params
  const sp = await searchParams
  if (!/^[0-9a-f-]{36}$/i.test(id)) return <Message text="This payment link is invalid." />
  const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const bill = await openMembershipBill(svc, id).catch(() => null)
  if (!bill) return <Message text="Something went wrong loading this payment. Please try again in a minute." />
  if (!bill.ok) return <Message text={bill.error} />
  const [{ data: org }, { data: player }, { data: parent }, { data: plan }] = await Promise.all([
    svc.from('organisations').select('name, primary_color, logo_url, contact_email').eq('id', bill.sub.organisation_id).single(),
    bill.sub.player_id ? svc.from('players').select('first_name, last_name').eq('id', bill.sub.player_id).maybeSingle() : Promise.resolve({ data: null }),
    bill.sub.parent_id ? svc.from('profiles').select('full_name').eq('id', bill.sub.parent_id).maybeSingle() : Promise.resolve({ data: null }),
    bill.sub.plan_id ? svc.from('subscription_plans').select('name').eq('id', bill.sub.plan_id).maybeSingle() : Promise.resolve({ data: null }),
  ])
  return (
    <PayClient
      paymentId={id}
      checkoutPath={`/api/memberships/${id}/pay`}
      description={`${(plan?.name as string | undefined) || 'Membership'}${bill.month ? ` · ${bill.month}` : ''}`}
      amount={bill.amountPence / 100}
      dueDate={null}
      settled={!bill.invoiceId}
      justPaid={false}
      cancelled={sp.cancelled === '1'}
      parentName={(parent?.full_name as string | null) || null}
      childName={player ? `${player.first_name || ''} ${player.last_name || ''}`.trim() || null : null}
      academyName={(org?.name as string | undefined) || 'Your academy'}
      primaryColor={(org?.primary_color as string | null) || '#4ecde6'}
      logoUrl={(org?.logo_url as string | null) || null}
      contactEmail={(org?.contact_email as string | null) || null}
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
