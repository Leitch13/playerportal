import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Card from '@/components/Card'
import EmptyState from '@/components/EmptyState'
import StatusBadge from '@/components/StatusBadge'
import CampForm from './CampForm'

type Camp = {
  id: string
  organisation_id: string
  name: string
  description: string | null
  start_date: string
  end_date: string
  daily_start_time: string | null
  daily_end_time: string | null
  location: string | null
  age_group: string | null
  price: number | null
  max_capacity: number | null
  image_url: string | null
  what_to_bring: string | null
  schedule: unknown
  is_published: boolean
  created_at: string
}

function getCampStatus(camp: Camp): string {
  const today = new Date().toISOString().split('T')[0]
  if (camp.end_date < today) return 'past'
  if (camp.start_date <= today && camp.end_date >= today) return 'ongoing'
  return 'upcoming'
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  return `${s.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} - ${e.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
}

export default async function CampsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, organisation_id')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'coach'].includes(profile.role)) {
    redirect('/dashboard')
  }

  const orgId = profile.organisation_id || ''

  const { data: camps } = await supabase
    .from('camps')
    .select('*')
    .eq('organisation_id', orgId)
    .order('start_date', { ascending: false })

  const allCamps = (camps || []) as Camp[]

  // Get training groups for the form
  const { data: groups } = await supabase
    .from('training_groups')
    .select('id, name')
    .eq('organisation_id', orgId)
    .order('name')

  const trainingGroups = (groups || []) as { id: string; name: string }[]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Camps</h1>
          <p className="text-sm text-white/60 mt-1">
            Manage holiday camps and multi-day sessions
          </p>
        </div>
      </div>

      <Card
        title="All Camps"
        action={
          <CampForm orgId={orgId} trainingGroups={trainingGroups} />
        }
      >
        {allCamps.length === 0 ? (
          <EmptyState message="No camps created yet. Click 'Create Camp' to get started." />
        ) : (
          <div className="overflow-x-auto -mx-6 -mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.08] text-left text-white/60">
                  <th className="px-6 py-3 font-medium">Camp</th>
                  <th className="px-6 py-3 font-medium">Dates</th>
                  <th className="px-6 py-3 font-medium">Age Group</th>
                  <th className="px-6 py-3 font-medium">Price</th>
                  <th className="px-6 py-3 font-medium">Capacity</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Published</th>
                </tr>
              </thead>
              <tbody>
                {allCamps.map((camp) => {
                  const status = getCampStatus(camp)
                  return (
                    <tr key={camp.id} className="border-b border-white/[0.08] last:border-0 hover:bg-white/[0.03]">
                      <td className="px-6 py-4">
                        <div className="font-medium text-white">{camp.name}</div>
                        {camp.location && (
                          <div className="text-xs text-white/60 mt-0.5">{camp.location}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-white/60">
                        {formatDateRange(camp.start_date, camp.end_date)}
                      </td>
                      <td className="px-6 py-4 text-white/60">{camp.age_group || '-'}</td>
                      <td className="px-6 py-4 text-white/60">
                        {camp.price != null ? `\u00A3${Number(camp.price).toFixed(0)}` : '-'}
                      </td>
                      <td className="px-6 py-4 text-white/60">
                        {camp.max_capacity || '-'}
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={status} />
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-block w-2 h-2 rounded-full ${camp.is_published ? 'bg-green-500' : 'bg-white/20'}`} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
