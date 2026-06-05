/**
 * /api/enrolments/cancel — Parent cancels ONE class enrolment.
 *
 * Mirrors the audit-and-intelligence pattern of /api/stripe/cancel
 * (subscription cancellation) so the academy gets a single, consistent
 * view of "why are families cancelling" across both flows.
 *
 * Behaviour:
 *   1. Auth parent; verify the enrolment belongs to one of their children.
 *   2. Update enrolments.status = 'cancelled'.
 *   3. Insert a cancellations row with cancellation_type='class', the
 *      enrolment_id, reason + reason_detail + offered_discount flag, and
 *      final_status='cancelled'. (Retained path is handled by
 *      /api/stripe/retain which records its own row.)
 *   4. Fire /api/waitlist/promote so the vacated seat is offered to the
 *      next person on the waitlist (matches existing behaviour).
 *
 * Does NOT:
 *   • Touch subscriptions (parent stays subscribed).
 *   • Touch Stripe Connect parameters / fees / application_fee_percent.
 *   • Send an admin email per class cancel — class cancellations are
 *     roster changes, not revenue events. Analytics live in the
 *     cancellations table for admin queries.
 *
 * Body:
 *   { enrolmentId: string, reason?: string, reasonDetail?: string|null,
 *     offerWasShown?: boolean }
 *
 * Reason codes accepted (mapped from UI):
 *   too_expensive | schedule_conflict | child_stopped | switching | other
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

// UI sends these short codes; we map to the cancellations.reason CHECK
// constraint vocab. Keep this mapping co-located with the endpoint so
// the contract is obvious.
const REASON_MAP: Record<string, string> = {
  expensive: 'too_expensive',
  schedule: 'schedule_conflict',
  child_stopped: 'child_stopped',
  switching: 'switching',
  other: 'other',
}

export async function POST(request: NextRequest) {
  let body: { enrolmentId?: string; reason?: string; reasonDetail?: string | null; offerWasShown?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid JSON body' }, { status: 400 })
  }

  if (!body.enrolmentId) {
    return NextResponse.json({ ok: false, error: 'enrolmentId required' }, { status: 400 })
  }

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  // ── Verify ownership: the enrolment's player must belong to this parent ──
  const { data: enrol } = await supabase
    .from('enrolments')
    .select('id, player_id, group_id, organisation_id, status')
    .eq('id', body.enrolmentId)
    .single()
  if (!enrol) return NextResponse.json({ ok: false, error: 'Enrolment not found' }, { status: 404 })

  const { data: player } = await supabase
    .from('players')
    .select('id, parent_id, first_name, last_name')
    .eq('id', (enrol as { player_id?: string }).player_id || '')
    .single()
  if (!player || (player as { parent_id?: string }).parent_id !== user.id) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
  }

  if ((enrol as { status?: string }).status === 'cancelled') {
    return NextResponse.json({ ok: true, alreadyCancelled: true })
  }

  // Map UI reason code → canonical reason. Unknown codes fall through to null
  // (the CHECK accepts null because the constraint applies only when not null —
  // matches subscription-cancel behaviour).
  const canonicalReason = body.reason && REASON_MAP[body.reason]
    ? REASON_MAP[body.reason]
    : (body.reason || null)

  // Service role for the writes — we've already verified ownership.
  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // ── 1. Cancel the enrolment ──
  const { error: enrolErr } = await service
    .from('enrolments')
    .update({ status: 'cancelled' })
    .eq('id', body.enrolmentId)
  if (enrolErr) return NextResponse.json({ ok: false, error: enrolErr.message }, { status: 500 })

  // ── 2. Cancellations audit row (class-type). Best-effort: if migration 076
  //       isn't applied yet, retry without the new columns. ──
  const orgId = (enrol as { organisation_id?: string }).organisation_id || null
  const fullInsert = {
    profile_id: user.id,
    organisation_id: orgId,
    enrolment_id: body.enrolmentId,
    cancellation_type: 'class',
    reason: canonicalReason,
    reason_detail: body.reasonDetail || null,
    offered_discount: !!body.offerWasShown,
    accepted_discount: false,
    final_status: 'cancelled',
    cancelled_at: new Date().toISOString(),
  }
  let insErr = (await service.from('cancellations').insert(fullInsert)).error
  if (insErr && insErr.code === '42703') {
    // Migration 076 not yet applied — retry without the new columns so the
    // endpoint still works during the rollout window. The reason still
    // persists; the enrolment_id + type are dropped silently.
    const legacyInsert = { ...fullInsert } as Record<string, unknown>
    delete legacyInsert.enrolment_id
    delete legacyInsert.cancellation_type
    insErr = (await service.from('cancellations').insert(legacyInsert)).error
  }
  if (insErr) {
    // Don't fail the user-facing action just because the audit row failed.
    // Log for follow-up; the enrolment is already cancelled successfully.
    console.error('cancellations insert failed (non-fatal):', insErr)
  }

  // ── 3. Promote the next person on the waitlist (fire-and-forget) ──
  // Sprint 13 (M3 caller-side) — /api/waitlist/promote now requires
  // either an admin/coach cookie session or the server-to-server
  // internal secret. This caller has no cookie session (it's a
  // fire-and-forget from the server runtime), so it presents the
  // secret instead. Env var already set in Vercel Production; matches
  // the pattern used by /api/email/migration-invite-batch.
  if ((enrol as { group_id?: string }).group_id) {
    void fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://theplayerportal.net'}/api/waitlist/promote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': process.env.INTERNAL_API_SECRET || '',
      },
      body: JSON.stringify({ group_id: (enrol as { group_id?: string }).group_id }),
    }).catch(() => undefined)
  }

  return NextResponse.json({ ok: true })
}
