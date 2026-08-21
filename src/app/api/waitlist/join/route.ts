import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

/**
 * Parent joins a class waitlist.
 *
 * Body: { groupId: string, playerId?: string }
 *
 * - Auth required (returns 401 if not signed in — client should bounce to signin).
 * - If `playerId` is omitted, we use the parent's first child at the same org.
 * - Computes the next position in the queue and inserts a `waiting` row.
 * - Idempotent: if the player is already on the list for this group with
 *   `waiting` status, returns the existing row instead of inserting a duplicate.
 *
 * DB access is via the SERVICE ROLE with explicit ownership filters, NOT the
 * session client. Under RLS, `authenticated` users can only SELECT their own
 * org's training_groups — so a signed-in parent from another academy (or a
 * user whose profile isn't attached to this org yet) got a bogus "Class not
 * found" on a class that anon visitors could see fine. The same session-RLS
 * lens also made the position computation see only the caller's own waitlist
 * rows. Security is preserved by the explicit checks below: the class must be
 * published (org too), and the player must belong to the calling parent AND
 * to the class's org.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  let body: { groupId?: string; playerId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { groupId } = body
  let { playerId } = body
  if (!groupId) {
    return NextResponse.json({ error: 'groupId is required' }, { status: 400 })
  }

  const db = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Resolve the target class — mirror what an anon visitor is allowed to see:
  // a published class in a published org. Unpublished stays invisible.
  const { data: group } = await db
    .from('training_groups')
    .select('id, organisation_id, name, is_published, organisation:organisations!inner(is_published)')
    .eq('id', groupId)
    .single()

  const orgPublished = (group?.organisation as unknown as { is_published?: boolean } | null)?.is_published
  if (!group || group.is_published === false || !orgPublished) {
    return NextResponse.json({ error: 'Class not found' }, { status: 404 })
  }

  // If no playerId was provided, pick the parent's first child in this org.
  if (!playerId) {
    const { data: child } = await db
      .from('players')
      .select('id')
      .eq('parent_id', user.id)
      .eq('organisation_id', group.organisation_id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (!child) {
      return NextResponse.json({
        error: 'You have no child registered with this academy yet. Add a child first, then join the waitlist.',
        code: 'NO_CHILD',
      }, { status: 400 })
    }
    playerId = child.id
  } else {
    // Verify the player actually belongs to this parent + this org.
    const { data: child } = await db
      .from('players')
      .select('id, organisation_id, parent_id')
      .eq('id', playerId)
      .single()
    if (!child || child.parent_id !== user.id || child.organisation_id !== group.organisation_id) {
      return NextResponse.json({ error: 'Player not found in your account for this academy' }, { status: 403 })
    }
  }

  // Idempotency: if this child is already waiting for this group, return that row.
  const { data: existing } = await db
    .from('waitlist')
    .select('id, position, status')
    .eq('group_id', groupId)
    .eq('player_id', playerId)
    .in('status', ['waiting', 'offered'])
    .maybeSingle()
  if (existing) {
    return NextResponse.json({ already: true, id: existing.id, position: existing.position, status: existing.status })
  }

  // Compute next position (service role sees the WHOLE queue, not just the
  // caller's rows — under session RLS every parent thought they were #1).
  const { data: last } = await db
    .from('waitlist')
    .select('position')
    .eq('group_id', groupId)
    .eq('status', 'waiting')
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextPosition = (last?.position || 0) + 1

  const { data: inserted, error } = await db
    .from('waitlist')
    .insert({
      player_id: playerId,
      group_id: groupId,
      parent_id: user.id,
      organisation_id: group.organisation_id,
      position: nextPosition,
      status: 'waiting',
    })
    .select('id, position')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Tell the academy — joins were previously silent, so admins only ever
  // discovered waitlist demand by opening the dashboard page. Best-effort:
  // a notification failure must never fail the join.
  try {
    const [{ data: player }, { data: admins }] = await Promise.all([
      db.from('players').select('first_name, last_name').eq('id', playerId).single(),
      db.from('profiles').select('id').eq('organisation_id', group.organisation_id).eq('role', 'admin'),
    ])
    const childName = `${player?.first_name || ''} ${player?.last_name || ''}`.trim() || 'A player'
    if (admins?.length) {
      await db.from('notifications').insert(
        admins.map((a) => ({
          user_id: a.id as string,
          organisation_id: group.organisation_id,
          type: 'waitlist_joined',
          title: 'New waitlist signup',
          body: `${childName} joined the waitlist for ${group.name?.trim() || 'a class'} (position ${inserted.position}).`,
          link: '/dashboard/waitlist',
        }))
      )
    }
  } catch {
    /* best-effort */
  }

  return NextResponse.json({ id: inserted.id, position: inserted.position })
}
