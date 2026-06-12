import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { REPORT_VIEWED_TRACKING_ENABLED } from '@/lib/report-visibility'

// Slice B — Viewed tracking.
// POST /api/players/[id]/report/viewed
// Records progress_reviews.viewed_at on the latest review for this player when
// the OWNING PARENT opens the report. Service-role-behind-auth: the ownership
// check (RLS-scoped SELECT + parent_id === auth.uid()) is the security
// boundary, so NO parent UPDATE policy is added to progress_reviews (Protected
// #10 RLS untouched). First-view-wins + .is('viewed_at', null) ⇒ idempotent.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: playerId } = await params

  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Inert when the flag is off — no writes, byte-identical to "feature absent".
  if (!REPORT_VIEWED_TRACKING_ENABLED) {
    return NextResponse.json({ noop: true })
  }

  // OWNERSHIP GATE (replaces an RLS policy). The user-session SELECT is RLS-
  // scoped (a parent can only see their own children); the explicit parent_id
  // check additionally excludes staff (we record PARENT-viewed, not coach
  // self-view) and any non-owner.
  const { data: player } = await supabase
    .from('players')
    .select('id, parent_id')
    .eq('id', playerId)
    .single()

  if (!player || player.parent_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // The report the parent is opening = the latest review for this player.
  const { data: latest } = await supabase
    .from('progress_reviews')
    .select('id')
    .eq('player_id', playerId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!latest) return NextResponse.json({ noReview: true })

  // Service-role write: ONLY viewed_at, ONLY on the ownership-verified review,
  // ONLY when NULL (first view wins; repeat opens are no-ops).
  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  await admin
    .from('progress_reviews')
    .update({ viewed_at: new Date().toISOString() })
    .eq('id', latest.id)
    .is('viewed_at', null)

  return NextResponse.json({ viewed: true })
}
