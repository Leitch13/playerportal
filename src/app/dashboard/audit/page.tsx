import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AuditFilters from './AuditFilters'
import AuditTable from './AuditTable'

const PAGE_SIZE = 25

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const supabase = await createClient()
  const { data: role } = await supabase.rpc('get_my_role')
  if (role !== 'admin') redirect('/dashboard')

  const { data: orgId } = await supabase.rpc('get_my_org')

  const params = await searchParams
  const actionFilter = typeof params.action === 'string' ? params.action : ''
  const search = typeof params.search === 'string' ? params.search : ''
  const dateFrom = typeof params.from === 'string' ? params.from : ''
  const dateTo = typeof params.to === 'string' ? params.to : ''

  let query = supabase
    .from('audit_log')
    .select('id, action, entity_type, entity_id, details, created_at, user_id, profiles!audit_log_user_id_fkey(full_name, email)')
    .eq('organisation_id', orgId)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE)

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

  const { data: entries } = await query

  // Get distinct actions for the filter dropdown
  const { data: actionTypes } = await supabase
    .from('audit_log')
    .select('action')
    .eq('organisation_id', orgId)
    .order('action')

  const uniqueActions = [...new Set((actionTypes || []).map((a) => a.action))]

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

  const serialized = ((entries as unknown as RawEntry[]) || []).map((e) => ({
    id: e.id,
    action: e.action,
    entity_type: e.entity_type,
    entity_id: e.entity_id,
    details: e.details,
    created_at: e.created_at,
    user_name: e.profiles?.full_name || e.profiles?.email || 'System',
  }))

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text dark:text-white">Audit Log</h1>
          <p className="text-sm text-text-light mt-1">Track all actions across your organisation</p>
        </div>
      </div>

      <AuditFilters
        actions={uniqueActions}
        currentAction={actionFilter}
        currentSearch={search}
        currentFrom={dateFrom}
        currentTo={dateTo}
      />

      <AuditTable
        entries={serialized}
        pageSize={PAGE_SIZE}
        orgId={orgId as string}
        actionFilter={actionFilter}
        search={search}
        dateFrom={dateFrom}
        dateTo={dateTo}
      />
    </div>
  )
}
