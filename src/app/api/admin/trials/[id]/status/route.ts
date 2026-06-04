import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

/**
 * Admin: transition a trial_bookings row through the workflow lifecycle.
 *
 * Allowed transitions (anything else returns 409 Conflict):
 *   pending    → confirmed | cancelled
 *   confirmed  → attended  | no_show   | cancelled
 *   attended   → cancelled
 *   no_show    → cancelled
 *   cancelled  → (terminal)
 *
 * Side-effects within `trial_bookings` ONLY:
 *   • status        ← <new status>
 *   • confirmed_at  ← now() when entering 'confirmed' for the first time
 *   • updated_at    ← now()
 *
 * DB-only. Mirrors the mark-converted pattern:
 *   - server-side auth (admin only)
 *   - explicit org match before mutation
 *   - service-role client for the actual UPDATE
 *   - best-effort audit_log insert (non-blocking if it fails)
 *
 * Replaces the client-side `supabase.from('trial_bookings').update(...)`
 * call in TrialManager.tsx which was silently no-op'd by RLS — the anon
 * client returned HTTP 204 with no row-count, no error visible to the
 * user, and the button appeared dead.
 */

type TrialStatus = 'pending' | 'confirmed' | 'attended' | 'no_show' | 'cancelled'

const ALLOWED_FROM: Record<TrialStatus, TrialStatus[]> = {
  pending:   ['confirmed', 'cancelled'],
  confirmed: ['attended', 'no_show', 'cancelled'],
  attended:  ['cancelled'],
  no_show:   ['cancelled'],
  cancelled: [],
}

function isTrialStatus(v: unknown): v is TrialStatus {
  return v === 'pending' || v === 'confirmed' || v === 'attended' || v === 'no_show' || v === 'cancelled'
}

const AUDIT_ACTION: Partial<Record<TrialStatus, string>> = {
  confirmed: 'trial.confirmed',
  attended:  'trial.attended',
  no_show:   'trial.no_show',
  cancelled: 'trial.cancelled',
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: bookingId } = await params

  const body = await req.json().catch(() => null) as { status?: unknown } | null
  const targetStatus = body?.status
  if (!isTrialStatus(targetStatus)) {
    return NextResponse.json(
      { ok: false, error: 'Invalid status. Expected one of pending|confirmed|attended|no_show|cancelled' },
      { status: 400 },
    )
  }
  if (targetStatus === 'pending') {
    // Pending is the initial state — never a valid transition target.
    return NextResponse.json({ ok: false, error: 'Cannot transition back to pending' }, { status: 400 })
  }

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase
    .from('profiles')
    .select('role, organisation_id')
    .eq('id', user.id)
    .single()
  if (!me || me.role !== 'admin') {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
  }
  const myOrgId = me.organisation_id as string

  const { data: booking } = await supabase
    .from('trial_bookings')
    .select('id, organisation_id, status, confirmed_at')
    .eq('id', bookingId)
    .maybeSingle()
  if (!booking || booking.organisation_id !== myOrgId) {
    return NextResponse.json({ ok: false, error: 'Trial booking not found' }, { status: 404 })
  }

  const currentStatus = ((booking.status || 'pending') as string).toLowerCase()
  if (!isTrialStatus(currentStatus)) {
    return NextResponse.json({ ok: false, error: `Unknown current status: ${currentStatus}` }, { status: 500 })
  }

  // Idempotent — already in the target state.
  if (currentStatus === targetStatus) {
    return NextResponse.json({ ok: true, alreadyAtStatus: true, status: targetStatus })
  }

  if (!ALLOWED_FROM[currentStatus].includes(targetStatus)) {
    return NextResponse.json(
      { ok: false, error: `Cannot transition ${currentStatus} → ${targetStatus}` },
      { status: 409 },
    )
  }

  const now = new Date().toISOString()
  const update: Record<string, unknown> = {
    status: targetStatus,
    updated_at: now,
  }
  // Stamp confirmed_at only on the first transition INTO 'confirmed'.
  if (targetStatus === 'confirmed' && !booking.confirmed_at) {
    update.confirmed_at = now
  }

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { error } = await service.from('trial_bookings').update(update).eq('id', bookingId)
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  // Best-effort audit log. Insert is non-blocking — if audit_log is not
  // available (or schema drifts) we still return ok=true to the UI.
  const action = AUDIT_ACTION[targetStatus]
  if (action) {
    try {
      await service.from('audit_log').insert({
        organisation_id: myOrgId,
        user_id: user.id,
        action,
        entity_type: 'trial_booking',
        entity_id: bookingId,
        details: { from: currentStatus, to: targetStatus },
      })
    } catch {
      // Swallow audit failures — the primary state change already succeeded.
    }
  }

  return NextResponse.json({ ok: true, from: currentStatus, to: targetStatus })
}
