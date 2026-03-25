import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'
import { paymentReminderEmail } from '@/lib/email-templates'

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

  // Find overdue payments
  const { data: overdue } = await supabase
    .from('payments')
    .select('id, amount, created_at, status, profile:profiles(full_name, email), plan:subscription_plans(name)')
    .eq('status', 'overdue')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://playerportal.app'
  let sent = 0

  for (const payment of overdue || []) {
    const profile = payment.profile as unknown as { full_name: string; email: string } | null
    const plan = payment.plan as unknown as { name: string } | null
    if (!profile?.email) continue

    const daysOverdue = Math.floor((Date.now() - new Date(payment.created_at).getTime()) / 86400000)

    // Send at 3, 7, 14 days
    if (![3, 7, 14].includes(daysOverdue)) continue

    const template = paymentReminderEmail({
      parentName: profile.full_name?.split(' ')[0] || 'there',
      amount: `\u00A3${Number(payment.amount).toFixed(2)}`,
      daysOverdue,
      planName: plan?.name || 'Subscription',
      dashboardUrl: `${appUrl}/dashboard/payments`,
    })

    await sendEmail({ to: profile.email, ...template })
    sent++
  }

  return NextResponse.json({ sent, checked: (overdue || []).length })
}
