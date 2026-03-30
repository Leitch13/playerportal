import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import ImportForm from './ImportForm'

export default async function ImportPlayersPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')

  const { data: role } = await supabase.rpc('get_my_role')
  if (role !== 'admin') redirect('/dashboard')

  return (
    <div className="bg-[#0a0a0a] -m-6 lg:-m-8 p-4 sm:p-6 lg:p-8 min-h-screen text-white space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Import Players</h1>
          <p className="text-white/40 mt-1">
            Upload a CSV file to bulk import players into your organisation.
          </p>
        </div>
        <Link
          href="/dashboard/players"
          className="text-sm text-white/40 hover:text-white"
        >
          Back to Players
        </Link>
      </div>

      {/* ClassForKids migration banner */}
      <Link
        href="/dashboard/players/import/migrate"
        className="block bg-gradient-to-r from-[#4ecde6]/10 to-[#4ecde6]/5 border border-[#4ecde6]/20 rounded-xl p-5 hover:border-[#4ecde6]/40 transition-colors group"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-[#4ecde6]/10 border border-[#4ecde6]/20 rounded-xl flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4ecde6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <line x1="9" y1="15" x2="15" y2="15" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Switching from ClassForKids?</p>
              <p className="text-xs text-[#888] mt-0.5">
                Import all your players, parents, and class data automatically
              </p>
            </div>
          </div>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4ecde6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      </Link>

      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-sm text-blue-400">
        <strong>CSV Format:</strong> Your file should include columns for{' '}
        <code className="bg-blue-500/15 px-1 rounded">first_name</code>,{' '}
        <code className="bg-blue-500/15 px-1 rounded">last_name</code> (required), and optionally{' '}
        <code className="bg-blue-500/15 px-1 rounded">date_of_birth</code> (DD/MM/YYYY),{' '}
        <code className="bg-blue-500/15 px-1 rounded">age_group</code>,{' '}
        <code className="bg-blue-500/15 px-1 rounded">parent_email</code>,{' '}
        <code className="bg-blue-500/15 px-1 rounded">parent_name</code>,{' '}
        <code className="bg-blue-500/15 px-1 rounded">parent_phone</code>,{' '}
        <code className="bg-blue-500/15 px-1 rounded">group_name</code>,{' '}
        <code className="bg-blue-500/15 px-1 rounded">medical_info</code>.
      </div>

      <ImportForm />
    </div>
  )
}
