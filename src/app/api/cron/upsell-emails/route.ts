import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'
import {
  upsellAddClassEmail,
  upsellSubscriptionEmail,
  upsellSiblingEmail,
  trialFollowUpEmail,
} from '@/lib/email-templates'

export const dynamic = 'force-dynamic'

// Runs daily — sends context-aware upsell emails at the right time
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
  const stats = { trial_followup: 0, add_class: 0, subscription: 0, sibling: 0 }

  // ═══ 1. TRIAL → CLASS: 3 days after attended trial ═══
  const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0]
  const fourDaysAgo = new Date(Date.now() - 4 * 86400000).toISOString().split('T')[0]

  const { data: trialBookings } = await supabase
    .from('trial_bookings')
    .select('id, parent_name, parent_email, child_name, organisation_id, training_group_id, organisations!trial_bookings_organisation_id_fkey(name, slug)')
    .eq('status', 'attended')
    .gte('confirmed_at', fourDaysAgo)
    .lte('confirmed_at', threeDaysAgo)

  for (const trial of trialBookings || []) {
    const org = trial.organisations as unknown as { name: string; slug: string } | null
    if (!trial.parent_email || !org) continue

    // Check they haven't already enrolled
    const { count } = await supabase
      .from('enrolments')
      .select('id', { count: 'exact', head: true })
      .eq('organisation_id', trial.organisation_id)
      .eq('status', 'active')

    if ((count || 0) > 0) continue // Already enrolled, skip

    const template = trialFollowUpEmail({
      parentName: trial.parent_name.split(' ')[0],
      childName: trial.child_name,
      academyName: org.name,
      signupUrl: `${appUrl}/book/${org.slug}`,
      className: '',
    })
    await sendEmail({ to: trial.parent_email, ...template })
    stats.trial_followup++
  }

  // ═══ 2. ADD CLASS: 2 days after first booking (if only in 1 class) ═══
  const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString()
  const threeDaysAgoISO = new Date(Date.now() - 3 * 86400000).toISOString()

  const { data: recentEnrolments } = await supabase
    .from('enrolments')
    .select(`
      id, player_id, group_id, organisation_id, created_at,
      players!enrolments_player_id_fkey(first_name, last_name, parent_id),
      training_groups!enrolments_group_id_fkey(name),
      organisations!enrolments_organisation_id_fkey(name, slug)
    `)
    .eq('status', 'active')
    .gte('created_at', threeDaysAgoISO)
    .lte('created_at', twoDaysAgo)

  for (const enrol of recentEnrolments || []) {
    const player = enrol.players as unknown as { first_name: string; last_name: string; parent_id: string } | null
    const group = enrol.training_groups as unknown as { name: string } | null
    const org = enrol.organisations as unknown as { name: string; slug: string } | null
    if (!player?.parent_id || !group || !org) continue

    // Check parent has only 1 active enrolment (this is their first class)
    const { count: enrolCount } = await supabase
      .from('enrolments')
      .select('id', { count: 'exact', head: true })
      .eq('player_id', enrol.player_id)
      .eq('status', 'active')

    if ((enrolCount || 0) > 1) continue // Already in multiple classes

    // Get parent email
    const { data: parent } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', player.parent_id)
      .single()

    if (!parent?.email) continue

    const template = upsellAddClassEmail({
      parentName: parent.full_name?.split(' ')[0] || 'there',
      childName: `${player.first_name}`,
      className: group.name,
      academyName: org.name,
      bookingUrl: `${appUrl}/book/${org.slug}`,
    })
    await sendEmail({ to: parent.email, ...template })
    stats.add_class++
  }

  // ═══ 3. SUBSCRIPTION UPGRADE: 30 days after first enrolment, no subscription ═══
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()
  const thirtyOneDaysAgo = new Date(Date.now() - 31 * 86400000).toISOString()

  const { data: monthOldEnrolments } = await supabase
    .from('enrolments')
    .select(`
      id, player_id, organisation_id,
      players!enrolments_player_id_fkey(first_name, parent_id),
      training_groups!enrolments_group_id_fkey(name),
      organisations!enrolments_organisation_id_fkey(name)
    `)
    .eq('status', 'active')
    .gte('created_at', thirtyOneDaysAgo)
    .lte('created_at', thirtyDaysAgo)

  for (const enrol of monthOldEnrolments || []) {
    const player = enrol.players as unknown as { first_name: string; parent_id: string } | null
    const group = enrol.training_groups as unknown as { name: string } | null
    const org = enrol.organisations as unknown as { name: string } | null
    if (!player?.parent_id || !group || !org) continue

    // Check no active subscription
    const { count: subCount } = await supabase
      .from('subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', player.parent_id)
      .eq('status', 'active')

    if ((subCount || 0) > 0) continue // Already subscribed

    const { data: parent } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', player.parent_id)
      .single()

    if (!parent?.email) continue

    // Get cheapest plan for the upsell
    const { data: plan } = await supabase
      .from('subscription_plans')
      .select('amount')
      .eq('organisation_id', enrol.organisation_id)
      .eq('active', true)
      .order('amount')
      .limit(1)
      .single()

    const template = upsellSubscriptionEmail({
      parentName: parent.full_name?.split(' ')[0] || 'there',
      childName: player.first_name,
      className: group.name,
      academyName: org.name,
      monthlyPrice: `£${Number(plan?.amount || 0).toFixed(2)}`,
      dashboardUrl: `${appUrl}/dashboard/payments`,
    })
    await sendEmail({ to: parent.email, ...template })
    stats.subscription++
  }

  // ═══ 4. SIBLING DISCOUNT: 14 days after enrolment, parent has 1 child ═══
  const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000).toISOString()
  const fifteenDaysAgo = new Date(Date.now() - 15 * 86400000).toISOString()

  const { data: twoWeekEnrolments } = await supabase
    .from('enrolments')
    .select(`
      id, player_id, organisation_id,
      players!enrolments_player_id_fkey(first_name, parent_id),
      organisations!enrolments_organisation_id_fkey(name)
    `)
    .eq('status', 'active')
    .gte('created_at', fifteenDaysAgo)
    .lte('created_at', fourteenDaysAgo)

  for (const enrol of twoWeekEnrolments || []) {
    const player = enrol.players as unknown as { first_name: string; parent_id: string } | null
    const org = enrol.organisations as unknown as { name: string } | null
    if (!player?.parent_id || !org) continue

    // Check parent has only 1 child
    const { count: childCount } = await supabase
      .from('players')
      .select('id', { count: 'exact', head: true })
      .eq('parent_id', player.parent_id)

    if ((childCount || 0) !== 1) continue // Multiple children already

    const { data: parent } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', player.parent_id)
      .single()

    if (!parent?.email) continue

    const template = upsellSiblingEmail({
      parentName: parent.full_name?.split(' ')[0] || 'there',
      childName: player.first_name,
      academyName: org.name,
      dashboardUrl: `${appUrl}/dashboard/children?add=1`,
    })
    await sendEmail({ to: parent.email, ...template })
    stats.sibling++
  }

  return NextResponse.json(stats)
}
