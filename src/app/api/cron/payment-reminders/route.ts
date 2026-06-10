import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'
import { paymentReminderEmail } from '@/lib/email-templates'

// COLLECTIONS_CRON_V2_ENABLED — Task #250 Tier 1.  When OFF, cron retains
// the historical (broken-but-silent) shape so rollback is one env flip.
// V2 fixes three pre-existing bugs in one branch:
//   1. Removes the unresolvable `plan:subscription_plans(name)` embed
//      (payments has no FK to subscription_plans — the V1 query has been
//      erroring at PostgREST resolution every 09:00 UTC run and silently
//      no-op-ing on null `data`).
//   2. Filters `status IN ('unpaid','partial') AND due_date <= today`
//      instead of the never-produced `status='overdue'`.
//   3. Computes reminder age from `due_date` (the right field) instead of
//      `created_at`.
// V2 also adds idempotency via `payment_reminders` so duplicate cron runs
// or borderline daysOverdue rounding cannot double-send a stage email.
const COLLECTIONS_CRON_V2_ON =
  process.env.COLLECTIONS_CRON_V2_ENABLED === 'true'

// This runs as a cron job - uses service role key
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const today = new Date().toISOString().split('T')[0]

  // Find chasable payments
  const { data: overdue } = COLLECTIONS_CRON_V2_ON
    ? await supabase
        .from('payments')
        .select('id, amount, due_date, description, status, organisation_id, profile:profiles(id, full_name, email)')
        .in('status', ['unpaid', 'partial'])
        .lte('due_date', today)
    : await supabase
        .from('payments')
        .select('id, amount, created_at, status, profile:profiles(full_name, email), plan:subscription_plans(name)')
        .eq('status', 'overdue')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://playerportal.app'
  let sent = 0

  for (const payment of overdue || []) {
    const profile = payment.profile as unknown as { id?: string; full_name: string; email: string } | null
    if (!profile?.email) continue

    // Compute days overdue from due_date (V2) or created_at (V1 legacy)
    let refDate: Date | null = null
    if (COLLECTIONS_CRON_V2_ON) {
      const dueDate = (payment as unknown as { due_date?: string | null }).due_date
      refDate = dueDate ? new Date(dueDate) : null
    } else {
      const createdAt = (payment as unknown as { created_at: string }).created_at
      refDate = new Date(createdAt)
    }
    if (!refDate) continue
    const daysOverdue = Math.max(
      0,
      Math.floor((Date.now() - refDate.getTime()) / 86400000)
    )

    // Send at 3, 7, 14 days
    if (![3, 7, 14].includes(daysOverdue)) continue

    const reminderType = `${daysOverdue}_day`

    // Idempotency guard (V2 only): skip if a reminder for this
    // (payment, stage) has already been logged
    if (COLLECTIONS_CRON_V2_ON) {
      const { count: alreadySent } = await supabase
        .from('payment_reminders')
        .select('id', { count: 'exact', head: true })
        .eq('payment_id', payment.id)
        .eq('reminder_type', reminderType)
      if ((alreadySent || 0) > 0) continue
    }

    // Compose planName: V2 falls back to payment.description (populated with
    // subscription wording) since the subscription_plans embed doesn't resolve.
    const planName = COLLECTIONS_CRON_V2_ON
      ? ((payment as unknown as { description?: string | null }).description || 'Subscription')
      : ((payment as unknown as { plan?: { name: string } | null }).plan?.name || 'Subscription')

    const template = paymentReminderEmail({
      parentName: profile.full_name?.split(' ')[0] || 'there',
      amount: `£${Number(payment.amount).toFixed(2)}`,
      daysOverdue,
      planName,
      dashboardUrl: `${appUrl}/dashboard/payments`,
    })

    await sendEmail({ to: profile.email, ...template })
    sent++

    // Audit trail (V2 only): mirrors /api/email/payment-reminder's row shape
    // so the cron and the manual reminder share one audit table.
    if (COLLECTIONS_CRON_V2_ON) {
      await supabase.from('payment_reminders').insert({
        organisation_id: (payment as unknown as { organisation_id?: string }).organisation_id,
        profile_id: profile.id,
        payment_id: payment.id,
        reminder_type: reminderType,
        email_sent: true,
        sent_at: new Date().toISOString(),
      })
    }
  }

  return NextResponse.json({ sent, checked: (overdue || []).length })
}
