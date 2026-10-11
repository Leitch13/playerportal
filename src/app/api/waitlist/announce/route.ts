import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { notifyOrgAdmins } from '@/lib/notify-admins'

export const dynamic = 'force-dynamic'

/**
 * Tell the academy a child has joined a class waiting list from the parent's
 * Schedule page.
 *
 * That button saves the waiting-list row straight from the browser, so it never
 * passed through /api/waitlist/join, which is where the academy is told. The
 * join was silent (found 11 Oct 2026, in the sweep after paid trials turned out
 * to be silent too). The button now calls this once the row is saved.
 *
 * It announces only what is really there: the caller must be signed in, the
 * child must be theirs, and the waiting row must exist. Best-effort — the join
 * already stands whatever happens here.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const body = await request.json().catch(() => null) as { groupId?: string; playerId?: string } | null
  if (!body?.groupId || !body?.playerId) return NextResponse.json({ error: 'groupId and playerId are required' }, { status: 400 })

  const db = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: row } = await db
    .from('waitlist')
    .select('id, position, organisation_id, player:players!inner(first_name, last_name, parent_id), group:training_groups(name)')
    .eq('group_id', body.groupId)
    .eq('player_id', body.playerId)
    .eq('status', 'waiting')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const player = row?.player as unknown as { first_name: string | null; last_name: string | null; parent_id: string | null } | null
  if (!row || player?.parent_id !== user.id) return NextResponse.json({ ok: false, error: 'No waiting-list place found for this child' }, { status: 404 })

  const childName = `${player?.first_name || ''} ${player?.last_name || ''}`.trim() || 'A player'
  const className = ((row.group as unknown as { name: string | null } | null)?.name || 'a class').trim()
  await notifyOrgAdmins({
    orgId: row.organisation_id as string,
    type: 'waitlist_joined',
    title: 'New waitlist signup',
    body: `${childName} joined the waitlist for ${className} (position ${row.position}).`,
    link: '/dashboard/waitlist',
    email: true,
  })
  return NextResponse.json({ ok: true })
}
