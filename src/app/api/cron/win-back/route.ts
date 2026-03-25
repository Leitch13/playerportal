import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'
import { winBackEmail } from '@/lib/email-templates'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // Auth check
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://playerportal.app'

  // Find subscriptions cancelled exactly 7 days ago (within a 24h window)
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const eightDaysAgo = new Date()
  eightDaysAgo.setDate(eightDaysAgo.getDate() - 8)

  const { data: cancelledSubs } = await supabase
    .from('subscriptions')
    .select(`
      id, cancelled_at, organisation_id,
      parent:profiles!subscriptions_parent_id_fkey(id, full_name, email),
      plan:subscription_plans(name, amount)
    `)
    .eq('cancel_at_period_end', true)
    .gte('cancelled_at', eightDaysAgo.toISOString())
    .lte('cancelled_at', sevenDaysAgo.toISOString())

  let sent = 0

  for (const sub of cancelledSubs || []) {
    const parent = sub.parent as unknown as { id: string; full_name: string; email: string } | null
    const plan = sub.plan as unknown as { name: string; amount: number } | null

    if (!parent?.email || !plan) continue

    // Check if we already sent a win-back for this subscription
    const { data: existingNotif } = await supabase
      .from('notifications')
      .select('id')
      .eq('profile_id', parent.id)
      .eq('type', 'win_back')
      .limit(1)

    if (existingNotif && existingNotif.length > 0) continue

    const originalAmount = `£${Number(plan.amount).toFixed(2)}`
    const discountedAmount = `£${(Number(plan.amount) * 0.75).toFixed(2)}`

    // Send win-back email
    const template = winBackEmail({
      parentName: parent.full_name?.split(' ')[0] || 'there',
      planName: plan.name,
      originalAmount,
      discountedAmount,
      academyName: '', // Will fill below
      dashboardUrl: `${appUrl}/dashboard/payments`,
    })

    // Get academy name
    const { data: org } = await supabase
      .from('organisations')
      .select('name')
      .eq('id', sub.organisation_id)
      .single()

    template.subject = `We miss you! Here's 25% off to come back — ${org?.name || 'Your Academy'}`
    template.html = template.html.replace(/Your Academy/g, org?.name || 'Your Academy')

    await sendEmail({ to: parent.email, ...template })

    // Record notification to prevent duplicates
    await supabase.from('notifications').insert({
      profile_id: parent.id,
      organisation_id: sub.organisation_id,
      type: 'win_back',
      title: 'We miss you! Come back with 25% off',
      body: `Get ${plan.name} for just ${discountedAmount}/month — 25% off forever.`,
      link: '/dashboard/payments',
    })

    sent++
  }

  return NextResponse.json({ checked: (cancelledSubs || []).length, sent })
}
