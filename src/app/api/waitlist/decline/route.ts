import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'
import { waitlistDeclinedEmail, waitlistSpotAvailableEmail } from '@/lib/email-templates'
import { WAITLIST_TOKEN_ON, generateWaitlistToken, withToken, verifyWaitlistToken, fetchStoredToken } from '@/lib/waitlist-token'

// WAITLIST_SCHEMA_FIX_ENABLED — see /api/waitlist/accept/route.ts for full
// rationale. Real column is group_id; today's code uses training_group_id
// which doesn't exist. Flag-gated so rollback is one env flip.
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
const DECLINE_SELECT = SCHEMA_FIX_ON
  ? `id, group_id, status,
     player:players(id, first_name, last_name),
     parent:profiles!waitlist_parent_id_fkey(full_name, email),
     group:training_groups!waitlist_group_id_fkey(id, name)`
  : `id, training_group_id, status,
     player:players(id, first_name, last_name),
     parent:profiles!waitlist_parent_id_fkey(full_name, email),
     group:training_groups!waitlist_training_group_id_fkey(id, name)`
const GROUP_COL = SCHEMA_FIX_ON ? 'group_id' : 'training_group_id'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function entryGroupId(e: any): string {
  return SCHEMA_FIX_ON ? e.group_id : e.training_group_id
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function promoteNext(supabase: any, groupId: string) {
  // Find the next waiting entry
  const { data: nextEntry } = await supabase
    .from('waitlist')
    .select(PROMOTE_SELECT)
    .eq(GROUP_COL, groupId)
    .eq('status', 'waiting')
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (!nextEntry) return null

  const now = new Date()
  const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000)
  // Finding #1: mint a fresh per-offer token (flag-gated). Stored on the row
  // and embedded in the accept/decline links below.
  const offerToken = WAITLIST_TOKEN_ON ? generateWaitlistToken() : null

  await supabase.from('waitlist').update({
    status: 'offered',
    offered_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    ...(WAITLIST_TOKEN_ON ? { accept_token: offerToken } : {}),
  }).eq('id', nextEntry.id)

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
    const template = waitlistSpotAvailableEmail({
      parentName: parent.full_name?.split(' ')[0] || 'there',
      childName: player?.full_name || `${player?.first_name || ''} ${player?.last_name || ''}`.trim() || 'your child',
      className: group?.name || 'the class',
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

  return nextEntry.id
}

export async function POST(request: NextRequest) {
  try {
    const { id, token } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'Waitlist entry id is required' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Fetch the entry
    const { data: entry } = await supabase
      .from('waitlist')
      .select(DECLINE_SELECT)
      .eq('id', id)
      .single()

    if (!entry) {
      return NextResponse.json({ error: 'Waitlist entry not found' }, { status: 404 })
    }
    // Finding #1: token gate (no-op when flag OFF; grace-allows NULL token).
    if (!verifyWaitlistToken(await fetchStoredToken(supabase, id), token).ok) {
      return NextResponse.json({ error: 'invalid_token' }, { status: 403 })
    }

    if (entry.status !== 'offered') {
      return NextResponse.json({ error: `Cannot decline — current status is "${entry.status}"` }, { status: 400 })
    }

    // Update to declined
    await supabase.from('waitlist').update({ status: 'declined' }).eq('id', id)

    // Send decline confirmation email
    const parent = entry.parent as unknown as { full_name: string; email: string } | null
    const player = entry.player as unknown as { full_name?: string; first_name?: string; last_name?: string } | null
    const group = entry.group as unknown as { name: string } | null

    if (parent?.email) {
      const template = waitlistDeclinedEmail({
        parentName: parent.full_name?.split(' ')[0] || 'there',
        childName: player?.full_name || `${player?.first_name || ''} ${player?.last_name || ''}`.trim() || 'your child',
        className: group?.name || 'the class',
      })
      await sendEmail({ to: parent.email, ...template })
    }

    // Promote the next person
    const promoted = await promoteNext(supabase, entryGroupId(entry))

    return NextResponse.json({ success: true, next_promoted: promoted })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Support GET for email link clicks
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')
  const token = request.nextUrl.searchParams.get('token')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://theplayerportal.net'

  if (!id) {
    return NextResponse.redirect(`${appUrl}/dashboard/waitlist?error=missing_id`)
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: entry } = await supabase
    .from('waitlist')
    .select(DECLINE_SELECT)
    .eq('id', id)
    .single()

  if (!entry) {
    return NextResponse.redirect(`${appUrl}/dashboard/waitlist?error=invalid`)
  }
  // Finding #1: token gate (email-link path). No-op when flag OFF.
  if (!verifyWaitlistToken(await fetchStoredToken(supabase, id), token).ok) {
    return NextResponse.redirect(`${appUrl}/dashboard/waitlist?error=invalid_token`)
  }
  if (entry.status !== 'offered') {
    return NextResponse.redirect(`${appUrl}/dashboard/waitlist?error=invalid`)
  }

  await supabase.from('waitlist').update({ status: 'declined' }).eq('id', id)

  const parent = entry.parent as unknown as { full_name: string; email: string } | null
  const player = entry.player as unknown as { full_name?: string; first_name?: string; last_name?: string } | null
  const group = entry.group as unknown as { name: string } | null

  if (parent?.email) {
    const template = waitlistDeclinedEmail({
      parentName: parent.full_name?.split(' ')[0] || 'there',
      childName: player?.full_name || `${player?.first_name || ''} ${player?.last_name || ''}`.trim() || 'your child',
      className: group?.name || 'the class',
    })
    await sendEmail({ to: parent.email, ...template })
  }

  await promoteNext(supabase, entryGroupId(entry))

  return NextResponse.redirect(`${appUrl}/dashboard/waitlist?declined=true`)
}
