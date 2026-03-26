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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text">Terms &amp; Holidays</h1>
        <p className="text-sm text-text-light mt-1">
          Manage academy term dates and holiday periods
        </p>
      </div>

      <TermManager
        orgId={orgId}
        initialTerms={(terms || []) as Term[]}
        initialHolidays={(holidays || []) as Holiday[]}
      />
    </div>
  )
}
