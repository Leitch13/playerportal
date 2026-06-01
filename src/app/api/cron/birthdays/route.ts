import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail, sendEmailBatch } from '@/lib/email'

/**
 * Daily birthday cron — runs at 8am.
 * Finds players whose birthday is today, fires:
 *   1. A celebratory email to the parent ("Happy birthday from the academy!")
 *   2. An in-app notification to coaches/admins so they can acknowledge it at the next session.
 */

export const maxDuration = 300
export const dynamic = 'force-dynamic'

function isBirthdayToday(dob: string, today: Date): boolean {
  const birthDate = new Date(dob)
  return birthDate.getMonth() === today.getMonth() && birthDate.getDate() === today.getDate()
}

function ageOn(dob: string, today: Date): number {
  const birthDate = new Date(dob)
  let age = today.getFullYear() - birthDate.getFullYear()
  const m = today.getMonth() - birthDate.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--
  return age
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

  const today = new Date()
  const monthDay = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  // Fetch players with birthdays today (filtered in Postgres for efficiency)
  const { data: players, error: playersErr } = await supabase
    .from('players')
    .select(`
      id, first_name, last_name, date_of_birth, organisation_id, parent_id,
      parent:profiles!players_parent_id_fkey(full_name, email),
      organisation:organisations!players_organisation_id_fkey(name, logo_url, contact_email)
    `)
    .not('date_of_birth', 'is', null)
    .filter('date_of_birth', 'like', `%-${monthDay}`)

  if (playersErr) {
    return NextResponse.json({ error: 'Failed to fetch players', detail: playersErr.message }, { status: 500 })
  }
  if (!players || players.length === 0) {
    return NextResponse.json({ sent: 0, message: 'No birthdays today' })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://theplayerportal.net'
  const jobs: Parameters<typeof sendEmail>[0][] = []
  let notificationsSent = 0

  for (const p of players) {
    const parent = p.parent as unknown as { full_name: string; email: string } | null
    const org = p.organisation as unknown as { name: string; logo_url: string | null; contact_email: string | null } | null
    if (!parent?.email || !p.date_of_birth) continue
    if (!isBirthdayToday(p.date_of_birth as string, today)) continue

    const turningAge = ageOn(p.date_of_birth as string, today)
    const firstName = (parent.full_name || '').split(' ')[0] || 'there'

    try {
      const { birthdayParentEmail } = await import('@/lib/email-templates')
      const template = birthdayParentEmail({
        parentName: firstName,
        childName: p.first_name as string,
        turningAge,
        academyName: org?.name || 'Your academy',
        academyLogoUrl: org?.logo_url || undefined,
        academyContactEmail: org?.contact_email || undefined,
        dashboardUrl: `${appUrl}/dashboard`,
      })
      jobs.push({ to: parent.email, ...template })
    } catch (err) {
      console.error(`Birthday email failed for player ${p.id}:`, err)
    }

    // In-app notifications to all admins and coaches of the org so they can mention it at the next session
    try {
      const { data: staff } = await supabase
        .from('profiles')
        .select('id')
        .eq('organisation_id', p.organisation_id)
        .in('role', ['admin', 'coach'])

      for (const s of staff || []) {
        await supabase.from('notifications').insert({
          user_id: s.id,
          organisation_id: p.organisation_id,
          type: 'birthday',
          title: `🎂 It's ${p.first_name}'s birthday!`,
          body: `${p.first_name} ${p.last_name} turns ${turningAge} today. Mention it at the next session — parents love the personal touch.`,
          link: `/dashboard/players/${p.id}`,
        })
        notificationsSent++
      }
    } catch (err) {
      console.error(`Birthday notifications failed for player ${p.id}:`, err)
    }
  }

  const { sent } = await sendEmailBatch(jobs)

  return NextResponse.json({
    sent,
    notifications: notificationsSent,
    birthdaysToday: players.length,
  })
}
