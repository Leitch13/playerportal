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

    // Login links only exist for Express accounts. Every academy on the
    // platform is a STANDARD account (see /api/stripe/connect — accounts.create
    // type 'standard'), so this call has failed for every academy that ever
    // pressed "Open Stripe": "Cannot create an edit link for the account …
    // which does not have access to the Express Dashboard." A Standard account
    // has its own full Stripe login — send them there, and tell them which
    // email the account is under so they know what to type.
    const account = await stripe.accounts.retrieve(org.stripe_account_id)
    if (account.type === 'express') {
      const loginLink = await stripe.accounts.createLoginLink(org.stripe_account_id)
      return NextResponse.json({ url: loginLink.url })
    }
    return NextResponse.json({
      url: 'https://dashboard.stripe.com/',
      standard: true,
      loginEmail: account.email ?? null,
    })
  } catch (err) {
    console.error('[connect/dashboard]', err)
    return NextResponse.json(
      { error: 'Failed to create dashboard link' },
      { status: 500 },
    )
  }
}
