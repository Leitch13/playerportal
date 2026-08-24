import { createClient } from '@supabase/supabase-js'
import PayClient from './PayClient'

export const dynamic = 'force-dynamic'

/**
 * Parent-facing page for paying a single one-off invoice.
 *
 * Reached from the emailed link. No login required — the invoice UUID is an
 * unguessable bearer capability, the same model as
 * /confirm-subscription/[token]. It exposes only this one invoice and can do
 * nothing else.
 */
export default async function PayInvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ paid?: string; cancelled?: string }>
}) {
  const { id } = await params
  const sp = await searchParams

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return <ErrorScreen message="This payment link is invalid." />
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: payment } = await admin
    .from('payments')
    .select(
      `id, amount, amount_paid, status, description, due_date,
       parent:profiles!payments_parent_id_fkey(full_name),
       player:players(first_name, last_name),
       org:organisations(name, primary_color, logo_url, contact_email)`
    )
    .eq('id', id)
    .maybeSingle()

  if (!payment) {
    return <ErrorScreen message="This payment link is invalid or has expired." />
  }

  const org = payment.org as unknown as {
    name: string
    primary_color: string | null
    logo_url: string | null
    contact_email: string | null
  } | null
  const parent = payment.parent as unknown as { full_name: string | null } | null
  const player = payment.player as unknown as { first_name: string; last_name: string | null } | null

  const remaining =
    Math.round((Number(payment.amount) - Number(payment.amount_paid || 0)) * 100) / 100

  const settled =
    payment.status === 'paid' ||
    payment.status === 'refunded' ||
    payment.status === 'waived' ||
    remaining <= 0

  return (
    <PayClient
      paymentId={payment.id as string}
      description={(payment.description as string | null) || 'Amount due'}
      amount={remaining}
      dueDate={(payment.due_date as string | null) || null}
      settled={settled}
      justPaid={sp.paid === '1'}
      cancelled={sp.cancelled === '1'}
      parentName={parent?.full_name || null}
      childName={player ? `${player.first_name} ${player.last_name || ''}`.trim() : null}
      academyName={org?.name || 'Your academy'}
      primaryColor={org?.primary_color || '#4ecde6'}
      logoUrl={org?.logo_url || null}
      contactEmail={org?.contact_email || null}
    />
  )
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#12121a] p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
          <svg className="h-6 w-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <p className="text-sm text-white/70">{message}</p>
      </div>
    </div>
  )
}
