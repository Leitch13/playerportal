import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import InvoiceActions from './InvoiceActions'

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/signin')

  // Get current user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, organisation_id, full_name, email')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/auth/signin')

  // Load the payment with related data
  const { data: payment } = await supabase
    .from('payments')
    .select(
      '*, parent:profiles!payments_parent_id_fkey(id, full_name, email, organisation_id), player:players(first_name, last_name)'
    )
    .eq('id', id)
    .single()

  if (!payment) notFound()

  const parent = payment.parent as unknown as {
    id: string
    full_name: string
    email: string
    organisation_id: string
  } | null

  // Validate access: parent owns it, or admin belongs to same org
  const isOwner = payment.parent_id === user.id
  const isAdmin = profile.role === 'admin' || profile.role === 'coach'
  const sameOrg = parent?.organisation_id === profile.organisation_id

  if (!isOwner && !(isAdmin && sameOrg)) {
    notFound()
  }

  // Load organisation details
  const orgId = parent?.organisation_id || profile.organisation_id
  const { data: org } = orgId
    ? await supabase
        .from('organisations')
        .select('name, logo_url, slug')
        .eq('id', orgId)
        .single()
    : { data: null }

  // Derive invoice data
  const invoiceNumber = (payment.id as string).substring(0, 8).toUpperCase()
  const isPaid = payment.status === 'paid'
  const amount = Number(payment.amount)
  const amountPaid = Number(payment.amount_paid || 0)
  const createdDate = new Date(payment.created_at as string).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const paidDate = payment.paid_date
    ? new Date(payment.paid_date as string).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null
  const dueDate = payment.due_date
    ? new Date(payment.due_date as string).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null

  const player = payment.player as unknown as {
    first_name: string
    last_name: string
  } | null

  const description = (payment.description as string) || 'Coaching Fee'
  const playerName = player ? `${player.first_name} ${player.last_name}` : null

  return (
    <div className="invoice-page max-w-3xl mx-auto">
      {/* Action buttons — hidden when printing */}
      <div className="mb-8 no-print">
        <InvoiceActions paymentId={id} />
      </div>

      {/* Invoice document */}
      <div className="bg-white rounded-xl shadow-sm border border-border print:shadow-none print:border-0 print:rounded-none">
        {/* Header */}
        <div className="px-8 pt-8 pb-6 border-b border-border">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              {org?.logo_url && (
                <img
                  src={org.logo_url}
                  alt={org.name || 'Academy'}
                  className="w-14 h-14 rounded-lg object-cover"
                />
              )}
              <div>
                <h2 className="text-xl font-bold text-primary">
                  {org?.name || 'Academy'}
                </h2>
              </div>
            </div>
            <div className="text-right">
              <h1 className="text-2xl font-bold tracking-wide text-primary">
                {isPaid ? 'RECEIPT' : 'INVOICE'}
              </h1>
              <div className="mt-1 text-sm text-text-light">
                #{invoiceNumber}
              </div>
            </div>
          </div>
        </div>

        {/* Dates and parties */}
        <div className="px-8 py-6 grid grid-cols-2 gap-8">
          {/* From */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-text-light mb-2">
              From
            </div>
            <div className="text-sm space-y-0.5">
              <div className="font-semibold">{org?.name || 'Academy'}</div>
            </div>
          </div>

          {/* To */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-text-light mb-2">
              To
            </div>
            <div className="text-sm space-y-0.5">
              <div className="font-semibold">{parent?.full_name || '—'}</div>
              <div className="text-text-light">{parent?.email || ''}</div>
            </div>
          </div>
        </div>

        {/* Dates */}
        <div className="px-8 pb-6">
          <div className="flex flex-wrap gap-6 text-sm">
            <div>
              <span className="text-text-light">Date Issued: </span>
              <span className="font-medium">{createdDate}</span>
            </div>
            {dueDate && (
              <div>
                <span className="text-text-light">Due Date: </span>
                <span className="font-medium">{dueDate}</span>
              </div>
            )}
            {paidDate && (
              <div>
                <span className="text-text-light">Date Paid: </span>
                <span className="font-medium">{paidDate}</span>
              </div>
            )}
          </div>
        </div>

        {/* Line items */}
        <div className="px-8 pb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-primary/10">
                <th className="text-left py-3 font-semibold">Description</th>
                <th className="text-left py-3 font-semibold hidden sm:table-cell">
                  Player
                </th>
                <th className="text-right py-3 font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border">
                <td className="py-4">
                  <div className="font-medium">{description}</div>
                  {playerName && (
                    <div className="text-xs text-text-light mt-0.5 sm:hidden">
                      {playerName}
                    </div>
                  )}
                </td>
                <td className="py-4 text-text-light hidden sm:table-cell">
                  {playerName || '—'}
                </td>
                <td className="py-4 text-right font-medium">
                  &pound;{amount.toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="px-8 pb-6">
          <div className="flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-text-light">Subtotal</span>
                <span>&pound;{amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base font-bold border-t-2 border-primary/10 pt-2">
                <span>Total (GBP)</span>
                <span>&pound;{amount.toFixed(2)}</span>
              </div>
              {amountPaid > 0 && amountPaid < amount && (
                <div className="flex justify-between text-sm text-accent">
                  <span>Amount Paid</span>
                  <span>&pound;{amountPaid.toFixed(2)}</span>
                </div>
              )}
              {amountPaid > 0 && amountPaid < amount && (
                <div className="flex justify-between text-sm font-semibold text-warning">
                  <span>Balance Due</span>
                  <span>&pound;{(amount - amountPaid).toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Status badge */}
        <div className="px-8 pb-6 flex justify-end">
          <span
            className={`inline-block px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${
              isPaid
                ? 'bg-green-50 text-green-700 border border-green-200'
                : payment.status === 'overdue'
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : payment.status === 'partial'
                    ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                    : 'bg-blue-50 text-blue-700 border border-blue-200'
            }`}
          >
            {isPaid ? 'Paid' : (payment.status as string)}
          </span>
        </div>

        {/* Footer */}
        <div className="px-8 py-6 border-t border-border bg-surface/30 rounded-b-xl print:bg-transparent">
          {isPaid && (
            <p className="text-sm text-center text-text-light mb-4">
              Thank you for your payment.
            </p>
          )}
          <p className="text-xs text-center text-text-light/60">
            Player Portal &mdash; Youth Sports Management
          </p>
        </div>
      </div>
    </div>
  )
}
