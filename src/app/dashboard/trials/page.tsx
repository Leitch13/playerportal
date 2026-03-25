import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TrialManager from './TrialManager'

export default async function TrialsPage() {
  const supabase = await createClient()
  const { data: role } = await supabase.rpc('get_my_role')
  if (!role || !['admin', 'coach'].includes(role)) redirect('/dashboard')

  const { data: orgId } = await supabase.rpc('get_my_org')

  const { data: trials } = await supabase
    .from('trial_bookings')
    .select('*, group:training_groups(name)')
    .eq('organisation_id', orgId)
    .order('created_at', { ascending: false })

  const stats = {
    pending: (trials || []).filter(t => t.status === 'pending').length,
    confirmed: (trials || []).filter(t => t.status === 'confirmed').length,
    attended: (trials || []).filter(t => t.status === 'attended').length,
    total: (trials || []).length,
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Trial Bookings</h1>
        <p className="text-text-light text-sm mt-1">Manage free trial requests from new families</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-border p-4 text-center">
          <p className="text-2xl font-bold text-yellow-500">{stats.pending}</p>
          <p className="text-xs text-text-light font-medium">Pending</p>
        </div>
        <div className="bg-white rounded-xl border border-border p-4 text-center">
          <p className="text-2xl font-bold text-blue-500">{stats.confirmed}</p>
          <p className="text-xs text-text-light font-medium">Confirmed</p>
        </div>
        <div className="bg-white rounded-xl border border-border p-4 text-center">
          <p className="text-2xl font-bold text-emerald-500">{stats.attended}</p>
          <p className="text-xs text-text-light font-medium">Attended</p>
        </div>
        <div className="bg-white rounded-xl border border-border p-4 text-center">
          <p className="text-2xl font-bold">{stats.total}</p>
          <p className="text-xs text-text-light font-medium">Total</p>
        </div>
      </div>

      <TrialManager trials={(trials || []).map(t => ({
        id: t.id,
        parentName: t.parent_name,
        parentEmail: t.parent_email,
        parentPhone: t.parent_phone,
        childName: t.child_name,
        childAge: t.child_age,
        groupName: (t.group as unknown as { name: string } | null)?.name || null,
        preferredDate: t.preferred_date,
        notes: t.notes,
        status: t.status,
        createdAt: t.created_at,
      }))} />
    </div>
  )
}
