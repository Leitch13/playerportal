import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's organisation
    const { data: profile } = await supabase
      .from('profiles')
      .select('organisation_id')
      .eq('id', user.id)
      .single()

    if (!profile?.organisation_id) {
      return NextResponse.json({ error: 'No organisation' }, { status: 404 })
    }

    // Get org with platform plan details
    const { data: org } = await supabase
      .from('organisations')
      .select(`
        id,
        platform_plan_id,
        platform_subscription_status,
        platform_trial_ends_at,
        platform_stripe_subscription_id
      `)
      .eq('id', profile.organisation_id)
      .single()

    if (!org) {
      return NextResponse.json({ error: 'Organisation not found' }, { status: 404 })
    }

    // Get the current plan details
    let currentPlan = null
    if (org.platform_plan_id) {
      const { data: plan } = await supabase
        .from('platform_plans')
        .select('*')
        .eq('id', org.platform_plan_id)
        .single()
      currentPlan = plan
    }

    // Get all available plans
    const { data: allPlans } = await supabase
      .from('platform_plans')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    // Calculate trial days remaining
    let trialDaysRemaining = 0
    if (org.platform_subscription_status === 'trial' && org.platform_trial_ends_at) {
      const trialEnd = new Date(org.platform_trial_ends_at)
      const now = new Date()
      trialDaysRemaining = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    }

    return NextResponse.json({
      currentPlan,
      allPlans: allPlans || [],
      status: org.platform_subscription_status || 'trial',
      trialDaysRemaining,
      trialEndsAt: org.platform_trial_ends_at,
      hasSubscription: !!org.platform_stripe_subscription_id,
    })
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch platform status' },
      { status: 500 }
    )
  }
}
