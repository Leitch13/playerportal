import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { toCSV } from '@/lib/csv'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const { type } = await params
  const supabase = await createClient()

  const { data: role } = await supabase.rpc('get_my_role')
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { data: orgId } = await supabase.rpc('get_my_org')
  const searchParams = request.nextUrl.searchParams
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  let headers: string[] = []
  let rows: string[][] = []

  switch (type) {
    case 'players': {
      const { data } = await supabase
        .from('players')
        .select('full_name, first_name, last_name, date_of_birth, medical_info, created_at, enrolments(group:training_groups(name))')
        .eq('organisation_id', orgId)
        .order('created_at', { ascending: false })

      headers = ['Name', 'Date of Birth', 'Medical Info', 'Group', 'Joined']
      rows = (data || []).map(p => {
        const name = (p as Record<string, unknown>).full_name as string ||
          `${(p as Record<string, unknown>).first_name || ''} ${(p as Record<string, unknown>).last_name || ''}`.trim()
        const enrols = (p as Record<string, unknown>).enrolments as Array<{ group: { name: string } | null }> | null
        return [
          name,
          (p as Record<string, unknown>).date_of_birth as string || '',
          (p as Record<string, unknown>).medical_info as string || '',
          enrols?.[0]?.group?.name || '',
          new Date((p as Record<string, unknown>).created_at as string).toLocaleDateString('en-GB'),
        ]
      })
      break
    }

    case 'attendance': {
      let query = supabase
        .from('attendance')
        .select('session_date, status, player:players(full_name, first_name, last_name), group:training_groups(name)')
        .eq('organisation_id', orgId)
        .order('session_date', { ascending: false })

      if (from) query = query.gte('session_date', from)
      if (to) query = query.lte('session_date', to)

      const { data } = await query

      headers = ['Date', 'Player', 'Group', 'Status']
      rows = (data || []).map(a => {
        const player = a.player as unknown as { full_name?: string; first_name?: string; last_name?: string } | null
        const group = a.group as unknown as { name: string } | null
        const name = player?.full_name || `${player?.first_name || ''} ${player?.last_name || ''}`.trim()
        return [
          new Date(a.session_date).toLocaleDateString('en-GB'),
          name,
          group?.name || '',
          a.status,
        ]
      })
      break
    }

    case 'payments': {
      let query = supabase
        .from('payments')
        .select('amount, status, created_at, profile:profiles(full_name, email)')
        .eq('organisation_id', orgId)
        .order('created_at', { ascending: false })

      if (from) query = query.gte('created_at', from)
      if (to) query = query.lte('created_at', to)

      const { data } = await query

      headers = ['Date', 'Parent', 'Email', 'Amount', 'Status']
      rows = (data || []).map(p => {
        const profile = p.profile as unknown as { full_name: string; email: string } | null
        return [
          new Date(p.created_at).toLocaleDateString('en-GB'),
          profile?.full_name || '',
          profile?.email || '',
          `£${Number(p.amount).toFixed(2)}`,
          p.status,
        ]
      })
      break
    }

    case 'parents': {
      const { data } = await supabase
        .from('profiles')
        .select('full_name, email, phone, created_at')
        .eq('organisation_id', orgId)
        .eq('role', 'parent')
        .order('created_at', { ascending: false })

      headers = ['Name', 'Email', 'Phone', 'Joined']
      rows = (data || []).map(p => [
        p.full_name || '',
        p.email || '',
        p.phone || '',
        new Date(p.created_at).toLocaleDateString('en-GB'),
      ])
      break
    }

    case 'enrolments': {
      const { data } = await supabase
        .from('enrolments')
        .select('created_at, status, player:players(full_name, first_name, last_name), group:training_groups(name)')

      headers = ['Player', 'Group', 'Status', 'Enrolled Date']
      rows = (data || []).map(e => {
        const player = e.player as unknown as { full_name?: string; first_name?: string; last_name?: string } | null
        const group = e.group as unknown as { name: string } | null
        const name = player?.full_name || `${player?.first_name || ''} ${player?.last_name || ''}`.trim()
        return [
          name,
          group?.name || '',
          e.status || 'active',
          new Date(e.created_at).toLocaleDateString('en-GB'),
        ]
      })
      break
    }

    case 'trials': {
      let query = supabase
        .from('trial_bookings')
        .select('parent_name, parent_email, parent_phone, child_name, child_age, preferred_date, status, created_at, group:training_groups(name)')
        .eq('organisation_id', orgId)
        .order('created_at', { ascending: false })

      if (from) query = query.gte('created_at', from)
      if (to) query = query.lte('created_at', to)

      const { data } = await query

      headers = ['Child', 'Age', 'Parent', 'Email', 'Phone', 'Class', 'Preferred Date', 'Status', 'Requested']
      rows = (data || []).map(t => {
        const group = t.group as unknown as { name: string } | null
        return [
          t.child_name,
          t.child_age?.toString() || '',
          t.parent_name,
          t.parent_email,
          t.parent_phone || '',
          group?.name || 'Any',
          t.preferred_date ? new Date(t.preferred_date).toLocaleDateString('en-GB') : '',
          t.status,
          new Date(t.created_at).toLocaleDateString('en-GB'),
        ]
      })
      break
    }

    default:
      return NextResponse.json({ error: 'Unknown export type' }, { status: 400 })
  }

  const csv = toCSV(headers, rows)

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${type}-export-${new Date().toISOString().split('T')[0]}.csv"`,
    },
  })
}
