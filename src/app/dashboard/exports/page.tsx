import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ExportCard from './ExportCard'

export default async function ExportsPage() {
  const supabase = await createClient()
  const { data: role } = await supabase.rpc('get_my_role')
  if (role !== 'admin') redirect('/dashboard')

  const { data: orgId } = await supabase.rpc('get_my_org')

  // Get counts for each export type
  const [players, attendance, payments, parents, enrolments, trials] = await Promise.all([
    supabase.from('players').select('*', { count: 'exact', head: true }).eq('organisation_id', orgId),
    supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('organisation_id', orgId),
    supabase.from('payments').select('*', { count: 'exact', head: true }).eq('organisation_id', orgId),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('organisation_id', orgId).eq('role', 'parent'),
    supabase.from('enrolments').select('*', { count: 'exact', head: true }),
    supabase.from('trial_bookings').select('*', { count: 'exact', head: true }).eq('organisation_id', orgId),
  ])

  const exports = [
    { type: 'players', title: 'Players', description: 'All player data including name, DOB, groups', icon: '⚽', count: players.count || 0, hasDateFilter: false },
    { type: 'attendance', title: 'Attendance', description: 'Attendance records with dates and statuses', icon: '✅', count: attendance.count || 0, hasDateFilter: true },
    { type: 'payments', title: 'Payments', description: 'Payment history with amounts and statuses', icon: '💳', count: payments.count || 0, hasDateFilter: true },
    { type: 'parents', title: 'Parents', description: 'Parent profiles with contact details', icon: '👨‍👩‍👦', count: parents.count || 0, hasDateFilter: false },
    { type: 'enrolments', title: 'Enrolments', description: 'Current class enrolments', icon: '📋', count: enrolments.count || 0, hasDateFilter: false },
    { type: 'trials', title: 'Trial Bookings', description: 'Free trial booking requests', icon: '🎯', count: trials.count || 0, hasDateFilter: true },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Export Data</h1>
        <p className="text-text-light text-sm mt-1">Download your academy data as CSV files</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {exports.map(exp => (
          <ExportCard key={exp.type} {...exp} />
        ))}
      </div>
    </div>
  )
}
