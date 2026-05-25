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
        .select('name, logo_url, slug, email, phone, address')
        .eq('id', orgId)
        .single()
    : { data: null }

  // Extract org fields safely
  const orgRecord = org as Record<string, unknown> | null
  const orgAddress = (orgRecord?.address as string) || ''
  const orgEmail = (orgRecord?.email as string) || ''
  const orgPhone = (orgRecord?.phone as string) || ''

  // Derive invoice data
  const orgSlug = (org?.slug || 'PP').toUpperCase()
  const invoiceNumber = `INV-${orgSlug}-${(payment.id as string).substring(0, 8).toUpperCase()}`
  const isPaid = payment.status === 'paid'
  const amount = Number(payment.amount)
  const amountPaid = Number(payment.amount_paid || 0)
  const discount = Number((payment as Record<string, unknown>).discount || 0)
  const subtotal = amount + discount
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

  // Derive period from due date
  const periodDate = payment.due_date ? new Date(payment.due_date as string) : new Date(payment.created_at as string)
  const period = periodDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  const player = payment.player as unknown as {
    first_name: string
    last_name: string
  } | null

  const description = (payment.description as string) || 'Coaching Fee'
  const playerName = player ? `${player.first_name} ${player.last_name}` : null
  const paymentMethod = (payment as Record<string, unknown>).payment_method as string | null
  const stripePaymentId = (payment as Record<string, unknown>).stripe_payment_intent_id as string | null
  const cardLast4 = (payment as Record<string, unknown>).card_last4 as string | null

  return (
    <div className="invoice-page max-w-3xl mx-auto">
      {/* Action buttons — hidden when printing */}
      <div className="mb-8 no-print">
        <InvoiceActions paymentId={id} />
      </div>

      {/* Invoice document */}
      <div className="bg-[#141414] rounded-xl shadow-sm border border-gray-200 print:shadow-none print:border-0 print:rounded-none">
        {/* Header */}
        <div className="px-8 pt-8 pb-6 border-b border-gray-200">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              {org?.logo_url && (
                <img
                  src={org.logo_url}
                  alt={org?.name || 'Academy'}
                  className="w-14 h-14 rounded-lg object-cover"
                />
              )}
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {org?.name || 'Academy'}
                </h2>
                {orgAddress && (
                  <div className="text-xs text-gray-500 mt-0.5">
                    {orgAddress}
                  </div>
                )}
                {(orgEmail || orgPhone) && (
                  <div className="text-xs text-gray-500 mt-0.5">
                    {orgEmail}
                    {orgEmail && orgPhone && ' | '}
                    {orgPhone}
                  </div>
                )}
              </div>
            </div>
            <div className="text-right">
              <h1 className="text-2xl font-bold tracking-wide text-gray-900">
                {isPaid ? 'RECEIPT' : 'INVOICE'}
              </h1>
              <div className="mt-1 text-sm font-mono text-gray-500">
                {invoiceNumber}
              </div>
            </div>
          </div>
        </div>

        {/* Dates and parties */}
        <div className="px-8 py-6 grid grid-cols-2 gap-8">
          {/* From */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
              From
            </div>
            <div className="text-sm space-y-0.5">
              <div className="font-semibold text-gray-900">{org?.name || 'Academy'}</div>
              {orgEmail && (
                <div className="text-gray-500">{orgEmail}</div>
              )}
            </div>
          </div>

          {/* To */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
              Bill To
            </div>
            <div className="text-sm space-y-0.5">
              <div className="font-semibold text-gray-900">{parent?.full_name || '\u2014'}</div>
              <div className="text-gray-500">{parent?.email || ''}</div>
            </div>
          </div>
        </div>

        {/* Dates */}
        <div className="px-8 pb-6">
          <div className="flex flex-wrap gap-8 text-sm">
            <div>
              <span className="text-gray-400 text-xs uppercase tracking-wider block mb-0.5">Date Issued</span>
              <span className="font-medium text-gray-900">{createdDate}</span>
            </div>
            {dueDate && (
              <div>
                <span className="text-gray-400 text-xs uppercase tracking-wider block mb-0.5">Due Date</span>
                <span className="font-medium text-gray-900">{dueDate}</span>
              </div>
            )}
            {paidDate && (
              <div>
                <span className="text-gray-400 text-xs uppercase tracking-wider block mb-0.5">Date Paid</span>
                <span className="font-medium text-gray-900">{paidDate}</span>
              </div>
            )}
          </div>
        </div>

        {/* Line items */}
        <div className="px-8 pb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left py-3 font-semibold text-gray-700">Description</th>
                <th className="text-left py-3 font-semibold text-gray-700 hidden sm:table-cell">
                  Player
                </th>
                <th className="text-left py-3 font-semibold text-gray-700 hidden sm:table-cell">
                  Period
                </th>
                <th className="text-right py-3 font-semibold text-gray-700">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="py-4">
                  <div className="font-medium text-gray-900">{description}</div>
                  {playerName && (
                    <div className="text-xs text-gray-500 mt-0.5 sm:hidden">
                      {playerName}
                    </div>
                  )}
                  <div className="text-xs text-gray-400 mt-0.5 sm:hidden">
                    {period}
                  </div>
                </td>
                <td className="py-4 text-gray-600 hidden sm:table-cell">
                  {playerName || '\u2014'}
                </td>
                <td className="py-4 text-gray-600 hidden sm:table-cell">
                  {period}
                </td>
                <td className="py-4 text-right font-medium text-gray-900">
                  &pound;{(discount > 0 ? subtotal : amount).toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="px-8 pb-6">
          <div className="flex justify-end">
            <div className="w-72 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subtotal</span>
                <span className="text-gray-900">&pound;{(discount > 0 ? subtotal : amount).toFixed(2)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Discount</span>
                  <span>-&pound;{discount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold border-t-2 border-gray-900 pt-2">
                <span className="text-gray-900">Total (GBP)</span>
                <span className="text-gray-900">&pound;{amount.toFixed(2)}</span>
              </div>
              {amountPaid > 0 && amountPaid < amount && (
                <>
                  <div className="flex justify-between text-sm text-emerald-600">
                    <span>Amount Paid</span>
                    <span>&pound;{amountPaid.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold text-orange-600">
                    <span>Balance Due</span>
                    <span>&pound;{(amount - amountPaid).toFixed(2)}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Status badge + Payment method */}
        <div className="px-8 pb-6 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            {isPaid && (cardLast4 || stripePaymentId || paymentMethod) && (
              <span>
                Paid via{' '}
                {cardLast4
                  ? `card ending ${cardLast4}`
                  : paymentMethod === 'stripe'
                    ? 'Stripe'
                    : paymentMethod || 'online payment'}
              </span>
            )}
          </div>
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
        <div className="px-8 py-6 border-t border-gray-200 bg-[#0a0a0a] rounded-b-xl print:bg-transparent">
          <p className="text-sm text-center text-gray-600 mb-2">
            Thank you for choosing {org?.name || 'our academy'}.
          </p>
          <p className="text-xs text-center text-gray-400">
            {invoiceNumber} &middot; Generated by Player Portal
          </p>
        </div>
      </div>
    </div>
  )
}
