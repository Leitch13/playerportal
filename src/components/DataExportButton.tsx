'use client'

import { useState } from 'react'

export default function DataExportButton() {
  const [loading, setLoading] = useState(false)

  async function handleExport() {
    setLoading(true)
    try {
      const res = await fetch('/api/export/all')
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Export failed')
      }

      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition')
      const filenameMatch = disposition?.match(/filename="(.+)"/)
      const filename = filenameMatch?.[1] || 'playerportal-backup.json'

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-accent text-white hover:opacity-90 disabled:opacity-50 transition-all"
    >
      {loading ? 'Exporting...' : 'Export All Data'}
    </button>
  )
}
