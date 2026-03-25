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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Import Players</h1>
          <p className="text-text-light mt-1">
            Upload a CSV file to bulk import players into your organisation.
          </p>
        </div>
        <Link
          href="/dashboard/players"
          className="text-sm text-text-light hover:text-text"
        >
          Back to Players
        </Link>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
        <strong>CSV Format:</strong> Your file should include columns for{' '}
        <code className="bg-blue-100 px-1 rounded">first_name</code>,{' '}
        <code className="bg-blue-100 px-1 rounded">last_name</code> (required), and optionally{' '}
        <code className="bg-blue-100 px-1 rounded">date_of_birth</code> (DD/MM/YYYY),{' '}
        <code className="bg-blue-100 px-1 rounded">age_group</code>,{' '}
        <code className="bg-blue-100 px-1 rounded">parent_email</code>,{' '}
        <code className="bg-blue-100 px-1 rounded">parent_name</code>,{' '}
        <code className="bg-blue-100 px-1 rounded">parent_phone</code>,{' '}
        <code className="bg-blue-100 px-1 rounded">group_name</code>,{' '}
        <code className="bg-blue-100 px-1 rounded">medical_info</code>.
      </div>

      <ImportForm />
    </div>
  )
}
