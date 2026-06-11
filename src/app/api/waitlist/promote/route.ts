import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'
import { waitlistSpotAvailableEmail } from '@/lib/email-templates'
import { WAITLIST_TOKEN_ON, generateWaitlistToken, withToken } from '@/lib/waitlist-token'

// WAITLIST_SCHEMA_FIX_ENABLED — see /api/waitlist/accept/route.ts.
const SCHEMA_FIX_ON = process.env.WAITLIST_SCHEMA_FIX_ENABLED === 'true'
const PROMOTE_SELECT = SCHEMA_FIX_ON
  ? `id, player_id, parent_id, group_id, organisation_id, position,
     player:players(id, first_name, last_name),
     parent:profiles!waitlist_parent_id_fkey(full_name, email),
     group:training_groups!waitlist_group_id_fkey(id, name)`
  : `id, player_id, parent_id, training_group_id, organisation_id, position,
     player:players(id, first_name, last_name),
     parent:profiles!waitlist_parent_id_fkey(full_name, email),
     group:training_groups!waitlist_training_group_id_fkey(id, name)`
const GROUP_COL = SCHEMA_FIX_ON ? 'group_id' : 'training_group_id'

export async function POST(request: NextRequest) {
  try {
    const { group_id } = await request.json()

    if (!group_id) {
      return NextResponse.json({ error: 'group_id is required' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Find the next waiting entry for this group
    const { data: nextEntry, error: fetchError } = await supabase
      .from('waitlist')
      .select(PROMOTE_SELECT)
      .eq(GROUP_COL, group_id)
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
    // Finding #1: mint a fresh per-offer token (flag-gated).
    const offerToken = WAITLIST_TOKEN_ON ? generateWaitlistToken() : null

    // Update waitlist entry to offered
    const { error: updateError } = await supabase
      .from('waitlist')
      .update({
        status: 'offered',
        offered_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        ...(WAITLIST_TOKEN_ON ? { accept_token: offerToken } : {}),
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
        acceptUrl: withToken(`${appUrl}/api/waitlist/accept?id=${nextEntry.id}`, offerToken),
        declineUrl: withToken(`${appUrl}/api/waitlist/decline?id=${nextEntry.id}`, offerToken),
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
