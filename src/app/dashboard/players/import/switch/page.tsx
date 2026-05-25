'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import Link from 'next/link'
import MigrateForm from './MigrateForm'

export default function SwitchFromClassForKidsPage() {
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    async function checkAuth() {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/auth/signin'; return }
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      if (!profile || profile.role !== 'admin') { window.location.href = '/dashboard'; return }
      setAuthorized(true)
      setLoading(false)
    }
    checkAuth()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-6 h-6 border-2 border-[#4ecde6] border-t-transparent rounded-full" />
      </div>
    )
  }
  if (!authorized) return null

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

      <div className="bg-[#141414] rounded-xl border border-[#1e1e1e] p-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          How to export your data from ClassForKids
        </h2>
        <div className="space-y-4">
          {[
            { step: 1, title: 'Log into ClassForKids', desc: 'Go to your ClassForKids admin dashboard' },
            { step: 2, title: 'Navigate to Reports', desc: 'Go to Reports \u2192 Export Data \u2192 Download CSV' },
            { step: 3, title: 'Download your CSV files', desc: 'Export your Children/Players list, Parents list, and Classes list as CSV files' },
            { step: 4, title: 'Upload below', desc: 'Drop your CSV files into the uploader and we will handle the rest' },
          ].map(({ step, title, desc }) => (
            <div key={step} className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#4ecde6]/10 border border-[#4ecde6]/20 flex items-center justify-center text-sm font-bold text-[#4ecde6]">
                {step}
              </div>
              <div>
                <p className="text-white font-medium">{title}</p>
                <p className="text-sm text-[#888] mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <MigrateForm />
    </div>
  )
}
