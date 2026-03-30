import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import SessionPlanView from './SessionPlanView'

export default async function SessionPlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')

  const { data: plan } = await supabase
    .from('session_plans')
    .select('*, group:training_groups(name)')
    .eq('id', id)
    .single()

  if (!plan) redirect('/dashboard/session-plans')

  const { data: org } = await supabase
    .from('organisations')
    .select('name, logo_url')
    .eq('id', plan.organisation_id)
    .single()

  return (
    <div className="bg-[#0a0a0a] -m-6 lg:-m-8 p-4 sm:p-6 lg:p-8 min-h-screen text-white">
      <div className="no-print flex items-center justify-between mb-6">
        <Link href="/dashboard/session-plans" className="text-white/40 hover:text-white text-sm">&larr; Back to Plans</Link>
      </div>

      <SessionPlanView plan={plan} orgName={org?.name || ''} orgLogo={org?.logo_url || ''} />
    </div>
  )
}
