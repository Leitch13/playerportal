import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe'
import { canPause, effectiveStatus } from '@/lib/membership-pause'

export const dynamic = 'force-dynamic'

/**
 * Pause or resume a membership. POST { action: 'pause' | 'resume' }
 *
 * Stripe first, then our row: a pause that Stripe hasn't accepted is never
 * shown as paused. Pause voids each bill until Resume; the child keeps their
 * class place. Admin of the membership's own academy only. See src/lib/membership-pause.ts.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = (await req.json().catch(() => ({}))) as { action?: string }
  const action = body.action === 'resume' ? 'resume' : body.action === 'pause' ? 'pause' : null
  if (!action) return NextResponse.json({ error: 'Say pause or resume' }, { status: 400 })

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })
  const { data: me } = await supabase.from('profiles').select('role, organisation_id').eq('id', user.id).single()
  if (!me || me.role !== 'admin') return NextResponse.json({ error: 'Only academy admins can pause a membership' }, { status: 403 })

  const service = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: row } = await service.from('subscriptions').select('id, organisation_id, status, stripe_subscription_id').eq('id', id).maybeSingle()
  if (!row || row.organisation_id !== me.organisation_id) return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
  if (!row.stripe_subscription_id) {
    return NextResponse.json({ error: "This membership isn't billed through Stripe yet (the family hasn't confirmed), so there's nothing to pause." }, { status: 409 })
  }
  if (action === 'pause' && !canPause(row.status)) {
    return NextResponse.json({ error: row.status === 'past_due' ? 'This membership has a failed payment being retried. Sort that first, or cancel it.' : `A ${row.status} membership can't be paused.` }, { status: 409 })
  }

  let status: string
  try {
    // Resume follows Stripe, not our row: Stripe is what charges.
    if (action === 'resume' && !(await stripe.subscriptions.retrieve(row.stripe_subscription_id)).pause_collection) {
      return NextResponse.json({ error: "This membership isn't paused." }, { status: 409 })
    }
    const sub = await stripe.subscriptions.update(row.stripe_subscription_id, action === 'pause'
      ? { pause_collection: { behavior: 'void' } }
      : { pause_collection: '' as unknown as null })
    status = effectiveStatus(sub)
  } catch (e) {
    return NextResponse.json({ error: `Stripe didn't accept that: ${e instanceof Error ? e.message : 'unknown error'}` }, { status: 502 })
  }

  const now = new Date().toISOString()
  const { error } = await service.from('subscriptions').update({ status, updated_at: now }).eq('id', id)
  if (error) {
    // Stripe has the change, so the family's billing is right; only our screen is behind.
    console.error('[pause] Stripe changed but our row did not', { id, error: error.message })
    return NextResponse.json({ ok: true, status, warning: `Stripe has it ${action === 'pause' ? 'paused' : 'resumed'}, but Player Portal couldn't save that yet: ${error.message}` })
  }
  await service.from('audit_log').insert({
    organisation_id: row.organisation_id, user_id: user.id, action: action === 'pause' ? 'subscription.paused' : 'subscription.resumed',
    entity_type: 'subscription', entity_id: id, details: { stripe_subscription_id: row.stripe_subscription_id, status },
  }).then(() => undefined, () => undefined)
  return NextResponse.json({ ok: true, status })
}
