'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ExportCSV() {
  const [loading, setLoading] = useState(false)

  async function handleExport() {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: players } = await supabase
        .from('players')
        .select(`
          first_name, last_name, age_group,
          parent:profiles!players_parent_id_fkey(full_name, email, phone),
          enrolments(status, group:training_groups(name))
        `)
        .order('first_name')

      if (!players || players.length === 0) {
        alert('No players to export.')
        return
      }

      const headers = ['First Name', 'Last Name', 'Age Group', 'Parent Name', 'Parent Email', 'Parent Phone', 'Group Name']

      const rows = players.map((p) => {
        const parent = p.parent as unknown as { full_name: string; email: string; phone: string } | null
        const groups = (p.enrolments as unknown as Array<{ status: string; group: { name: string } | null }>)
          ?.filter((e) => e.status === 'active')
          .map((e) => e.group?.name)
          .filter(Boolean)
          .join('; ') || ''

        return [
          p.first_name || '',
          p.last_name || '',
          p.age_group || '',
          parent?.full_name || '',
          parent?.email || '',
          parent?.phone || '',
          groups,
        ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')
      })

      const csv = [headers.join(','), ...rows].join('\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const date = new Date().toISOString().split('T')[0]
      a.href = url
      a.download = `players-export-${date}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export failed:', err)
      alert('Export failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="inline-flex items-center gap-2 px-4 py-2 border border-white/[0.08] rounded-lg text-sm font-medium hover:bg-white/[0.05] transition-colors disabled:opacity-50"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      </svg>
      {loading ? 'Exporting...' : 'Export CSV'}
    </button>
  )
}
