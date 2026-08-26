import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

/**
 * Super-admin endpoint: cancel an academy signup.
 *
 * /api/onboard creates the organisation with is_published=true, so a spam or
 * fraudulent signup is immediately public and bookable at /book/<slug> on our
 * own domain. The platform dashboard was read-only, which meant the only way to
 * take one down was hand-written SQL against production — no use when you can't
 * reach the Supabase dashboard.
 *
 * Deliberately reversible: this unpublishes and marks the org cancelled. It
 * deletes nothing. Use scripts/cancel-academy-signup.mjs --purge for permanent
 * removal once you're certain.
 *
 * Body:
 *   force  — proceed even when the academy has real activity (default false)
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // ── super-admin gate ──
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_super_admin')
    .eq('id', user.id)
    .single()
  if (!profile?.is_super_admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { force } = await request.json().catch(() => ({ force: false }))

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: org } = await admin
    .from('organisations')
    .select('id, name, slug, is_published, platform_subscription_status, stripe_account_id, platform_stripe_subscription_id')
    .eq('id', id)
    .single()
  if (!org) return NextResponse.json({ error: 'Academy not found' }, { status: 404 })

  // ── safety interlock ──
  // A junk signup has no players, enrolments, bookings or payments. A live
  // academy does. Without this, one mis-click takes a paying customer offline.
  const activity: Record<string, number> = {}
  for (const table of ['players', 'enrolments', 'subscriptions', 'payments', 'trial_bookings', 'camp_bookings']) {
    const { count } = await admin
      .from(table)
      .select('*', { count: 'exact', head: true })
      .eq('organisation_id', id)
    if (count) activity[table] = count
  }

  if (Object.keys(activity).length && !force) {
    return NextResponse.json(
      {
        error: 'This academy has real activity — cancelling would take a live customer offline.',
        activity,
        hint: 'Re-send with { "force": true } if you are certain.',
      },
      { status: 409 }
    )
  }

  const { error } = await admin
    .from('organisations')
    .update({
      is_published: false,
      platform_subscription_status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Best effort — never fail the cancellation because the audit row didn't take.
  try {
    await admin.from('audit_log').insert({
      organisation_id: id,
      user_id: user.id,
      action: 'academy.cancelled',
      entity_type: 'organisation',
      entity_id: id,
      details: { slug: org.slug, name: org.name, forced: !!force, via: 'platform-admin' },
    })
  } catch { /* audit optional */ }

  return NextResponse.json({
    ok: true,
    academy: { id: org.id, name: org.name, slug: org.slug },
    forced: !!force,
    activity,
    // Surfaced, never acted on: a fraudulent academy with a payout-capable
    // Connect account is a card-testing vector and needs handling in Stripe.
    stripe: {
      connectAccount: org.stripe_account_id || null,
      platformSubscription: org.platform_stripe_subscription_id || null,
      note: org.stripe_account_id || org.platform_stripe_subscription_id
        ? 'Stripe objects attached — reject/cancel these in the Stripe dashboard. This endpoint does not touch Stripe.'
        : 'No Stripe objects attached.',
    },
  })
}
