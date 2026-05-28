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

    // Validate any stored account against the CURRENT Stripe mode. An account
    // connected while the platform was in test mode won't exist under live keys
    // (test/live are isolated). Retrieve it first; if it's missing/wrong-mode,
    // drop it so we create a fresh one in THIS mode — single click, no "stale,
    // try again" round-trip.
    if (accountId) {
      try {
        await stripe.accounts.retrieve(accountId)
      } catch (e) {
        const m = e instanceof Error ? e.message : String(e)
        if (m.includes('No such account') || m.includes('resource_missing') || m.includes('similar object exists')) {
          accountId = null
          await supabase.from('organisations').update({ stripe_account_id: null }).eq('id', org.id)
        } else {
          throw e
        }
      }
    }

    // Create a Standard Connect account if one does not already exist (or was just cleared)
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
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://theplayerportal.net'
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${appUrl}/dashboard/settings?tab=billing`,
      return_url: `${appUrl}/dashboard/settings?tab=billing&stripe=success`,
      type: 'account_onboarding',
    })

    return NextResponse.json({ url: accountLink.url })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Stripe Connect error:', message, err)
    // Auto-recovery: if the stored stripe_account_id is invalid (e.g. test-mode
    // leftover after switching to live), clear it so the next click creates fresh.
    const isStaleAccount = message.includes('No such account') || message.includes('resource_missing')
    if (isStaleAccount) {
      const supabase = await createClient()
      const { data: orgId } = await supabase.rpc('get_my_org')
      if (orgId) {
        await supabase.from('organisations').update({ stripe_account_id: null }).eq('id', orgId)
      }
      return NextResponse.json(
        { error: 'Stripe account was stale — cleared. Please click "Connect with Stripe" again.' },
        { status: 409 },
      )
    }
    return NextResponse.json(
      { error: `Stripe Connect failed: ${message}` },
      { status: 500 },
    )
  }
}
