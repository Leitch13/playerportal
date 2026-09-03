import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email'

/**
 * Admin: add a player to a class — WITH a payment decision.
 *
 * POST /api/enrolments/admin-add
 *
 * Why this route exists
 * ---------------------
 * `AddToGroupButton` used to insert an enrolment row straight from the browser:
 *
 *     await supabase.from('enrolments').insert({ player_id, group_id, status: 'active', ... })
 *
 * Four lines, no billing step, no prompt, no warning. A child appeared on the
 * register as a full member and the money side of the platform never learned
 * they existed. On 2026-08-31 that had produced 27 children at one academy
 * training with no payment set up — 19 of them added in a single two-day
 * session when the new season groups were built — worth roughly £2k/month.
 *
 * The rule now: you cannot enrol a player without saying how they pay.
 *   • parent already holds a live subscription for this org  -> just enrol
 *   • otherwise a planId is REQUIRED -> we create the pending invite and enrol
 *   • a genuinely free place is a £0 plan, so the intent is recorded rather
 *     than being indistinguishable from an accident
 *
 * Deliberately NOT here: taking payment. This creates the same
 * `pending_migration` invite the migration importer creates, so the parent
 * confirms and pays through the existing /confirm-subscription flow. No new
 * money path — Protected System #1 (application_fee_percent / on_behalf_of /
 * transfer_data) is never touched by this route.
 */

export const dynamic = 'force-dynamic'

interface Body {
  playerId?: string
  groupId?: string
  /** Required unless the parent already has a live subscription for this org. */
  planId?: string | null
}

export async function POST(request: NextRequest) {
  try {
    let body: Body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const { playerId, groupId, planId } = body
    if (!playerId || !groupId) {
      return NextResponse.json({ error: 'playerId and groupId are required' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, organisation_id')
      .eq('id', user.id)
      .single()
    const role = (profile as { role?: string } | null)?.role
    const orgId = (profile as { organisation_id?: string } | null)?.organisation_id || null
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Only admins can add players to a class' }, { status: 403 })
    }
    if (!orgId) {
      return NextResponse.json({ error: 'Could not determine your organisation' }, { status: 400 })
    }

    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    // ── Both rows must belong to the caller's org (no cross-tenant writes) ──
    const [{ data: player }, { data: group }] = await Promise.all([
      admin.from('players')
        .select('id, first_name, last_name, parent_id, organisation_id, archived_at')
        .eq('id', playerId).maybeSingle(),
      admin.from('training_groups')
        .select('id, name, organisation_id')
        .eq('id', groupId).maybeSingle(),
    ])
    if (!player || player.organisation_id !== orgId) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 })
    }
    if (!group || group.organisation_id !== orgId) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 })
    }
    if (player.archived_at) {
      return NextResponse.json({ error: 'That player is archived. Restore them first.' }, { status: 400 })
    }

    // ── Already in this class? Idempotent, not an error ──
    const { data: existing } = await admin
      .from('enrolments')
      .select('id, status')
      .eq('player_id', playerId)
      .eq('group_id', groupId)
      .maybeSingle()
    if (existing && existing.status === 'active') {
      return NextResponse.json({ ok: true, alreadyEnrolled: true, enrolmentId: existing.id })
    }

    // ── THE RULE: is this player's family already paying this academy? ──
    const parentId = (player as { parent_id?: string | null }).parent_id || null
    let liveSub: { id: string } | null = null
    if (parentId) {
      const { data } = await admin
        .from('subscriptions')
        .select('id')
        .eq('parent_id', parentId)
        .eq('organisation_id', orgId)
        .in('status', ['active', 'trialing', 'pending_migration'])
        .limit(1)
        .maybeSingle()
      liveSub = data as { id: string } | null
    }

    let inviteToken: string | null = null
    let inviteEmailed = false

    if (!liveSub) {
      if (!planId) {
        // Refuse, and hand back everything the UI needs to ask the question.
        const { data: plans } = await admin
          .from('subscription_plans')
          .select('id, name, amount, sessions_per_week')
          .eq('organisation_id', orgId)
          .eq('active', true)
          .order('amount', { ascending: true })
        return NextResponse.json({
          error: 'payment_required',
          message: `${player.first_name} ${player.last_name} has no payment set up. Choose how they pay before adding them to a class — pick a £0 plan if this is a free place.`,
          plans: plans || [],
        }, { status: 409 })
      }

      const { data: plan } = await admin
        .from('subscription_plans')
        .select('id, name, amount, organisation_id, active')
        .eq('id', planId).maybeSingle()
      if (!plan || plan.organisation_id !== orgId) {
        return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
      }
      if (!parentId) {
        return NextResponse.json({
          error: 'no_parent',
          message: 'This player has no parent account, so there is nobody to bill. Link a parent first.',
        }, { status: 409 })
      }

      // Same shape the migration importer creates, so the existing
      // /confirm-subscription/[token] flow picks it up unchanged.
      inviteToken = randomBytes(24).toString('base64url')
      const { error: subErr } = await admin.from('subscriptions').insert({
        parent_id: parentId,
        player_id: playerId,
        plan_id: planId,
        organisation_id: orgId,
        status: 'pending_migration',
        invite_token: inviteToken,
        invite_source: 'admin_add_to_class',
        invite_sent_at: new Date().toISOString(),
      })
      if (subErr) {
        return NextResponse.json({ error: `Could not set up the payment: ${subErr.message}` }, { status: 500 })
      }

      // Send it. The admin should not have to copy a link anywhere — an invite
      // that needs a human to remember to send it is the same failure mode as
      // no invite at all.
      const [{ data: org }, { data: parent }] = await Promise.all([
        admin.from('organisations').select('name, primary_color, contact_email').eq('id', orgId).maybeSingle(),
        admin.from('profiles').select('full_name, email').eq('id', parentId).maybeSingle(),
      ])
      const parentEmail = (parent as { email?: string } | null)?.email
      const academy = (org as { name?: string } | null)?.name || 'Your academy'
      const brand = (org as { primary_color?: string } | null)?.primary_color || '#4ecde6'
      const first = (player.first_name || '').trim()
      const amount = Number((plan as { amount?: number }).amount ?? 0)
      const priceText = amount > 0 ? `£${amount.toFixed(2)}/month` : 'a free place'
      if (parentEmail) {
        const link = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://www.theplayerportal.net'}/confirm-subscription/${inviteToken}`
        const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;background:#fff">
  <div style="padding:22px 30px;background:${brand};color:#0a0a0a"><h1 style="margin:0;font-size:19px;font-weight:800">${academy}</h1></div>
  <div style="padding:28px 30px;color:#1a1a1a;line-height:1.6">
    <p style="font-size:15px;margin:0 0 14px">Hi ${(parent as { full_name?: string } | null)?.full_name || 'there'},</p>
    <p style="font-size:15px;color:#444;margin:0 0 16px">${first} has been added to <strong>${(group as { name?: string }).name}</strong>.</p>
    <p style="font-size:15px;color:#444;margin:0 0 20px">To confirm their place, set up the membership below — <strong>${priceText}</strong>. It takes about 30 seconds.</p>
    <p style="text-align:center;margin:26px 0">
      <a href="${link}" style="background:${brand};color:#0a0a0a;padding:14px 30px;text-decoration:none;border-radius:999px;font-weight:700;display:inline-block;font-size:15px">Set up ${first}'s membership</a>
    </p>
    <p style="font-size:13px;color:#777;margin:20px 0 0">Nothing is charged until you confirm. Any questions, just reply to this email.</p>
  </div>
  <div style="padding:14px 30px;background:#f8f8f8;color:#888;font-size:12px;text-align:center;border-top:1px solid #eee">${academy} · Powered by Player Portal</div>
</div>`
        const res = await sendEmail({
          to: parentEmail,
          subject: `${academy}: set up ${first}'s membership`,
          html,
          fromName: academy,
          replyTo: (org as { contact_email?: string } | null)?.contact_email || undefined,
        })
        inviteEmailed = res.success === true && !('skipped' in res && res.skipped)
      }
    }

    // ── Enrol (re-activate in place if a cancelled row exists) ──
    let enrolmentId = existing?.id ?? null
    if (existing) {
      const { error } = await admin.from('enrolments').update({ status: 'active' }).eq('id', existing.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      const { data, error } = await admin.from('enrolments').insert({
        player_id: playerId,
        group_id: groupId,
        status: 'active',
        organisation_id: orgId,
      }).select('id').single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      enrolmentId = (data as { id: string }).id
    }

    const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.theplayerportal.net'
    return NextResponse.json({
      ok: true,
      enrolmentId,
      billing: liveSub ? 'existing_subscription' : 'invite_created',
      inviteEmailed,
      // The link is returned as a FALLBACK only — if the email failed the admin
      // can still get the parent set up rather than being silently stuck.
      ...(inviteToken ? { inviteLink: `${origin}/confirm-subscription/${inviteToken}` } : {}),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[enrolments/admin-add] failed:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
