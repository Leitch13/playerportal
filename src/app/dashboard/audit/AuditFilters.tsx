'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'

export default function AuditFilters({
  actions,
  currentAction,
  currentSearch,
  currentFrom,
  currentTo,
}: {
  actions: string[]
  currentAction: string
  currentSearch: string
  currentFrom: string
  currentTo: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      router.push(`/dashboard/audit?${params.toString()}`)
    },
    [router, searchParams]
  )

  const clearAll = useCallback(() => {
    router.push('/dashboard/audit')
  }, [router])

  const hasFilters = currentAction || currentSearch || currentFrom || currentTo

  return (
    <div className="bg-white dark:bg-primary-light rounded-lg border border-border dark:border-white/10 p-4 mb-4">
      <div className="flex flex-col sm:flex-row gap-3 items-end">
        {/* Search */}
        <div className="flex-1 min-w-0">
          <label className="block text-xs font-medium text-text-light mb-1">Search</label>
          <input
            type="text"
            placeholder="Search by entity, action..."
            defaultValue={currentSearch}
            onChange={(e) => {
              const val = e.target.value
              // Debounce: update after typing stops
              const t = setTimeout(() => updateParam('search', val), 400)
              return () => clearTimeout(t)
            }}
            className="w-full px-3 py-2 text-sm border border-border dark:border-white/10 rounded-md bg-surface dark:bg-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        {/* Action filter */}
        <div className="w-full sm:w-48">
          <label className="block text-xs font-medium text-text-light mb-1">Action Type</label>
          <select
            value={currentAction}
            onChange={(e) => updateParam('action', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-border dark:border-white/10 rounded-md bg-surface dark:bg-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="">All Actions</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>

        {/* Date from */}
        <div className="w-full sm:w-40">
          <label className="block text-xs font-medium text-text-light mb-1">From</label>
          <input
            type="date"
            value={currentFrom}
            onChange={(e) => updateParam('from', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-border dark:border-white/10 rounded-md bg-surface dark:bg-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        {/* Date to */}
        <div className="w-full sm:w-40">
          <label className="block text-xs font-medium text-text-light mb-1">To</label>
          <input
            type="date"
            value={currentTo}
            onChange={(e) => updateParam('to', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-border dark:border-white/10 rounded-md bg-surface dark:bg-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        {/* Clear */}
        {hasFilters && (
          <button
            onClick={clearAll}
            className="px-3 py-2 text-sm font-medium text-text-light hover:text-danger transition-colors whitespace-nowrap"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  )
}
