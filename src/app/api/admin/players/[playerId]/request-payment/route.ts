import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────────────────
// Admin "Request payment" — send an already-enrolled player's parent a one-tap
// link to set up their membership payment. No signup wizard for the parent.
//
// This REUSES the existing migration invite mechanism end-to-end:
//   • it inserts a `subscriptions` row with status='pending_migration' + an
//     invite_token (identical shape to the migration importer), and
//   • the parent completes it via the EXISTING /confirm-subscription/[token]
//     page → /api/migration/confirm-checkout, which creates the real Stripe
//     subscription.
//
// SAFETY: this endpoint only ever INSERTs one inert pending row and sends an
// email. It never updates or deletes an existing subscription, never touches
// the subscribe route / webhooks / confirm-checkout, and never calls Stripe.
// So it cannot change any existing subscription. A hard dedup guard blocks
// creating a request for a player who already pays or has a pending request,
// AND for a parent holding a live payment with no child attached to it —
// the anti-double-billing invariant.
// ─────────────────────────────────────────────────────────────────────────

function adminDb() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ playerId: string }> },
) {
  const { playerId } = await ctx.params

  // ── AuthN + AuthZ — signed-in admin only; org derived server-side ──
  const supa = await createServerClient()
  const { data: { user } } = await supa.auth.getUser()
  if (!user) return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 })
  const { data: role } = await supa.rpc('get_my_role')
  if (role !== 'admin') return NextResponse.json({ error: 'Only academy admins can request payment.' }, { status: 403 })
  const { data: orgId } = await supa.rpc('get_my_org')
  if (!orgId) return NextResponse.json({ error: 'Your account is not linked to an academy.' }, { status: 400 })

  const body = await request.json().catch(() => ({}))
  const planId = String(body.planId || '')
  const firstBilling = body.firstBilling === 'next_month' ? 'next_month' : 'today'
  if (!planId) return NextResponse.json({ error: 'Choose a membership plan.' }, { status: 400 })

  const db = adminDb()

  // ── Player must belong to the caller's academy (tenant isolation) ──
  const { data: player } = await db
    .from('players')
    .select('id, first_name, last_name, parent_id, organisation_id')
    .eq('id', playerId)
    .single()
  if (!player || player.organisation_id !== orgId) {
    return NextResponse.json({ error: 'Player not found.' }, { status: 404 })
  }
  if (!player.parent_id) {
    return NextResponse.json({ error: 'This player has no parent account on file.' }, { status: 400 })
  }

  // ── Plan must belong to the same academy ──
  const { data: plan } = await db
    .from('subscription_plans')
    .select('id, name, amount, organisation_id')
    .eq('id', planId)
    .single()
  if (!plan || plan.organisation_id !== orgId) {
    return NextResponse.json({ error: 'Plan not found.' }, { status: 404 })
  }

  // ── DEDUP — the anti-double-billing guard. Never create a billing
  //    relationship for a player who already pays or has a pending request.
  //
  //    Two defects fixed here on 2026-09-01, both of which had already cost
  //    real money:
  //
  //    1. `.maybeSingle()` ERRORS when more than one row matches and returns
  //       null — so a player who already had TWO subscriptions sailed straight
  //       past the guard and could be issued a third. A list read cannot fail
  //       that way.
  //
  //    2. The check was keyed on player_id alone. A parent whose payment had no
  //       child attached to it was invisible to it: the guard looked for
  //       subscriptions belonging to the child, found none, and concluded
  //       nobody was paying. On 2026-08-13 that sent an invite to a parent who
  //       had been paying £60/month since June. She accepted, reasonably, and
  //       on 1 September Stripe attempted both. Only her bank declining the
  //       second as a duplicate stopped a £150 charge for one boy in one class.
  //       Another family in the same position was charged £120.
  // ──
  const { data: existingForPlayer } = await db
    .from('subscriptions')
    .select('id, status')
    .eq('player_id', playerId)
    .in('status', ['active', 'trialing', 'past_due', 'pending_migration'])
    .limit(5)
  const existing = (existingForPlayer || [])[0]
  if (existing) {
    return NextResponse.json(
      {
        error: existing.status === 'pending_migration'
          ? `${player.first_name} already has a pending payment request. Cancel it before sending a new one.`
          : `${player.first_name} already has a subscription. Cancel it first if you need to re-issue.`,
      },
      { status: 409 }
    )
  }

  // ── The blind spot above, closed. If this parent holds a live payment that
  //    is not attached to any child, we cannot prove it is not already for THIS
  //    child — so we refuse and say so. A parent paying for a named sibling is
  //    unaffected: only payments with no child at all block here.
  //
  //    This condition is self-clearing. Once every payment carries a child
  //    (backfill done 2026-09-01, source fixed in the subscribe path) there is
  //    nothing left for it to catch. ──
  const { data: parentSubs } = await db
    .from('subscriptions')
    .select('id, plan_id, status')
    .eq('parent_id', player.parent_id)
    .eq('organisation_id', orgId)
    .is('player_id', null)
    .in('status', ['active', 'trialing', 'past_due'])
    .limit(10)
  if (parentSubs && parentSubs.length > 0) {
    const { data: theirPlan } = await db
      .from('subscription_plans')
      .select('name, amount')
      .eq('id', parentSubs[0].plan_id)
      .maybeSingle()
    const detail = theirPlan
      ? ` (${theirPlan.name} — £${Number(theirPlan.amount || 0).toFixed(2)}/month)`
      : ''
    return NextResponse.json(
      {
        error: `This parent already has a live membership${detail} that isn't linked to a child, so we can't tell whether it already covers ${player.first_name}. Sending this could charge them twice. Check their payments first — support can attach the existing membership to the right child.`,
      },
      { status: 409 }
    )
  }

  // ── Parent email ──
  const { data: parent } = await db
    .from('profiles')
    .select('email, full_name')
    .eq('id', player.parent_id)
    .single()
  if (!parent?.email) {
    return NextResponse.json({ error: 'No email on file for this parent.' }, { status: 400 })
  }

  // ── First charge date. "next_month" → 1st of next month (used as trial_end
  //    by confirm-checkout, exactly like a migration billing start). "today" →
  //    null → prorate now, the confirm-checkout default. ──
  let billingStartsAt: string | null = null
  if (firstBilling === 'next_month') {
    const now = new Date()
    billingStartsAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0)).toISOString()
  }

  // ── Create the pending invite row — SAME shape as the migration importer,
  //    purely additive. Inert until the parent confirms & pays. ──
  const token = randomBytes(24).toString('base64url')
  const { error: subErr } = await db
    .from('subscriptions')
    .insert({
      parent_id: player.parent_id,
      player_id: playerId,
      plan_id: planId,
      organisation_id: orgId,
      status: 'pending_migration',
      invite_token: token,
      invite_source: 'admin_request',
      invite_sent_at: new Date().toISOString(),
      migration_billing_starts_at: billingStartsAt,
    })
  if (subErr) {
    return NextResponse.json({ error: 'Could not create the payment request. Please try again.' }, { status: 500 })
  }

  // ── Email the parent the confirm link (best-effort — the row is already
  //    created; if the email fails the admin can resend). ──
  try {
    const { data: org } = await db
      .from('organisations')
      .select('name, primary_color, contact_email')
      .eq('id', orgId)
      .single()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://theplayerportal.net'
    const confirmUrl = `${appUrl}/confirm-subscription/${token}`
    const primary = org?.primary_color || '#4ecde6'
    const academyName = org?.name || 'your academy'
    const childFirst = escapeHtml(player.first_name || 'your child')
    const amount = Number(plan.amount || 0).toFixed(0)
    const html = `
<!DOCTYPE html><html><body style="margin:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;">
    <div style="padding:26px 32px;background:${primary};color:#0a0a0a;"><h1 style="margin:0;font-size:19px;font-weight:800;">${escapeHtml(academyName)}</h1></div>
    <div style="padding:28px 32px;color:#1a1a1a;line-height:1.6;">
      <p style="margin:0 0 14px;font-size:15px;">Hi ${escapeHtml((parent.full_name || '').split(' ')[0] || 'there')},</p>
      <p style="margin:0 0 20px;font-size:15px;">${escapeHtml(academyName)} would like to set up ${childFirst}'s membership (${escapeHtml(plan.name)} — &pound;${amount}/month). Tap below to add your payment details — it takes about 30 seconds, no account to create.</p>
      <p style="text-align:center;margin:24px 0;"><a href="${confirmUrl}" style="background:${primary};color:#0a0a0a;padding:14px 34px;text-decoration:none;border-radius:999px;font-weight:700;display:inline-block;font-size:15px;">Confirm ${childFirst}'s membership</a></p>
      <p style="margin:16px 0 0;font-size:12px;color:#888;">If you didn't expect this, you can ignore it. Questions? Reply to this email.</p>
    </div>
  </div>
</body></html>`
    const { sendEmail } = await import('@/lib/email')
    await sendEmail({
      to: parent.email,
      subject: `${academyName}: Confirm ${player.first_name || 'your child'}'s membership (takes 30 seconds)`,
      html,
      fromName: academyName,
      replyTo: org?.contact_email || undefined,
    })
  } catch {
    // Email is best-effort — the pending request already exists.
  }

  return NextResponse.json({ status: 'sent' })
}
