import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Tabs from './Tabs'

// 1-2-1 Slots · academy pages. Admin only. Same tab set for every academy;
// the pages are simply empty until the academy adds a coach with hours.
export default async function OneToOneLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') notFound()

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">1-2-1s</h1>
          <p className="mt-1 text-sm text-white/55">Regulars keep their slot and it rolls on. Free time goes on sale. Anything that needs you lands here.</p>
        </div>
      </div>
      <Tabs />
      {children}
    </div>
  )
}
