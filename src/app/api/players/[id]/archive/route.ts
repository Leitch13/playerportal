/**
 * Sprint 7 — Archive Player API
 *
 * POST /api/players/[id]/archive
 *
 * Behaviour:
 *   1. Auth admin in the player's org. The RPC re-enforces the same gate
 *      via SECURITY DEFINER + get_my_role()='admin' check; this route is
 *      the user-facing entry point.
 *   2. Call archive_player_safe RPC — flags the players row, cancels
 *      active/pending enrolments with cancellations audit rows, expires
 *      future camp + makeup bookings, drops waitlist entries. Returns the
 *      list of active Stripe subscription IDs.
 *   3. If body.cancelSubs === true (default), cancel each Stripe sub via
 *      stripe.subscriptions.update(..., { cancel_at_period_end: true }).
 *      Mirrors /api/stripe/cancel — graceful end-of-period cancel so the
 *      family keeps the period they already paid for; no proration; no
 *      refund. Mode-mismatch safe-fail (Sprint 121 / Phase 5 finding).
 *   4. Write audit_log row.
 *
 * Body:
 *   { reason: 'left_academy'|'moved_away'|'injury'|'temporary_break'|
 *             'duplicate_record'|'other',
 *     notes?: string|null,
 *     cancelSubs?: boolean (default true) }
 *
 * Does NOT:
 *   • Delete any row.
 *   • Touch attendance, progress reviews, payments, awards, messages,
 *     skill_levels — Protected by the archive-doesn't-delete principle.
 *   • Modify application_fee_percent / on_behalf_of / transfer_data
 *     (Protected System #1) — graceful sub cancel, no fee math touched.
 */
import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'

const ALLOWED_REASONS = new Set([
  'left_academy',
  'moved_away',
  'injury',
  'temporary_break',
  'duplicate_record',
  'other',
])

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id: playerId } = await ctx.params
    if (!playerId) {
      return NextResponse.json({ ok: false, error: 'player id required' }, { status: 400 })
    }

    let body: { reason?: string; notes?: string | null; cancelSubs?: boolean }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ ok: false, error: 'invalid JSON body' }, { status: 400 })
    }

    const reason = (body.reason || '').trim()
    if (!ALLOWED_REASONS.has(reason)) {
      return NextResponse.json({ ok: false, error: 'reason must be one of: left_academy, moved_away, injury, temporary_break, duplicate_record, other' }, { status: 400 })
    }

    const cancelSubs = body.cancelSubs !== false // default true

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    // Defence-in-depth role gate before calling the RPC. The RPC re-checks
    // via get_my_role() — this just returns a faster 403 with a cleaner
    // error message.
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, organisation_id')
      .eq('id', user.id)
      .single()
    const role = (profile as { role?: string } | null)?.role
    const orgId = (profile as { organisation_id?: string } | null)?.organisation_id || null
    if (role !== 'admin') {
      return NextResponse.json({ ok: false, error: 'Only admins can archive players' }, { status: 403 })
    }

    // ── 1. Call RPC — flags player + cascade-cancels enrolments + camps ──
    const { data: rpcData, error: rpcErr } = await supabase.rpc('archive_player_safe', {
      p_player_id: playerId,
      p_reason: reason,
      p_notes: body.notes || null,
    })

    if (rpcErr) {
      return NextResponse.json({ ok: false, error: `archive_player_safe failed: ${rpcErr.message}` }, { status: 500 })
    }

    const result = rpcData as {
      ok: boolean
      error?: string
      player_id?: string
      player_name?: string
      already_archived?: boolean
      cancelled_enrolments?: number
      active_stripe_subscriptions?: string[]
    } | null

    if (!result || result.ok === false) {
      const err = result?.error || 'unknown_rpc_failure'
      const status = err === 'forbidden_role' ? 403
        : err === 'unauthorized' ? 401
        : err === 'not_found' ? 404
        : 500
      return NextResponse.json({ ok: false, error: err }, { status })
    }

    // ── 2. Stripe-side subscription cancellation (optional but default) ──
    // Pattern mirrors /api/stripe/cancel — graceful cancel_at_period_end.
    // No proration, no refund, no application_fee_percent change.
    const stripeSubs = Array.isArray(result.active_stripe_subscriptions)
      ? result.active_stripe_subscriptions
      : []
    const stripeResults: Array<{ id: string; ok: boolean; orphaned?: boolean; error?: string }> = []
    if (cancelSubs && stripeSubs.length > 0) {
      for (const subId of stripeSubs) {
        try {
          await stripe.subscriptions.update(subId, { cancel_at_period_end: true })
          stripeResults.push({ id: subId, ok: true })
        } catch (stripeErr) {
          const msg = stripeErr instanceof Error ? stripeErr.message : String(stripeErr)
          if (/no such subscription/i.test(msg)) {
            // Mode-mismatch orphan (live key vs test sub). Cancel locally only.
            stripeResults.push({ id: subId, ok: true, orphaned: true })
          } else {
            // Surface the failure to the caller but don't roll back the
            // archive — the player is already flagged + enrolments cancelled.
            // The admin can retry just the Stripe cancel from the parent
            // payments hub.
            console.error(`[archive] stripe cancel failed for ${subId}: ${msg}`)
            stripeResults.push({ id: subId, ok: false, error: msg })
          }
        }
        // Mirror state in our subscriptions row.
        await supabase
          .from('subscriptions')
          .update({
            cancel_at_period_end: true,
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', subId)
      }
    }

    // ── 3. Audit log ──
    await supabase.from('audit_log').insert({
      organisation_id: orgId,
      user_id: user.id,
      action: 'archive_player',
      entity_type: 'player',
      entity_id: playerId,
      details: {
        reason,
        notes: body.notes || null,
        cancelled_enrolments: result.cancelled_enrolments ?? 0,
        cancel_subs_requested: cancelSubs,
        stripe_results: stripeResults,
        was_already_archived: result.already_archived === true,
      },
    })

    return NextResponse.json({
      ok: true,
      playerId,
      playerName: result.player_name || null,
      cancelledEnrolments: result.cancelled_enrolments ?? 0,
      stripeResults,
      wasAlreadyArchived: result.already_archived === true,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
