import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail, sendEmailBatch } from '@/lib/email'
import { waitlistExpiredEmail, waitlistSpotAvailableEmail } from '@/lib/email-templates'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

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
    .select(`
      id, training_group_id, parent_id, organisation_id,
      player:players(id, full_name, first_name, last_name),
      parent:profiles!waitlist_parent_id_fkey(full_name, email),
      group:training_groups!waitlist_training_group_id_fkey(id, name)
    `)
    .eq('status', 'offered')
    .lt('expires_at', new Date().toISOString())

  let expired = 0
  let promoted = 0
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://theplayerportal.net'
  const jobs: Parameters<typeof sendEmail>[0][] = []

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
      jobs.push({ to: parent.email, ...template })
    }

    // Promote next person in this group
    const { data: nextEntry } = await supabase
      .from('waitlist')
      .select(`
        id, parent_id, organisation_id,
        player:players(id, full_name, first_name, last_name),
        parent:profiles!waitlist_parent_id_fkey(full_name, email),
        group:training_groups!waitlist_training_group_id_fkey(id, name)
      `)
      .eq('training_group_id', entry.training_group_id)
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
        jobs.push({ to: nextParent.email, ...template })
      }

      promoted++
    }
  }

  await sendEmailBatch(jobs)

  return NextResponse.json({ expired, promoted, checked: (expiredEntries || []).length })
}
