import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

  // Resolve the target class's org so we don't trust client-supplied orgIds.
  const { data: group } = await supabase
    .from('training_groups')
    .select('id, organisation_id, name')
    .eq('id', groupId)
    .single()

  if (!group) {
    return NextResponse.json({ error: 'Class not found' }, { status: 404 })
  }

  // If no playerId was provided, pick the parent's first child in this org.
  if (!playerId) {
    const { data: child } = await supabase
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
    const { data: child } = await supabase
      .from('players')
      .select('id, organisation_id, parent_id')
      .eq('id', playerId)
      .single()
    if (!child || child.parent_id !== user.id || child.organisation_id !== group.organisation_id) {
      return NextResponse.json({ error: 'Player not found in your account for this academy' }, { status: 403 })
    }
  }

  // Idempotency: if this child is already waiting for this group, return that row.
  const { data: existing } = await supabase
    .from('waitlist')
    .select('id, position, status')
    .eq('group_id', groupId)
    .eq('player_id', playerId)
    .in('status', ['waiting', 'offered'])
    .maybeSingle()
  if (existing) {
    return NextResponse.json({ already: true, id: existing.id, position: existing.position, status: existing.status })
  }

  // Compute next position
  const { data: last } = await supabase
    .from('waitlist')
    .select('position')
    .eq('group_id', groupId)
    .eq('status', 'waiting')
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextPosition = (last?.position || 0) + 1

  const { data: inserted, error } = await supabase
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

  return NextResponse.json({ id: inserted.id, position: inserted.position })
}
