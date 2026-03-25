import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: role } = await supabase.rpc('get_my_role')
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { data: orgId } = await supabase.rpc('get_my_org')
    const { data: org } = await supabase
      .from('organisations')
      .select('stripe_account_id')
      .eq('id', orgId)
      .single()

    if (!org?.stripe_account_id) {
      return NextResponse.json({ connected: false })
    }

    const account = await stripe.accounts.retrieve(org.stripe_account_id)
    return NextResponse.json({
      connected: true,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      details_submitted: account.details_submitted,
      business_name: account.business_profile?.name,
    })
  } catch {
    return NextResponse.json({ connected: false })
  }
}
