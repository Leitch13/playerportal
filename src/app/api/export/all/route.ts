import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify admin role
    const { data: role } = await supabase.rpc('get_my_role')
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get user's organisation
    const { data: profile } = await supabase
      .from('profiles')
      .select('organisation_id')
      .eq('id', user.id)
      .single()

    if (!profile?.organisation_id) {
      return NextResponse.json({ error: 'No organisation' }, { status: 404 })
    }

    const orgId = profile.organisation_id

    // Fetch all org data in parallel
    const [
      { data: players },
      { data: enrolments },
      { data: profiles },
      { data: trainingGroups },
      { data: attendance },
      { data: payments },
      { data: reviews },
    ] = await Promise.all([
      supabase.from('players').select('*').eq('organisation_id', orgId),
      supabase.from('enrolments').select('*').eq('organisation_id', orgId),
      supabase.from('profiles').select('*').eq('organisation_id', orgId),
      supabase.from('training_groups').select('*').eq('organisation_id', orgId),
      supabase.from('attendance').select('*').eq('organisation_id', orgId),
      supabase.from('payments').select('*').eq('organisation_id', orgId),
      supabase.from('progress_reviews').select('*').eq('organisation_id', orgId),
    ])

    const exportData = {
      exported_at: new Date().toISOString(),
      organisation_id: orgId,
      players: players || [],
      enrolments: enrolments || [],
      profiles: profiles || [],
      training_groups: trainingGroups || [],
      attendance: attendance || [],
      payments: payments || [],
      reviews: reviews || [],
    }

    const today = new Date().toISOString().split('T')[0]
    const filename = `playerportal-backup-${today}.json`

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch {
    return NextResponse.json(
      { error: 'Failed to export data' },
      { status: 500 }
    )
  }
}
