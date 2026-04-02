import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import MigrateForm from './MigrateForm'

export default async function MigrateFromClassForKidsPage() {
  let userRole = 'parent'
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) redirect('/auth/signin')

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    userRole = profile?.role || 'parent'
  } catch {
    redirect('/auth/signin')
  }
  if (userRole !== 'admin') redirect('/dashboard')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Switch from ClassForKids</h1>
          <p className="text-[#888] mt-1">
            Import all your players, parents, and class data in minutes
          </p>
        </div>
        <Link
          href="/dashboard/players/import"
          className="text-sm text-[#888] hover:text-white transition-colors"
        >
          Back to Import
        </Link>
      </div>

      {/* How to export from ClassForKids */}
      <div className="bg-[#141414] rounded-xl border border-[#1e1e1e] p-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          How to export your data from ClassForKids
        </h2>
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#4ecde6]/10 border border-[#4ecde6]/20 flex items-center justify-center text-sm font-bold text-[#4ecde6]">
              1
            </div>
            <div>
              <p className="text-white font-medium">Log into ClassForKids</p>
              <p className="text-sm text-[#888] mt-0.5">
                Go to your ClassForKids admin dashboard
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#4ecde6]/10 border border-[#4ecde6]/20 flex items-center justify-center text-sm font-bold text-[#4ecde6]">
              2
            </div>
            <div>
              <p className="text-white font-medium">Navigate to Reports</p>
              <p className="text-sm text-[#888] mt-0.5">
                Go to Reports &rarr; Export Data &rarr; Download CSV
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#4ecde6]/10 border border-[#4ecde6]/20 flex items-center justify-center text-sm font-bold text-[#4ecde6]">
              3
            </div>
            <div>
              <p className="text-white font-medium">Download your CSV files</p>
              <p className="text-sm text-[#888] mt-0.5">
                Export your Children/Players list, Parents list, and Classes list as CSV files
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#4ecde6]/10 border border-[#4ecde6]/20 flex items-center justify-center text-sm font-bold text-[#4ecde6]">
              4
            </div>
            <div>
              <p className="text-white font-medium">Upload below</p>
              <p className="text-sm text-[#888] mt-0.5">
                Drop your CSV files into the uploader and we will handle the rest
              </p>
            </div>
          </div>
        </div>
      </div>

      <MigrateForm />
    </div>
  )
}
