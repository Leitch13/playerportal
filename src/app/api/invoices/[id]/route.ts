import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/invoices/[id]
 *
 * Returns invoice data as JSON for programmatic access,
 * or redirects to the printable invoice page.
 *
 * Query params:
 *   ?format=json  — returns invoice data as JSON
 *   (default)     — redirects to the printable invoice page
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, organisation_id')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Load the payment
  const { data: payment } = await supabase
    .from('payments')
    .select(
      '*, parent:profiles!payments_parent_id_fkey(id, full_name, email, organisation_id), player:players(first_name, last_name)'
    )
    .eq('id', id)
    .single()

  if (!payment) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }

  const parent = payment.parent as unknown as {
    id: string
    full_name: string
    email: string
    organisation_id: string
  } | null

  // Validate access
  const isOwner = payment.parent_id === user.id
  const isAdmin = profile.role === 'admin' || profile.role === 'coach'
  const sameOrg = parent?.organisation_id === profile.organisation_id

  if (!isOwner && !(isAdmin && sameOrg)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const format = request.nextUrl.searchParams.get('format')

  if (format === 'json') {
    // Load org details
    const orgId = parent?.organisation_id || profile.organisation_id
    const { data: org } = orgId
      ? await supabase.from('organisations').select('name, slug').eq('id', orgId).single()
      : { data: null }

    const player = payment.player as unknown as {
      first_name: string
      last_name: string
    } | null

    const orgSlug = (org?.slug || 'PP').toUpperCase()
    const invoiceNumber = `INV-${orgSlug}-${(payment.id as string).substring(0, 8).toUpperCase()}`

    return NextResponse.json({
      invoice_number: invoiceNumber,
      status: payment.status,
      amount: Number(payment.amount),
      amount_paid: Number(payment.amount_paid || 0),
      description: payment.description || 'Coaching Fee',
      due_date: payment.due_date || null,
      paid_date: payment.paid_date || null,
      created_at: payment.created_at,
      parent: {
        name: parent?.full_name || null,
        email: parent?.email || null,
      },
      player: player ? `${player.first_name} ${player.last_name}` : null,
      organisation: org?.name || null,
      printable_url: `/dashboard/payments/invoice/${id}`,
    })
  }

  // Default: redirect to the printable invoice page
  return NextResponse.redirect(
    new URL(`/dashboard/payments/invoice/${id}`, request.url)
  )
}
