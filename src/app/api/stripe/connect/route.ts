import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: role } = await supabase.rpc('get_my_role')
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { data: orgId } = await supabase.rpc('get_my_org')
    const { data: org } = await supabase
      .from('organisations')
      .select('id, name, stripe_account_id, contact_email')
      .eq('id', orgId)
      .single()

    if (!org) {
      return NextResponse.json({ error: 'Organisation not found' }, { status: 404 })
    }

    let accountId = org.stripe_account_id

    // Create a Standard Connect account if one does not already exist
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'standard',
        email: org.contact_email || undefined,
        business_profile: {
          name: org.name,
        },
        metadata: { org_id: org.id },
      })
      accountId = account.id

      await supabase
        .from('organisations')
        .update({ stripe_account_id: accountId })
        .eq('id', org.id)
    }

    // Generate an Account Link so the admin can complete Stripe onboarding
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${appUrl}/dashboard/settings?tab=billing`,
      return_url: `${appUrl}/dashboard/settings?tab=billing&stripe=success`,
      type: 'account_onboarding',
    })

    return NextResponse.json({ url: accountLink.url })
  } catch (err) {
    console.error('Stripe Connect error:', err)
    return NextResponse.json(
      { error: 'Failed to create Connect account' },
      { status: 500 },
    )
  }
}
