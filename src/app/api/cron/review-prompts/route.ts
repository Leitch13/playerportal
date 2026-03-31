import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'
import { reviewPromptEmail } from '@/lib/email-templates'

export const dynamic = 'force-dynamic'

const SESSION_THRESHOLD = 10

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://playerportal.app'

  // Step 1: Find all players with 10+ present attendance records
  // We use a raw query to count attendance per player
  const { data: attendanceCounts, error: attError } = await supabase
    .from('attendance')
    .select('player_id')
    .eq('present', true)

  if (attError) {
    console.error('[REVIEW CRON] Error fetching attendance:', attError)
    return NextResponse.json({ error: 'Failed to fetch attendance' }, { status: 500 })
  }

  // Count sessions per player
  const countByPlayer = new Map<string, number>()
  for (const a of attendanceCounts || []) {
    countByPlayer.set(a.player_id, (countByPlayer.get(a.player_id) || 0) + 1)
  }

  // Filter to players with threshold+ sessions
  const eligiblePlayerIds = Array.from(countByPlayer.entries())
    .filter(([, count]) => count >= SESSION_THRESHOLD)
    .map(([id]) => id)

  if (eligiblePlayerIds.length === 0) {
    return NextResponse.json({ message: 'No eligible players', created: 0, emailsSent: 0 })
  }

  // Step 2: Get player details with parent info
  const { data: players } = await supabase
    .from('players')
    .select('id, first_name, last_name, parent_id, organisation_id, parent:profiles!players_parent_id_fkey(id, full_name, email)')
    .in('id', eligiblePlayerIds)

  if (!players || players.length === 0) {
    return NextResponse.json({ message: 'No players found', created: 0, emailsSent: 0 })
  }

  // Step 3: Get existing review prompts to avoid duplicates
  const { data: existingPrompts } = await supabase
    .from('review_prompts')
    .select('player_id, profile_id')
    .in('player_id', eligiblePlayerIds)

  const existingSet = new Set(
    (existingPrompts || []).map((p) => `${p.profile_id}:${p.player_id}`)
  )

  // Step 4: Get org names for emails
  const orgIds = [...new Set(players.map((p) => p.organisation_id).filter(Boolean))]
  const { data: orgs } = await supabase
    .from('organisations')
    .select('id, name')
    .in('id', orgIds)

  const orgMap = new Map((orgs || []).map((o) => [o.id, o.name]))

  let created = 0
  let emailsSent = 0
  let errors = 0

  for (const player of players) {
    const parent = player.parent as unknown as { id: string; full_name: string; email: string } | null
    if (!parent?.id || !parent?.email) continue

    const key = `${parent.id}:${player.id}`
    if (existingSet.has(key)) continue

    // Create review prompt
    const { error: insertError } = await supabase.from('review_prompts').insert({
      profile_id: parent.id,
      organisation_id: player.organisation_id,
      player_id: player.id,
      status: 'pending',
    })

    if (insertError) {
      console.error(`[REVIEW CRON] Error creating prompt for player ${player.id}:`, insertError)
      errors++
      continue
    }

    created++
    existingSet.add(key) // prevent duplicates in same run

    // Send email
    const academyName = orgMap.get(player.organisation_id) || 'your academy'
    const sessionCount = countByPlayer.get(player.id) || SESSION_THRESHOLD
    const parentName = parent.full_name?.split(' ')[0] || 'there'

    const { subject, html } = reviewPromptEmail({
      parentName,
      childName: player.first_name,
      academyName,
      sessionCount,
      dashboardUrl: `${appUrl}/dashboard`,
    })

    const result = await sendEmail({ to: parent.email, subject, html })
    if (result.success) {
      emailsSent++
    } else {
      errors++
      console.error(`[REVIEW CRON] Email failed for ${parent.email}:`, result.error)
    }
  }

  console.log(`[REVIEW CRON] Created: ${created}, Emails: ${emailsSent}, Errors: ${errors}`)

  return NextResponse.json({
    message: 'Review prompts processed',
    created,
    emailsSent,
    errors,
  })
}
