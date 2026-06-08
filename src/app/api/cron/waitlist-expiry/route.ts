import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'
import { waitlistExpiredEmail, waitlistSpotAvailableEmail } from '@/lib/email-templates'

// WAITLIST_SCHEMA_FIX_ENABLED — see /api/waitlist/accept/route.ts.
const SCHEMA_FIX_ON = process.env.WAITLIST_SCHEMA_FIX_ENABLED === 'true'
const EXPIRED_SELECT = SCHEMA_FIX_ON
  ? `id, group_id, parent_id, organisation_id,
     player:players(id, first_name, last_name),
     parent:profiles!waitlist_parent_id_fkey(full_name, email),
     group:training_groups!waitlist_group_id_fkey(id, name)`
  : `id, training_group_id, parent_id, organisation_id,
     player:players(id, first_name, last_name),
     parent:profiles!waitlist_parent_id_fkey(full_name, email),
     group:training_groups!waitlist_training_group_id_fkey(id, name)`
const NEXT_SELECT = SCHEMA_FIX_ON
  ? `id, parent_id, organisation_id,
     player:players(id, first_name, last_name),
     parent:profiles!waitlist_parent_id_fkey(full_name, email),
     group:training_groups!waitlist_group_id_fkey(id, name)`
  : `id, parent_id, organisation_id,
     player:players(id, first_name, last_name),
     parent:profiles!waitlist_parent_id_fkey(full_name, email),
     group:training_groups!waitlist_training_group_id_fkey(id, name)`
const GROUP_COL = SCHEMA_FIX_ON ? 'group_id' : 'training_group_id'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function entryGroupId(e: any): string {
  return SCHEMA_FIX_ON ? e.group_id : e.training_group_id
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Find expired offers
  const { data: expiredEntries } = await supabase
    .from('waitlist')
    .select(EXPIRED_SELECT)
    .eq('status', 'offered')
    .lt('expires_at', new Date().toISOString())

  let expired = 0
  let promoted = 0
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://theplayerportal.net'

  for (const entry of expiredEntries || []) {
    // Mark as expired
    await supabase.from('waitlist').update({ status: 'expired' }).eq('id', entry.id)
    expired++

    const parent = entry.parent as unknown as { full_name: string; email: string } | null
    const player = entry.player as unknown as { full_name?: string; first_name?: string; last_name?: string } | null
    const group = entry.group as unknown as { name: string } | null
    const childName = player?.full_name || `${player?.first_name || ''} ${player?.last_name || ''}`.trim() || 'your child'
    const className = group?.name || 'the class'

    // Send expired email
    if (parent?.email) {
      const template = waitlistExpiredEmail({
        parentName: parent.full_name?.split(' ')[0] || 'there',
        childName,
        className,
      })
      await sendEmail({ to: parent.email, ...template })
    }

    // Promote next person in this group
    const { data: nextEntry } = await supabase
      .from('waitlist')
      .select(NEXT_SELECT)
      .eq(GROUP_COL, entryGroupId(entry))
      .eq('status', 'waiting')
      .order('position', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (nextEntry) {
      const now = new Date()
      const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000)

      await supabase.from('waitlist').update({
        status: 'offered',
        offered_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      }).eq('id', nextEntry.id)

      await supabase.from('notifications').insert({
        user_id: nextEntry.parent_id,
        organisation_id: nextEntry.organisation_id,
        type: 'waitlist_offer',
        title: 'A spot has opened up!',
        body: 'A spot has become available in the class. You have 48 hours to confirm.',
        link: '/dashboard/waitlist',
      })

      const nextParent = nextEntry.parent as unknown as { full_name: string; email: string } | null
      const nextPlayer = nextEntry.player as unknown as { full_name?: string; first_name?: string; last_name?: string } | null
      const nextGroup = nextEntry.group as unknown as { name: string } | null

      if (nextParent?.email) {
        const template = waitlistSpotAvailableEmail({
          parentName: nextParent.full_name?.split(' ')[0] || 'there',
          childName: nextPlayer?.full_name || `${nextPlayer?.first_name || ''} ${nextPlayer?.last_name || ''}`.trim() || 'your child',
          className: nextGroup?.name || 'the class',
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
        await sendEmail({ to: nextParent.email, ...template })
      }

      promoted++
    }
  }

  return NextResponse.json({ expired, promoted, checked: (expiredEntries || []).length })
}
