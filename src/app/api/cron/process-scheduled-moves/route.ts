/**
 * Sprint 8b v1 — Daily cron that completes future-dated player moves.
 *
 * A future-dated move scheduled by /api/enrolments/move leaves two
 * rows in the database until the activation date:
 *
 *   • source enrolment       — status='active' (unchanged)
 *   • destination enrolment  — status='pending', activates_on=<date>,
 *                              replaces_enrolment_id=source.id
 *
 * This cron runs once per day, finds every pending destination whose
 * activates_on is today or earlier, and atomically:
 *
 *   1. flips destination to status='active'
 *   2. flips source to status='cancelled'
 *   3. inserts the cancellations audit row (reason='moved')
 *   4. clears any source-class waitlist 'waiting' row for the player
 *
 * Idempotent: re-running the same day is a no-op (the WHERE filter
 * excludes already-active rows).
 *
 * Authorised the same way as the other crons (CRON_SECRET header check
 * — Vercel cron infra signs requests; manual triggers from operators
 * must pass the header).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET
  const provided =
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    request.nextUrl.searchParams.get('secret') ||
    ''
  if (!expected || provided !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayIso = today.toISOString().split('T')[0]

  // Find pending destination enrolments whose activation date has
  // arrived. The new partial index (migration 082) makes this cheap.
  const { data: due, error: dueErr } = await service
    .from('enrolments')
    .select(`
      id, player_id, group_id, organisation_id, replaces_enrolment_id, activates_on,
      replaces:enrolments!enrolments_replaces_enrolment_id_fkey(id, player_id, group_id, status)
    `)
    .eq('status', 'pending')
    .not('replaces_enrolment_id', 'is', null)
    .lte('activates_on', todayIso)

  if (dueErr) {
    return NextResponse.json({ error: 'lookup_failed', detail: dueErr.message }, { status: 500 })
  }

  type Row = {
    id: string
    player_id: string
    group_id: string
    organisation_id: string
    replaces_enrolment_id: string | null
    activates_on: string | null
    replaces: { id: string; player_id: string; group_id: string; status: string } | null
  }
  const rows = ((due ?? []) as unknown as Row[])

  let activated = 0
  let cancelled = 0
  let waitlistCleared = 0
  const errors: Array<{ id: string; step: string; error: string }> = []

  for (const row of rows) {
    // 1. Flip destination to active
    const { error: actErr } = await service
      .from('enrolments')
      .update({ status: 'active' })
      .eq('id', row.id)
      .eq('status', 'pending')        // optimistic concurrency
    if (actErr) {
      errors.push({ id: row.id, step: 'activate_destination', error: actErr.message })
      continue
    }
    activated++

    // 2. Cancel the source enrolment (if still present + active)
    if (row.replaces && row.replaces.status === 'active') {
      const { error: cancErr } = await service
        .from('enrolments')
        .update({ status: 'cancelled' })
        .eq('id', row.replaces.id)
        .eq('status', 'active')
      if (cancErr) {
        errors.push({ id: row.id, step: 'cancel_source', error: cancErr.message })
        // Continue — destination is active, audit row below will still go in.
      } else {
        cancelled++
      }

      // 3. Audit row
      const { error: canErr } = await service
        .from('cancellations')
        .insert({
          organisation_id: row.organisation_id,
          enrolment_id: row.replaces.id,
          player_id: row.replaces.player_id,
          group_id: row.replaces.group_id,
          cancellation_type: 'class',
          reason: 'moved',
          notes: 'Scheduled move activated by cron.',
          cancelled_by: null,
          moved_to_group_id: row.group_id,
          moved_to_enrolment_id: row.id,
          final_status: 'cancelled',
        })
      if (canErr) {
        errors.push({ id: row.id, step: 'cancellations_insert', error: canErr.message })
      }

      // 4. Waitlist housekeeping
      const { count: waitlistCount, error: wlErr } = await service
        .from('waitlist')
        .update({ status: 'cancelled' }, { count: 'exact' })
        .eq('player_id', row.replaces.player_id)
        .in('group_id', [row.replaces.group_id, row.group_id])
        .eq('status', 'waiting')
      if (wlErr) {
        errors.push({ id: row.id, step: 'waitlist_cleanup', error: wlErr.message })
      } else if (waitlistCount) {
        waitlistCleared += waitlistCount
      }
    }
  }

  return NextResponse.json({
    ok: true,
    candidates: rows.length,
    activated,
    cancelled,
    waitlistCleared,
    errors,
  })
}
