import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email'
import { paymentReminderEmail } from '@/lib/email-templates'

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  // Verify caller is a coach/admin
  const { data: role } = await supabase.rpc('get_my_role')
  if (!role || !['admin', 'coach'].includes(role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { paymentId } = await request.json()
  if (!paymentId) {
    return NextResponse.json({ error: 'Missing paymentId' }, { status: 400 })
  }

  // Look up the payment with parent profile
  const { data: payment } = await supabase
    .from('payments')
    .select('id, amount, description, due_date, status, organisation_id, parent_id, parent:profiles!payments_parent_id_fkey(id, full_name, email)')
    .eq('id', paymentId)
    .single()

  if (!payment) {
    return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
  }

  const parent = payment.parent as unknown as { id: string; full_name: string; email: string } | null
  if (!parent?.email) {
    return NextResponse.json({ error: 'No parent email' }, { status: 400 })
  }

  // Calculate days overdue
  const dueDate = payment.due_date ? new Date(payment.due_date) : new Date()
  const now = new Date()
  const daysOverdue = Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)))

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://theplayerportal.net'

  const template = paymentReminderEmail({
    parentName: parent.full_name?.split(' ')[0] || 'there',
    amount: `£${Number(payment.amount).toFixed(2)}`,
    daysOverdue,
    planName: payment.description || 'Subscription',
    dashboardUrl: `${appUrl}/dashboard/payments`,
  })

  const result = await sendEmail({ to: parent.email, ...template })

  // Log the reminder in payment_reminders table.
  // Note: reminder_type MUST be one of ('3_day','7_day','14_day','custom') per
  // the CHECK constraint payment_reminders_reminder_type_check (see migration
  // 015_payment_reminders.sql).  Historical value 'manual' violated the
  // constraint and silently failed.  Manual one-off chase uses 'custom'.
  const { data: orgId } = await supabase.rpc('get_my_org')
  const { error: auditErr } = await supabase.from('payment_reminders').insert({
    organisation_id: orgId,
    profile_id: parent.id,
    payment_id: paymentId,
    reminder_type: 'custom',
    email_sent: true,
    sent_at: new Date().toISOString(),
  })

  // If the audit insert fails, surface it in the response so the caller knows
  // (the email still went out — that side-effect is irreversible).
  if (auditErr) {
    return NextResponse.json({ ...result, success: true, audit_error: auditErr.message })
  }

  return NextResponse.json({ ...result, success: true })
}
