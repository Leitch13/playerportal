import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'
import { winBackEmail } from '@/lib/email-templates'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // Auth — only callable by cron
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Find cancellations from ~7 days ago that haven't had a winback email
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString()
  const eightDaysAgo = new Date(Date.now() - 8 * 86400000).toISOString()

  const { data: cancellations } = await supabase
    .from('cancellations')
    .select(`
      id, profile_id, organisation_id, subscription_id,
      profiles!cancellations_profile_id_fkey(full_name, email),
      organisations!cancellations_organisation_id_fkey(name)
    `)
    .eq('final_status', 'cancelled')
    .is('winback_sent_at', null)
    .lte('cancelled_at', sevenDaysAgo)
    .gte('cancelled_at', eightDaysAgo)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://playerportal.app'
  let sent = 0

  for (const c of cancellations || []) {
    const profile = c.profiles as unknown as { full_name: string; email: string } | null
    const org = c.organisations as unknown as { name: string } | null

    if (!profile?.email) continue

    // Get original plan amount from subscription
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('subscription_plans(name, amount)')
      .eq('stripe_subscription_id', c.subscription_id)
      .single()

    const plan = sub?.subscription_plans as unknown as { name: string; amount: number } | null
    const amount = Number(plan?.amount || 0)

    const template = winBackEmail({
      parentName: profile.full_name?.split(' ')[0] || 'there',
      planName: plan?.name || 'Subscription',
      originalAmount: `£${amount.toFixed(2)}`,
      discountedAmount: `£${(amount * 0.75).toFixed(2)}`,
      academyName: org?.name || 'Your Academy',
      dashboardUrl: `${appUrl}/dashboard/payments`,
    })

    await sendEmail({ to: profile.email, ...template })

    // Mark winback as sent
    await supabase
      .from('cancellations')
      .update({
        winback_sent_at: new Date().toISOString(),
        final_status: 'winback_sent',
      })
      .eq('id', c.id)

    sent++
  }

  return NextResponse.json({ checked: (cancellations || []).length, winback_sent: sent })
}
