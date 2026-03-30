'use client'

import { Fragment, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type AuditEntry = {
  id: string
  action: string
  entity_type: string
  entity_id: string | null
  details: Record<string, unknown>
  created_at: string
  user_name: string
}

function getActionColor(action: string): string {
  if (action.includes('created')) return 'bg-green-500/15 text-green-400'
  if (action.includes('updated')) return 'bg-blue-500/15 text-blue-400'
  if (action.includes('deleted') || action.includes('cancelled') || action.includes('removed'))
    return 'bg-red-500/15 text-red-400'
  if (action.includes('sent')) return 'bg-purple-500/15 text-purple-400'
  if (action.includes('downloaded')) return 'bg-amber-500/15 text-amber-400'
  return 'bg-white/[0.06] text-white/60'
}

function relativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = now - then
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

export default function AuditTable({
  entries: initialEntries,
  pageSize,
  orgId,
  actionFilter,
  search,
  dateFrom,
  dateTo,
}: {
  entries: AuditEntry[]
  pageSize: number
  orgId: string
  actionFilter: string
  search: string
  dateFrom: string
  dateTo: string
}) {
  const [entries, setEntries] = useState<AuditEntry[]>(initialEntries)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(initialEntries.length >= pageSize)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  async function loadMore() {
    if (loading) return
    setLoading(true)

    try {
      const supabase = createClient()
      let query = supabase
        .from('audit_log')
        .select('id, action, entity_type, entity_id, details, created_at, user_id, profiles!audit_log_user_id_fkey(full_name, email)')
        .eq('organisation_id', orgId)
        .order('created_at', { ascending: false })
        .range(entries.length, entries.length + pageSize - 1)

      if (actionFilter) {
        query = query.ilike('action', `%${actionFilter}%`)
      }
      if (search) {
        query = query.or(`entity_type.ilike.%${search}%,entity_id.ilike.%${search}%,action.ilike.%${search}%`)
      }
      if (dateFrom) {
        query = query.gte('created_at', `${dateFrom}T00:00:00`)
      }
      if (dateTo) {
        query = query.lte('created_at', `${dateTo}T23:59:59`)
      }

      const { data } = await query

      type RawEntry = {
        id: string
        action: string
        entity_type: string
        entity_id: string | null
        details: Record<string, unknown>
        created_at: string
        user_id: string
        profiles: { full_name: string; email: string } | null
      }

      const newEntries = ((data as unknown as RawEntry[]) || []).map((e) => ({
        id: e.id,
        action: e.action,
        entity_type: e.entity_type,
        entity_id: e.entity_id,
        details: e.details,
        created_at: e.created_at,
        user_name: e.profiles?.full_name || e.profiles?.email || 'System',
      }))

      setEntries((prev) => [...prev, ...newEntries])
      setHasMore(newEntries.length >= pageSize)
    } finally {
      setLoading(false)
    }
  }

  if (entries.length === 0) {
    return (
      <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] p-12 text-center">
        <div className="text-4xl mb-3">📋</div>
        <h3 className="text-lg font-semibold text-white mb-1">No audit entries</h3>
        <p className="text-sm text-white/40">
          {actionFilter || search || dateFrom || dateTo
            ? 'No entries match your filters. Try adjusting them.'
            : 'Actions will appear here as they happen.'}
        </p>
      </div>
    )
  }

  return (
    <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] bg-white/[0.03]">
              <th className="text-left px-4 py-3 font-medium text-white/50 text-xs uppercase">Time</th>
              <th className="text-left px-4 py-3 font-medium text-white/50 text-xs uppercase">User</th>
              <th className="text-left px-4 py-3 font-medium text-white/50 text-xs uppercase">Action</th>
              <th className="text-left px-4 py-3 font-medium text-white/50 text-xs uppercase">Entity</th>
              <th className="text-left px-4 py-3 font-medium text-white/50 text-xs uppercase">Details</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <Fragment key={entry.id}>
                <tr
                  className="border-b border-white/[0.04] hover:bg-white/[0.02] cursor-pointer transition-colors"
                  onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                >
                  <td className="px-4 py-3 whitespace-nowrap text-white/40" title={new Date(entry.created_at).toLocaleString()}>
                    {relativeTime(entry.created_at)}
                  </td>
                  <td className="px-4 py-3 text-white font-medium">
                    {entry.user_name}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getActionColor(entry.action)}`}>
                      {entry.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white">
                    <span className="font-medium">{entry.entity_type}</span>
                    {entry.entity_id && (
                      <span className="text-white/40 ml-1 text-xs">#{entry.entity_id.slice(0, 8)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-white/40">
                    {Object.keys(entry.details || {}).length > 0 ? (
                      <button className="text-[#4ecde6] hover:underline text-xs">
                        {expandedId === entry.id ? 'Hide' : 'View'}
                      </button>
                    ) : (
                      <span className="text-xs">--</span>
                    )}
                  </td>
                </tr>
                {expandedId === entry.id && Object.keys(entry.details || {}).length > 0 && (
                  <tr className="border-b border-white/[0.04]">
                    <td colSpan={5} className="px-4 py-3 bg-[#0a0a0a]">
                      <pre className="text-xs text-white/40 font-mono whitespace-pre-wrap break-all max-w-full overflow-hidden">
                        {JSON.stringify(entry.details, null, 2)}
                      </pre>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <div className="p-4 text-center border-t border-white/[0.06]">
          <button
            onClick={loadMore}
            disabled={loading}
            className="px-4 py-2 text-sm font-semibold bg-[#4ecde6] text-[#0a0a0a] rounded-xl hover:bg-[#6dd8ee] transition-colors disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}
    </div>
  )
}
