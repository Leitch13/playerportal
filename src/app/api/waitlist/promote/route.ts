import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'
import { waitlistSpotAvailableEmail } from '@/lib/email-templates'
// Sprint 13 (M3) — authenticated callers go through the standard
// server client so we can role-gate via get_my_role(). The existing
// service-role client (below) is still used for the actual waitlist
// + notification writes — same behaviour as before.
import { createClient as createServerClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    // ─── Sprint 13 M3 — auth gate ─────────────────────────────────────
    // Two valid call paths:
    //   1. Admin / coach user from the dashboard (cookie-auth)
    //      — WaitlistManager, ClassRosterRow (Sprint 8a),
    //        EnrolmentStatusToggle all run inside admin contexts
    //   2. Internal server-to-server fire-and-forget from
    //      /api/enrolments/cancel (Sprint 8a parent-cancel path)
    //      — passes x-internal-secret header
    // Anything else is rejected.
    const internalSecret = request.headers.get('x-internal-secret')
    const internalAllowed =
      !!internalSecret && internalSecret === (process.env.INTERNAL_API_SECRET || '___unset___')

    if (!internalAllowed) {
      const authed = await createServerClient()
      const { data: role } = await authed.rpc('get_my_role')
      if (!role || !['admin', 'coach'].includes(role)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      }
    }
    // ─────────────────────────────────────────────────────────────────

    const { group_id } = await request.json()

    if (!group_id) {
      return NextResponse.json({ error: 'group_id is required' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Find the next waiting entry for this group.
    // NOTE: column is `group_id` — historically this code referenced a
    // non-existent `training_group_id` and silently 500'd whenever an
    // enrolment cancellation tried to promote the next person.
    const { data: nextEntry, error: fetchError } = await supabase
      .from('waitlist')
      .select(`
        id, player_id, parent_id, group_id, organisation_id, position,
        player:players(id, full_name, first_name, last_name),
        parent:profiles!waitlist_parent_id_fkey(full_name, email),
        group:training_groups!waitlist_group_id_fkey(id, name)
      `)
      .eq('group_id', group_id)
      .eq('status', 'waiting')
      .order('position', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (fetchError || !nextEntry) {
      return NextResponse.json({ message: 'No one on the waitlist for this group' }, { status: 200 })
    }

    const now = new Date()
    const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000)

    // Update waitlist entry to offered
    const { error: updateError } = await supabase
      .from('waitlist')
      .update({
        status: 'offered',
        offered_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      })
      .eq('id', nextEntry.id)

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update waitlist entry' }, { status: 500 })
    }

    // Create notification
    await supabase.from('notifications').insert({
      user_id: nextEntry.parent_id,
      organisation_id: nextEntry.organisation_id,
      type: 'waitlist_offer',
      title: 'A spot has opened up!',
      body: 'A spot has become available in the class. You have 48 hours to confirm.',
      link: '/dashboard/waitlist',
    })

    // Send email
    const parent = nextEntry.parent as unknown as { full_name: string; email: string } | null
    const player = nextEntry.player as unknown as { full_name?: string; first_name?: string; last_name?: string } | null
    const group = nextEntry.group as unknown as { name: string } | null

    if (parent?.email) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://theplayerportal.net'
      const parentName = parent.full_name?.split(' ')[0] || 'there'
      const childName = player?.full_name || `${player?.first_name || ''} ${player?.last_name || ''}`.trim() || 'your child'
      const className = group?.name || 'the class'

      const template = waitlistSpotAvailableEmail({
        parentName,
        childName,
        className,
        acceptUrl: `${appUrl}/api/waitlist/accept?id=${nextEntry.id}`,
        declineUrl: `${appUrl}/api/waitlist/decline?id=${nextEntry.id}`,
        expiryDate: expiresAt.toLocaleDateString('en-GB', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          hour: '2-digit',
          minute: '2-digit',
        }),
      })

      await sendEmail({ to: parent.email, ...template })
    }

    return NextResponse.json({ promoted: nextEntry.id, expires_at: expiresAt.toISOString() })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
