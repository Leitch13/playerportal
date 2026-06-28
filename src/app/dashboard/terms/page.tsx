import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TermManager from './TermManager'

export type Term = {
  id: string
  organisation_id: string
  name: string
  start_date: string
  end_date: string
  is_active: boolean
  // Phase 1B (migration 092): optional parent-facing message rendered
  // alongside term dates on public booking, class detail, parent dashboard,
  // Membership Hub, and confirmation emails. Plain text, ≤1000 chars.
  parent_message: string | null
  created_at: string
}

export type Holiday = {
  id: string
  organisation_id: string
  term_id: string
  name: string
  start_date: string
  end_date: string
  created_at: string
}

// Phase 1B: minimal shape for class assignment UI in TermManager.
export type ClassRow = {
  id: string
  name: string
  day_of_week: string | null
  time_slot: string | null
  term_id: string | null
}

export default async function TermsPage() {
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

  const { data: terms } = await supabase
    .from('terms')
    .select('*')
    .eq('organisation_id', orgId)
    .order('start_date', { ascending: true })

  const { data: holidays } = await supabase
    .from('holidays')
    .select('*')
    .eq('organisation_id', orgId)
    .order('start_date', { ascending: true })

  // Phase 1B: classes for term-assignment UI.
  const { data: classes } = await supabase
    .from('training_groups')
    .select('id, name, day_of_week, time_slot, term_id')
    .eq('organisation_id', orgId)
    .order('name', { ascending: true })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Terms &amp; Holidays</h1>
        <p className="text-sm text-white/60 mt-1">
          Manage academy term dates and holiday periods
        </p>
      </div>

      <TermManager
        orgId={orgId}
        initialTerms={(terms || []) as Term[]}
        initialHolidays={(holidays || []) as Holiday[]}
        initialClasses={(classes || []) as ClassRow[]}
        canWrite={profile.role === 'admin'}
      />
    </div>
  )
}
