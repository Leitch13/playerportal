import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { toCSV } from '@/lib/csv'
import { loadOneToOneMoney, STATUS_LABEL } from '@/lib/one-to-one/money-report'
import { adminClient } from '@/lib/one-to-one/db'

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
      // One row per child per class they're in now, with the class's day, time and venue, so two
      // classes with the same name (No.1's Pitreavie 17:00 and 18:00) can be told apart (5 Nov 2026).
      const { data } = await supabase
        .from('players')
        .select('full_name, first_name, last_name, date_of_birth, medical_info, created_at, enrolments(status, group:training_groups(name, day_of_week, time_slot, location))')
        .eq('organisation_id', orgId)
        .order('created_at', { ascending: false })

      headers = ['Name', 'Date of Birth', 'Medical Info', 'Class', 'Day', 'Time', 'Venue', 'Joined']
      rows = (data || []).flatMap(p => {
        const r = p as Record<string, unknown>
        const name = r.full_name as string || `${r.first_name || ''} ${r.last_name || ''}`.trim()
        const base = [name, r.date_of_birth as string || '', r.medical_info as string || '']
        const joined = new Date(r.created_at as string).toLocaleDateString('en-GB')
        const enrols = (r.enrolments as Array<{ status: string | null; group: { name: string; day_of_week: string | null; time_slot: string | null; location: string | null } | null }> | null) || []
        const live = enrols.filter((e) => e.group && ['active', 'pending'].includes(e.status || 'active'))
        if (!live.length) return [[...base, '', '', '', '', joined]]
        return live.map((e) => [...base, e.group!.name, e.group!.day_of_week || '', e.group!.time_slot || '', e.group!.location || '', joined])
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

    // 1-2-1 money isn't in `payments` (No.1, 19 Oct 2026). Admin and org checked above.
    case 'one-to-ones': {
      const all = orgId ? await loadOneToOneMoney(adminClient(), orgId as string) : []
      const data = all.filter((r) => (!from || r.date >= from) && (!to || r.date <= to))
      headers = ['Date', 'Parent', 'Email', 'Child', 'What', 'Amount', 'Status']
      rows = data.map((r) => [
        new Date(`${r.date}T12:00:00Z`).toLocaleDateString('en-GB'), r.parentName, r.email || '', r.children, r.what,
        `£${(r.amountPence / 100).toFixed(2)}`, STATUS_LABEL[r.status],
      ])
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
        .select('created_at, status, player:players(full_name, first_name, last_name), group:training_groups(name, day_of_week, time_slot, location)')

      headers = ['Player', 'Class', 'Day', 'Time', 'Venue', 'Status', 'Enrolled Date']
      rows = (data || []).map(e => {
        const player = e.player as unknown as { full_name?: string; first_name?: string; last_name?: string } | null
        const group = e.group as unknown as { name: string; day_of_week: string | null; time_slot: string | null; location: string | null } | null
        const name = player?.full_name || `${player?.first_name || ''} ${player?.last_name || ''}`.trim()
        return [
          name,
          group?.name || '',
          group?.day_of_week || '',
          group?.time_slot || '',
          group?.location || '',
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
