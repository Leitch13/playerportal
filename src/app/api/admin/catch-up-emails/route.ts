import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'
import {
  paymentReceiptEmail,
  subscriptionStartedEmail,
  firstSaleEmail,
} from '@/lib/email-templates'

export const dynamic = 'force-dynamic'

/**
 * Re-fire the payment-related emails that the webhook missed at the time of
 * the original event (column-name bugs we've since fixed swallowed the rest
 * of the flow before reaching these). Targeted by subscription_id so it's
 * trivial to call for a specific parent without scripting.
 *
 * Admin-only. Sends: payment receipt + subscription-started welcome to the
 * parent, and an optional first-sale 🎉 alert to the platform admin.
 *
 * Body: { subscriptionId: string, includeFirstSale?: boolean }
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })

  const { data: role } = await supabase.rpc('get_my_role')
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Admins only' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const subscriptionId = body.subscriptionId as string | undefined
  const includeFirstSale = !!body.includeFirstSale
  if (!subscriptionId) {
    return NextResponse.json({ error: 'subscriptionId required' }, { status: 400 })
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Pull the subscription + parent + plan + org in one go.
  const { data: sub, error: subErr } = await admin
    .from('subscriptions')
    .select('id, parent_id, player_id, plan_id, organisation_id, created_at, status')
    .eq('id', subscriptionId)
    .maybeSingle()
  if (subErr || !sub) {
    return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
  }

  const [
    { data: parent },
    { data: plan },
    { data: org },
    { data: player },
    { data: payment },
  ] = await Promise.all([
    admin.from('profiles').select('full_name, email').eq('id', sub.parent_id).maybeSingle(),
    admin.from('subscription_plans').select('name, amount').eq('id', sub.plan_id).maybeSingle(),
    admin.from('organisations').select('name, slug, logo_url, contact_email').eq('id', sub.organisation_id).maybeSingle(),
    sub.player_id
      ? admin.from('players').select('first_name').eq('id', sub.player_id).maybeSingle()
      : Promise.resolve({ data: null }),
    admin
      .from('payments')
      .select('amount_paid, amount, paid_date, stripe_session_id')
      .eq('parent_id', sub.parent_id)
      .eq('organisation_id', sub.organisation_id)
      .order('paid_date', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ])

  if (!parent?.email) {
    return NextResponse.json({ error: 'Parent has no email' }, { status: 400 })
  }

  const parentName = parent.full_name?.split(' ')[0] || 'there'
  const academyName = org?.name || 'Your Academy'
  const planName = plan?.name || 'Subscription'
  const amountNum = Number(payment?.amount_paid || payment?.amount || plan?.amount || 0)
  const amount = `£${amountNum.toFixed(2)}`
  const paidDate = (payment?.paid_date as string | undefined) || sub.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10)
  const dateLabel = new Date(paidDate).toLocaleDateString('en-GB')
  const receiptId = (payment?.stripe_session_id as string | undefined) || sub.id
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://theplayerportal.net'

  const sent: string[] = []
  const failed: string[] = []

  // 1. Payment receipt
  try {
    const t = paymentReceiptEmail({
      parentName: parent.full_name || parentName,
      amount,
      planName,
      date: dateLabel,
      receiptId,
      academyName,
    })
    const r = await sendEmail({
      to: parent.email,
      ...t,
      fromName: academyName,
      replyTo: (org?.contact_email as string | undefined) || undefined,
    })
    r.success ? sent.push('receipt') : failed.push('receipt')
  } catch { failed.push('receipt') }

  // 2. Subscription-started welcome
  try {
    const t = subscriptionStartedEmail({
      parentName: parent.full_name || parentName,
      childName: (player?.first_name as string | undefined) || undefined,
      academyName,
      planName,
      amount,
      dashboardUrl: `${appUrl}/dashboard`,
      academyLogoUrl: (org?.logo_url as string | undefined) || undefined,
      academyContactEmail: (org?.contact_email as string | undefined) || undefined,
    })
    const r = await sendEmail({
      to: parent.email,
      ...t,
      fromName: academyName,
      replyTo: (org?.contact_email as string | undefined) || undefined,
    })
    r.success ? sent.push('subscription_started') : failed.push('subscription_started')
  } catch { failed.push('subscription_started') }

  // 3. First-sale 🎉 alert to the platform admin (only if explicitly requested)
  if (includeFirstSale) {
    try {
      const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || 'johnleitch970@gmail.com'
      const t = firstSaleEmail({
        academyName,
        academySlug: (org?.slug as string | undefined) || '',
        parentName: parent.full_name || parentName,
        childName: (player?.first_name as string | undefined) || undefined,
        planName,
        amount,
        dashboardUrl: appUrl,
      })
      const r = await sendEmail({ to: adminEmail, ...t })
      r.success ? sent.push('first_sale') : failed.push('first_sale')
    } catch { failed.push('first_sale') }
  }

  return NextResponse.json({
    success: true,
    parentEmail: parent.email,
    parentName: parent.full_name,
    academy: academyName,
    sent,
    failed,
  })
}
