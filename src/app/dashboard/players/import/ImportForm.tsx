'use client'

import { useState, useRef, useCallback } from 'react'
import Card from '@/components/Card'
import { downloadCSVTemplate } from './template'

interface ParsedRow {
  first_name: string
  last_name: string
  date_of_birth: string
  age_group: string
  parent_email: string
  parent_name: string
  parent_phone: string
  group_name: string
  medical_info: string
}

interface RowValidation {
  row: ParsedRow
  rowIndex: number
  valid: boolean
  errors: string[]
}

interface ImportResult {
  imported: number
  errors: { row: number; error: string }[]
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '')
  if (lines.length < 2) return []

  const headers = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase())
  const rows: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    const row: Record<string, string> = {}
    headers.forEach((header, idx) => {
      row[header] = (values[idx] || '').trim()
    })
    rows.push(row)
  }

  return rows
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        result.push(current)
        current = ''
      } else {
        current += char
      }
    }
  }
  result.push(current)
  return result
}

function validateRow(row: Record<string, string>, index: number): RowValidation {
  const errors: string[] = []
  const parsed: ParsedRow = {
    first_name: row.first_name || '',
    last_name: row.last_name || '',
    date_of_birth: row.date_of_birth || '',
    age_group: row.age_group || '',
    parent_email: row.parent_email || '',
    parent_name: row.parent_name || '',
    parent_phone: row.parent_phone || '',
    group_name: row.group_name || '',
    medical_info: row.medical_info || '',
  }

  if (!parsed.first_name) errors.push('first_name is required')
  if (!parsed.last_name) errors.push('last_name is required')

  if (parsed.date_of_birth) {
    const dobMatch = parsed.date_of_birth.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (!dobMatch) {
      errors.push('date_of_birth must be DD/MM/YYYY')
    } else {
      const day = parseInt(dobMatch[1], 10)
      const month = parseInt(dobMatch[2], 10)
      const year = parseInt(dobMatch[3], 10)
      if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) {
        errors.push('date_of_birth is invalid')
      }
    }
  }

  if (parsed.parent_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parsed.parent_email)) {
    errors.push('parent_email is invalid')
  }

  return {
    row: parsed,
    rowIndex: index,
    valid: errors.length === 0,
    errors,
  }
}

export default function ImportForm() {
  const [validatedRows, setValidatedRows] = useState<RowValidation[]>([])
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validCount = validatedRows.filter((r) => r.valid).length

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    setResult(null)
    setProgress(0)

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      const rows = parseCSV(text)
      const validated = rows.map((row, idx) => validateRow(row, idx + 1))
      setValidatedRows(validated)
    }
    reader.readAsText(file)
  }, [])

  const handleImport = useCallback(async () => {
    const validRows = validatedRows.filter((r) => r.valid)
    if (validRows.length === 0) return

    setImporting(true)
    setProgress(0)
    setResult(null)

    const chunkSize = 10
    let totalImported = 0
    const allErrors: { row: number; error: string }[] = []

    for (let i = 0; i < validRows.length; i += chunkSize) {
      const chunk = validRows.slice(i, i + chunkSize)
      const payload = chunk.map((v) => ({
        ...v.row,
        _rowIndex: v.rowIndex,
      }))

      try {
        const res = await fetch('/api/import/players', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ players: payload }),
        })

        if (!res.ok) {
          const errText = await res.text()
          chunk.forEach((v) => {
            allErrors.push({ row: v.rowIndex, error: errText || 'Request failed' })
          })
        } else {
          const data: ImportResult = await res.json()
          totalImported += data.imported
          allErrors.push(...data.errors)
        }
      } catch (err) {
        chunk.forEach((v) => {
          allErrors.push({ row: v.rowIndex, error: (err as Error).message })
        })
      }

      setProgress(Math.min(100, Math.round(((i + chunkSize) / validRows.length) * 100)))
    }

    setResult({ imported: totalImported, errors: allErrors })
    setImporting(false)
    setProgress(100)
  }, [validatedRows])

  const reset = useCallback(() => {
    setValidatedRows([])
    setResult(null)
    setProgress(0)
    setFileName(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const previewRows = validatedRows.slice(0, 10)
  const skippedCount = validatedRows.length - validCount

  return (
    <div className="space-y-6">
      {/* File Upload */}
      <Card>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <label className="flex-1">
              <div className="flex items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
                <div className="text-center">
                  <svg className="mx-auto h-8 w-8 text-text-light" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="mt-1 text-sm text-text-light">
                    {fileName ? fileName : 'Click to upload CSV file'}
                  </p>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => downloadCSVTemplate()}
              className="text-sm text-primary hover:underline"
            >
              Download CSV template
            </button>
            {fileName && (
              <button
                type="button"
                onClick={reset}
                className="text-sm text-text-light hover:text-text"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* Preview Table */}
      {validatedRows.length > 0 && !result && (
        <Card title={`Preview (${validatedRows.length} rows found)`}>
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 font-medium w-8">#</th>
                    <th className="text-left py-2 font-medium">Status</th>
                    <th className="text-left py-2 font-medium">First Name</th>
                    <th className="text-left py-2 font-medium">Last Name</th>
                    <th className="text-left py-2 font-medium">DOB</th>
                    <th className="text-left py-2 font-medium">Age Group</th>
                    <th className="text-left py-2 font-medium">Parent Email</th>
                    <th className="text-left py-2 font-medium">Group</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((v) => (
                    <tr key={v.rowIndex} className="border-b border-border last:border-0">
                      <td className="py-2 text-text-light">{v.rowIndex}</td>
                      <td className="py-2">
                        {v.valid ? (
                          <span className="text-green-600" title="Valid">&#10003;</span>
                        ) : (
                          <span className="text-red-500" title={v.errors.join(', ')}>&#10007; {v.errors.join(', ')}</span>
                        )}
                      </td>
                      <td className="py-2">{v.row.first_name}</td>
                      <td className="py-2">{v.row.last_name}</td>
                      <td className="py-2">{v.row.date_of_birth || '—'}</td>
                      <td className="py-2">{v.row.age_group || '—'}</td>
                      <td className="py-2">{v.row.parent_email || '—'}</td>
                      <td className="py-2">{v.row.group_name || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {validatedRows.length > 10 && (
              <p className="text-sm text-text-light">
                Showing first 10 of {validatedRows.length} rows.
              </p>
            )}

            <div className="flex items-center justify-between pt-2">
              <div className="text-sm text-text-light">
                {validCount} valid, {skippedCount} with errors
              </div>
              <button
                type="button"
                onClick={handleImport}
                disabled={importing || validCount === 0}
                className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {importing ? 'Importing...' : `Import ${validCount} Players`}
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Progress Bar */}
      {importing && (
        <Card>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Importing players...</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </Card>
      )}

      {/* Results */}
      {result && (
        <Card title="Import Results">
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-700">{result.imported}</div>
                <div className="text-sm text-green-600">Imported</div>
              </div>
              <div className="p-4 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-700">{skippedCount}</div>
                <div className="text-sm text-yellow-600">Skipped (invalid)</div>
              </div>
              <div className="p-4 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-700">{result.errors.length}</div>
                <div className="text-sm text-red-600">Errors</div>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-medium mb-2">Error Details</h3>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {result.errors.map((err, idx) => (
                    <div key={idx} className="text-sm text-red-600 bg-red-50 px-3 py-1.5 rounded">
                      Row {err.row}: {err.error}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={reset}
                className="px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-surface"
              >
                Import More
              </button>
              <a
                href="/dashboard/players"
                className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90"
              >
                View Players
              </a>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
