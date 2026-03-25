'use client'

import { useState } from 'react'

interface ExportCardProps {
  type: string
  title: string
  description: string
  icon: string
  count: number
  hasDateFilter: boolean
}

export default function ExportCard({ type, title, description, icon, count, hasDateFilter }: ExportCardProps) {
  const [loading, setLoading] = useState(false)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  async function handleExport() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (fromDate) params.set('from', fromDate)
      if (toDate) params.set('to', toDate)

      const url = `/api/export/${type}${params.toString() ? '?' + params.toString() : ''}`
      const res = await fetch(url)

      if (!res.ok) {
        const text = await res.text()
        alert(`Export failed: ${text}`)
        return
      }

      const blob = await res.blob()
      const downloadUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = `${type}-export-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(downloadUrl)
    } catch {
      alert('Export failed')
    }
    setLoading(false)
  }

  return (
    <div className="bg-white rounded-2xl border border-border p-5 flex flex-col">
      <div className="flex items-start justify-between mb-3">
        <span className="text-3xl">{icon}</span>
        <span className="text-xs font-medium text-text-light bg-surface px-2 py-0.5 rounded-full">
          {count.toLocaleString()} rows
        </span>
      </div>

      <h3 className="font-bold mb-0.5">{title}</h3>
      <p className="text-xs text-text-light mb-4 flex-1">{description}</p>

      {hasDateFilter && (
        <div className="flex gap-2 mb-3">
          <input
            type="date"
            className="flex-1 border border-border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-accent/50"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
            placeholder="From"
          />
          <input
            type="date"
            className="flex-1 border border-border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-accent/50"
            value={toDate}
            onChange={e => setToDate(e.target.value)}
            placeholder="To"
          />
        </div>
      )}

      <button
        onClick={handleExport}
        disabled={loading || count === 0}
        className="w-full py-2.5 rounded-xl text-sm font-semibold bg-accent text-white hover:opacity-90 disabled:opacity-40 transition-all"
      >
        {loading ? 'Exporting...' : 'Export CSV'}
      </button>
    </div>
  )
}
