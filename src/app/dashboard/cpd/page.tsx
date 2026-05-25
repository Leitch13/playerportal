import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireFeature } from '@/lib/features'
import type { UserRole } from '@/lib/types'
import CoachCPD from './CoachCPD'

export default async function CPDPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')
  await requireFeature('cpd_compliance')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, organisation_id, full_name')
    .eq('id', user.id)
    .single()

  const role = (profile?.role || 'parent') as UserRole
  const isStaff = role === 'admin' || role === 'coach'
  if (!isStaff) redirect('/dashboard')

  const orgId = profile?.organisation_id || ''

  // Fetch certifications
  let certs: Record<string, unknown>[] = []
  let cpdHours: Record<string, unknown>[] = []

  if (role === 'coach') {
    const { data: c } = await supabase
      .from('coach_certifications')
      .select('*')
      .eq('profile_id', user.id)
      .order('expiry_date', { ascending: true })
    certs = c || []

    const { data: h } = await supabase
      .from('cpd_hours')
      .select('*')
      .eq('profile_id', user.id)
      .order('date', { ascending: false })
    cpdHours = h || []
  }

  // Admin: fetch all coaches' data
  let allCoaches: Record<string, unknown>[] = []
  if (role === 'admin' && orgId) {
    const { data: coaches } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('organisation_id', orgId)
      .eq('role', 'coach')
      .order('full_name')

    const coachIds = (coaches || []).map((c: Record<string, unknown>) => c.id as string)

    let allCerts: Record<string, unknown>[] = []
    let allCpd: Record<string, unknown>[] = []

    if (coachIds.length > 0) {
      const { data: ac } = await supabase
        .from('coach_certifications')
        .select('*')
        .in('profile_id', coachIds)
      allCerts = ac || []

      const { data: ah } = await supabase
        .from('cpd_hours')
        .select('*')
        .in('profile_id', coachIds)
      allCpd = ah || []
    }

    const now = new Date()
    const yearStart = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0]

    allCoaches = (coaches || []).map((coach: Record<string, unknown>) => {
      const coachCerts = allCerts.filter((c: Record<string, unknown>) => c.profile_id === coach.id)
      const expiredCount = coachCerts.filter((c: Record<string, unknown>) => {
        if (!c.expiry_date) return false
        return new Date(c.expiry_date as string) < now
      }).length
      const expiringCount = coachCerts.filter((c: Record<string, unknown>) => {
        if (!c.expiry_date) return false
        const exp = new Date(c.expiry_date as string)
        const diff = (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        return diff >= 0 && diff <= 30
      }).length
      const coachCpd = allCpd.filter(
        (h: Record<string, unknown>) =>
          h.profile_id === coach.id && (h.date as string) >= yearStart
      )
      const totalHours = coachCpd.reduce(
        (sum: number, h: Record<string, unknown>) => sum + Number(h.hours || 0),
        0
      )
      return {
        ...coach,
        certsCount: coachCerts.length,
        expiredCount,
        expiringCount,
        cpdHoursThisYear: totalHours,
      }
    })
  }

  return (
    <CoachCPD
      role={role}
      userId={user.id}
      orgId={orgId}
      certifications={certs}
      cpdHours={cpdHours}
      allCoaches={allCoaches}
    />
  )
}
