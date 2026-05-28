import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail, sendEmailBatch } from '@/lib/email'
import { subscriptionExpiringEmail } from '@/lib/email-templates'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://playerportal.app'

  // Find subscriptions renewing in exactly 7 days
  const targetDate = new Date()
  targetDate.setDate(targetDate.getDate() + 7)
  const targetStart = targetDate.toISOString().split('T')[0] + 'T00:00:00.000Z'
  const targetEnd = targetDate.toISOString().split('T')[0] + 'T23:59:59.999Z'

  const { data: subscriptions, error: subsError } = await supabase
    .from('subscriptions')
    .select('id, current_period_end, profile:profiles(full_name, email), plan:subscription_plans(name, amount)')
    .eq('status', 'active')
    .gte('current_period_end', targetStart)
    .lte('current_period_end', targetEnd)

  if (subsError) {
    return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 })
  }

  const jobs: Parameters<typeof sendEmail>[0][] = []

  for (const sub of subscriptions || []) {
    const profile = sub.profile as unknown as { full_name: string; email: string } | null
    const plan = sub.plan as unknown as { name: string; amount: number } | null

    if (!profile?.email) continue

    const renewalDate = new Date(sub.current_period_end).toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })

    const template = subscriptionExpiringEmail({
      parentName: profile.full_name?.split(' ')[0] || 'there',
      amount: `\u00A3${(plan?.amount ?? 0).toFixed(2)}`,
      renewalDate,
      planName: plan?.name || 'Subscription',
      dashboardUrl: `${appUrl}/dashboard/payments`,
    })

    jobs.push({ to: profile.email, ...template })
  }

  const { sent, failed: errors } = await sendEmailBatch(jobs)

  return NextResponse.json({
    sent,
    errors,
    subscriptionsChecked: (subscriptions || []).length,
  })
}
