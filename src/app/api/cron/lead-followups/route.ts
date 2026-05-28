import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

  const today = new Date().toISOString().split('T')[0]
  let remindersSent = 0
  let errors = 0

  // Fetch leads where follow_up_date is today or in the past and status is active
  const { data: leads, error: leadsError } = await supabase
    .from('leads')
    .select('id, first_name, last_name, follow_up_date, assigned_to, organisation_id')
    .lte('follow_up_date', today)
    .not('status', 'in', '("enrolled","lost")')

  if (leadsError) {
    return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 })
  }

  for (const lead of leads || []) {
    const leadName = [lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'Unknown'
    const dueDate = lead.follow_up_date
      ? new Date(lead.follow_up_date).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      : 'N/A'

    const notificationPayload = {
      type: 'general' as const,
      title: 'Lead follow-up due',
      body: `${leadName} — follow-up was due ${dueDate}`,
      link: '/dashboard/leads',
      organisation_id: lead.organisation_id,
    }

    if (lead.assigned_to) {
      // Notify the assigned user
      const { error: insertError } = await supabase.from('notifications').insert({
        profile_id: lead.assigned_to,
        ...notificationPayload,
      })

      if (insertError) {
        errors++
      } else {
        remindersSent++
      }
    } else {
      // Notify org admins if no one is assigned
      const { data: admins } = await supabase
        .from('profiles')
        .select('id')
        .eq('organisation_id', lead.organisation_id)
        .eq('role', 'admin')
        .limit(3)

      for (const admin of admins || []) {
        const { error: insertError } = await supabase.from('notifications').insert({
          profile_id: admin.id,
          ...notificationPayload,
        })

        if (insertError) {
          errors++
        } else {
          remindersSent++
        }
      }
    }
  }

  return NextResponse.json({
    remindersSent,
    errors,
    leadsChecked: (leads || []).length,
  })
}
