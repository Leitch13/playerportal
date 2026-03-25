import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email'
import { announcementEmail } from '@/lib/email-templates'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: role } = await supabase.rpc('get_my_role')
  if (!role || !['admin', 'coach'].includes(role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { title, body, priority, groupId } = await request.json()
  const { data: orgId } = await supabase.rpc('get_my_org')

  // Get org name
  const { data: org } = await supabase
    .from('organisations')
    .select('name')
    .eq('id', orgId)
    .single()

  // Get target parents
  let parentsQuery = supabase
    .from('profiles')
    .select('full_name, email')
    .eq('organisation_id', orgId)
    .eq('role', 'parent')

  // If targeting specific group, filter to parents with children in that group
  if (groupId) {
    const { data: enrolments } = await supabase
      .from('enrolments')
      .select('player:players(parent_id)')
      .eq('training_group_id', groupId)
      .eq('status', 'active')

    const parentIds = [
      ...new Set(
        (enrolments || [])
          .map(
            (e) =>
              (e.player as unknown as { parent_id: string } | null)?.parent_id,
          )
          .filter(Boolean),
      ),
    ]

    if (parentIds.length > 0) {
      parentsQuery = parentsQuery.in('id', parentIds as string[])
    }
  }

  const { data: parents } = await parentsQuery
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  let sent = 0

  for (const parent of parents || []) {
    if (!parent.email) continue
    const template = announcementEmail({
      parentName: parent.full_name?.split(' ')[0] || 'there',
      title,
      body,
      priority: priority || 'normal',
      academyName: org?.name || 'Your Academy',
      dashboardUrl: `${appUrl}/dashboard/announcements`,
    })
    await sendEmail({ to: parent.email, ...template })
    sent++
  }

  return NextResponse.json({ sent })
}
