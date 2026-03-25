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
      .select('stripe_account_id')
      .eq('id', orgId)
      .single()

    if (!org?.stripe_account_id) {
      return NextResponse.json({ error: 'Stripe Connect account not found' }, { status: 400 })
    }

    const loginLink = await stripe.accounts.createLoginLink(org.stripe_account_id)
    return NextResponse.json({ url: loginLink.url })
  } catch (err) {
    console.error('Stripe dashboard link error:', err)
    return NextResponse.json(
      { error: 'Failed to create dashboard link' },
      { status: 500 },
    )
  }
}
