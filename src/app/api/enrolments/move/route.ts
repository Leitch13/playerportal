/**
 * Sprint 8b v1 — Move Player endpoint.
 *
 * Atomically moves a single player from one class (source enrolment) to
 * another (destination class). Supports both immediate and future-dated
 * moves.
 *
 * What it does NOT do:
 *   • Bulk moves (Sprint 8b v2 territory)
 *   • Subscription / Stripe writes (caller handles plan-tier upgrade
 *     out-of-band via /api/stripe/change-plan before invoking this)
 *   • Override past-due subscription gate (audit decision)
 *   • Refund anything on a move-to-cheaper-class (no platform refund
 *     mechanism — audit confirmed)
 *
 * What it DOES protect:
 *   • Source enrolment is NEVER deleted (status='cancelled' only) so
 *     enrolment_discounts (FK CASCADE) and historical analytics survive.
 *   • Trial state (is_trial + trial_expires_at) is carried forward to
 *     the destination enrolment.
 *   • Capacity is enforced via the existing atomic RPC.
 *   • Waitlist rows for the destination class are housekeeped.
 *
 * Ordering guarantee: destination insert runs BEFORE source cancel. A
 * partial failure leaves the player in BOTH classes (recoverable by an
 * admin) rather than in NEITHER class (unrecoverable, player can't book).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

const MAX_FUTURE_DAYS = 90

export async function POST(request: NextRequest) {
  try {
    // ── 1 · Auth + role gate ──────────────────────────────────────────
    const authed = await createServerClient()
    const { data: { user } } = await authed.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { data: role } = await authed.rpc('get_my_role')
    if (!role || !['admin', 'coach'].includes(role)) {
      return NextResponse.json({ error: 'Only admins and coaches can move players.' }, { status: 403 })
    }

    const body = (await request.json()) as {
      enrolmentId?: string
      destinationGroupId?: string
      effectiveDate?: string | null
      reason?: string
    }
    if (!body.enrolmentId || !body.destinationGroupId) {
      return NextResponse.json({ error: 'enrolmentId and destinationGroupId are required.' }, { status: 400 })
    }

    // Service-role client for the cross-row writes. The RLS-checked
    // role gate above already authorised the caller.
    const service = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    // ── 2 · Resolve admin's org ───────────────────────────────────────
    const { data: profile } = await service
      .from('profiles')
      .select('organisation_id')
      .eq('id', user.id)
      .single()
    const orgId = (profile?.organisation_id as string | null) || null
    if (!orgId) {
      return NextResponse.json({ error: 'Your account has no organisation.' }, { status: 400 })
    }

    // ── 3 · Read source enrolment + verify org + player + group ───────
    const { data: source, error: srcErr } = await service
      .from('enrolments')
      .select(`
        id, player_id, group_id, organisation_id, status,
        is_trial, trial_expires_at, activates_on,
        player:players!enrolments_player_id_fkey(id, first_name, last_name, parent_id),
        group:training_groups!enrolments_group_id_fkey(id, name, day_of_week, time_slot)
      `)
      .eq('id', body.enrolmentId)
      .single()
    if (srcErr || !source) {
      return NextResponse.json({ error: 'Source enrolment not found.' }, { status: 404 })
    }
    if (source.organisation_id !== orgId) {
      return NextResponse.json({ error: 'Cross-tenant move is not allowed.' }, { status: 403 })
    }
    if (!['active', 'pending'].includes(source.status as string)) {
      return NextResponse.json({ error: `Source enrolment is ${source.status}; only active or pending enrolments can be moved.` }, { status: 409 })
    }
    if (source.group_id === body.destinationGroupId) {
      return NextResponse.json({ error: 'Player is already in this class.' }, { status: 409 })
    }

    // ── 4 · Read destination class + verify org ───────────────────────
    const { data: destGroup, error: destErr } = await service
      .from('training_groups')
      .select('id, name, organisation_id, day_of_week, time_slot, class_type, max_capacity')
      .eq('id', body.destinationGroupId)
      .single()
    if (destErr || !destGroup) {
      return NextResponse.json({ error: 'Destination class not found.' }, { status: 404 })
    }
    if (destGroup.organisation_id !== orgId) {
      return NextResponse.json({ error: 'Cross-tenant move is not allowed.' }, { status: 403 })
    }

    // ── 5 · Parse effective date ──────────────────────────────────────
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    let effectiveDate: Date = today
    if (body.effectiveDate) {
      const parsed = new Date(body.effectiveDate)
      if (!Number.isFinite(parsed.getTime())) {
        return NextResponse.json({ error: 'Invalid effective date.' }, { status: 400 })
      }
      parsed.setHours(0, 0, 0, 0)
      if (parsed.getTime() < today.getTime()) {
        return NextResponse.json({ error: 'Effective date cannot be in the past.' }, { status: 400 })
      }
      const maxAllowed = new Date(today.getTime() + MAX_FUTURE_DAYS * 24 * 60 * 60 * 1000)
      if (parsed.getTime() > maxAllowed.getTime()) {
        return NextResponse.json({ error: `Effective date cannot be more than ${MAX_FUTURE_DAYS} days in the future.` }, { status: 400 })
      }
      effectiveDate = parsed
    }
    const isImmediate = effectiveDate.getTime() === today.getTime()
    const effectiveDateIso = effectiveDate.toISOString().split('T')[0]

    // ── 6 · Check destination doesn't already hold this player ────────
    // The UNIQUE(player_id, group_id) constraint on enrolments catches
    // this at insert time, but a pre-check returns a friendly error.
    const { data: dupExisting } = await service
      .from('enrolments')
      .select('id, status')
      .eq('player_id', source.player_id)
      .eq('group_id', body.destinationGroupId)
      .in('status', ['active', 'pending'])
      .maybeSingle()
    if (dupExisting) {
      return NextResponse.json({ error: 'Player is already in the destination class.' }, { status: 409 })
    }

    // ── 7 · Insert destination via the existing capacity-checking RPC ─
    // Status + activates_on depend on whether this is an immediate or
    // future-dated move. The RPC is atomic w.r.t. seat counts.
    const destStatus = isImmediate ? 'active' : 'pending'
    const destActivatesOn = isImmediate ? null : effectiveDateIso

    const { data: rpcRes, error: rpcErr } = await service.rpc('enrol_if_capacity_available', {
      p_player_id: source.player_id,
      p_group_id: body.destinationGroupId,
      p_org_id: orgId,
      p_status: destStatus,
      p_activates_on: destActivatesOn,
    })
    if (rpcErr) {
      return NextResponse.json({ error: 'Capacity check failed.', detail: rpcErr.message }, { status: 500 })
    }
    const result = rpcRes as { ok: boolean; error?: string; enrolment_id?: string; idempotent?: boolean } | null
    if (!result?.ok) {
      if (result?.error === 'class_full') {
        return NextResponse.json({ error: 'class_full', message: 'Destination class is full.' }, { status: 409 })
      }
      return NextResponse.json({ error: result?.error || 'Could not enrol in destination class.' }, { status: 409 })
    }
    const destEnrolmentId = result.enrolment_id as string

    // ── 8 · Carry forward trial state + link to source ────────────────
    // Single update on the freshly-created destination enrolment.
    const updatePatch: Record<string, unknown> = {
      replaces_enrolment_id: source.id,
    }
    if (source.is_trial) {
      updatePatch.is_trial = true
      if (source.trial_expires_at) updatePatch.trial_expires_at = source.trial_expires_at
    }
    const { error: linkErr } = await service
      .from('enrolments')
      .update(updatePatch)
      .eq('id', destEnrolmentId)
    if (linkErr) {
      // Best effort: log and continue. Linking is for the cron; the
      // move itself has already succeeded above.
      console.error('move: failed to link destination to source enrolment', linkErr)
    }

    // ── 9 · Cancel source NOW only for immediate moves ────────────────
    // Future-dated moves leave the source active until the cron flips
    // both rows on the activation date.
    let cancellationId: string | null = null
    if (isImmediate) {
      const { error: cancelErr } = await service
        .from('enrolments')
        .update({ status: 'cancelled' })
        .eq('id', source.id)
      if (cancelErr) {
        console.error('move: failed to cancel source enrolment', cancelErr)
        // We do NOT roll back the destination — player is in both
        // classes which is recoverable; player in no class would not be.
        return NextResponse.json({
          error: 'Destination enrolment created, but failed to cancel source. Please remove the source enrolment manually.',
          destinationEnrolmentId: destEnrolmentId,
        }, { status: 500 })
      }

      // Audit row in cancellations with the new move columns. Reuses
      // the existing schema secured by Sprint P3 RLS.
      const { data: canRow, error: canErr } = await service
        .from('cancellations')
        .insert({
          organisation_id: orgId,
          enrolment_id: source.id,
          player_id: source.player_id,
          group_id: source.group_id,
          cancellation_type: 'class',
          reason: 'moved',
          notes: (body.reason || '').slice(0, 1000) || null,
          cancelled_by: user.id,
          moved_to_group_id: body.destinationGroupId,
          moved_to_enrolment_id: destEnrolmentId,
          final_status: 'cancelled',
        })
        .select('id')
        .single()
      if (canErr) {
        console.error('move: cancellations insert failed (non-fatal)', canErr)
      } else {
        cancellationId = (canRow?.id as string) || null
      }

      // Clear any 'waiting' waitlist entries for this player against
      // either the source or destination class — housekeeping.
      await service
        .from('waitlist')
        .update({ status: 'cancelled' })
        .eq('player_id', source.player_id)
        .in('group_id', [source.group_id, body.destinationGroupId])
        .eq('status', 'waiting')
        .then(() => undefined, (e) => console.error('move: waitlist housekeeping failed', e))
    }

    // ── 10 · Parent notification (fire-and-forget) ────────────────────
    // Sent for BOTH immediate and future-dated moves. The cron does
    // not re-send a duplicate when it flips the future move on the
    // activation date — the parent already knows.
    const player = (source.player as unknown as { first_name: string; last_name: string; parent_id: string | null } | null)
    const sourceGroup = (source.group as unknown as { name: string; day_of_week: string | null; time_slot: string | null } | null)
    if (player?.parent_id) {
      try {
        const { data: parent } = await service
          .from('profiles')
          .select('email, full_name')
          .eq('id', player.parent_id)
          .single()
        const { data: org } = await service
          .from('organisations')
          .select('name, slug, primary_color, logo_url, contact_email')
          .eq('id', orgId)
          .single()
        if (parent?.email && org) {
          const { sendEmail } = await import('@/lib/email')
          const { playerMoveConfirmationEmail } = await import('@/lib/email-templates')
          const template = playerMoveConfirmationEmail({
            parentName: (parent.full_name as string | null) || 'there',
            playerName: `${player.first_name} ${player.last_name}`.trim(),
            sourceClassName: sourceGroup?.name || 'their class',
            sourceClassWhen: [sourceGroup?.day_of_week, sourceGroup?.time_slot].filter(Boolean).join(' · ') || null,
            destinationClassName: destGroup.name,
            destinationClassWhen: [destGroup.day_of_week as string | null, destGroup.time_slot as string | null].filter(Boolean).join(' · ') || null,
            effectiveDate: effectiveDateIso,
            isImmediate,
            academyName: (org.name as string) || 'Your academy',
            academyContactEmail: (org.contact_email as string) || null,
            academyLogoUrl: (org.logo_url as string) || null,
            academyPrimaryColor: (org.primary_color as string) || null,
          })
          await sendEmail({
            to: parent.email as string,
            ...template,
            fromName: (org.name as string) || undefined,
            replyTo: (org.contact_email as string) || undefined,
          })
        }
      } catch (e) {
        console.error('move: parent notification email failed (non-fatal)', e)
      }
    }

    return NextResponse.json({
      ok: true,
      destinationEnrolmentId: destEnrolmentId,
      cancellationId,
      isImmediate,
      effectiveDate: effectiveDateIso,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
