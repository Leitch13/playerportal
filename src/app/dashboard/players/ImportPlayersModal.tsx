'use client'

import { useState, useRef, useCallback } from 'react'

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

// Map common CSV header variations to our expected column names
// Map common CSV header variations to our expected column names
const HEADER_ALIASES: Record<string, string> = {
  // First name
  'first_name': 'first_name', 'firstname': 'first_name', 'first name': 'first_name', 'first': 'first_name', 'forename': 'first_name', 'given name': 'first_name',
  'childfirstname': 'first_name', 'child first name': 'first_name', 'child_first_name': 'first_name', 'player first name': 'first_name', 'playerfirstname': 'first_name',
  // Last name
  'last_name': 'last_name', 'lastname': 'last_name', 'last name': 'last_name', 'last': 'last_name', 'surname': 'last_name', 'family name': 'last_name',
  'childsurname': 'last_name', 'childlastname': 'last_name', 'child surname': 'last_name', 'child last name': 'last_name', 'child_last_name': 'last_name', 'child_surname': 'last_name',
  'playerlastname': 'last_name', 'playersurname': 'last_name',
  // DOB
  'date_of_birth': 'date_of_birth', 'dob': 'date_of_birth', 'date of birth': 'date_of_birth', 'birthday': 'date_of_birth', 'birth date': 'date_of_birth', 'birth_date': 'date_of_birth',
  'childdateofbirth': 'date_of_birth', 'nextbirthday': '_next_birthday',
  // Age group
  'age_group': 'age_group', 'agegroup': 'age_group', 'age group': 'age_group', 'age': 'age_group', 'category': 'age_group', 'group age': 'age_group',
  // Parent email
  'parent_email': 'parent_email', 'parentemail': 'parent_email', 'parent email': 'parent_email', 'email': 'parent_email', 'guardian email': 'parent_email', 'contact email': 'parent_email',
  'contactid': '_contact_email', 'username': 'parent_email',
  // Parent name
  'parent_name': 'parent_name', 'parentname': 'parent_name', 'parent name': 'parent_name', 'parent': 'parent_name', 'guardian': 'parent_name', 'guardian name': 'parent_name', 'contact name': 'parent_name',
  'parentfirstname': '_parent_first', 'parentlastname': '_parent_last', 'parent_firstname': '_parent_first', 'parent_lastname': '_parent_last',
  // Parent phone
  'parent_phone': 'parent_phone', 'parentphone': 'parent_phone', 'parent phone': 'parent_phone', 'phone': 'parent_phone', 'mobile': 'parent_phone', 'contact phone': 'parent_phone', 'tel': 'parent_phone', 'telephone': 'parent_phone',
  // Group
  'group_name': 'group_name', 'groupname': 'group_name', 'group name': 'group_name', 'group': 'group_name', 'class': 'group_name', 'class name': 'group_name', 'team': 'group_name',
  'inprogramme': 'group_name', 'programme': 'group_name', 'program': 'group_name',
  // Medical
  'medical_info': 'medical_info', 'medicalinfo': 'medical_info', 'medical info': 'medical_info', 'medical': 'medical_info', 'medical notes': 'medical_info', 'health': 'medical_info', 'allergies': 'medical_info',
  // Full name (split)
  'name': '_full_name', 'childname': '_full_name', 'child name': '_full_name', 'player name': '_full_name', 'playername': '_full_name',
  // Gender (store as extra info)
  'gender': '_gender',
}

// Split CSV text into logical lines, handling quoted fields with embedded newlines
function splitCSVLines(text: string): string[] {
  const lines: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') {
      inQuotes = !inQuotes
      current += ch
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (current.trim()) lines.push(current)
      current = ''
      // Skip \r\n combo
      if (ch === '\r' && i + 1 < text.length && text[i + 1] === '\n') i++
    } else {
      current += ch
    }
  }
  if (current.trim()) lines.push(current)
  return lines
}

function parseCSV(text: string): Record<string, string>[] {
  // Remove BOM if present
  const clean = text.replace(/^\uFEFF/, '')
  const lines = splitCSVLines(clean)
  if (lines.length < 2) return []
  const rawHeaders = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase().replace(/['"]/g, ''))
  // Map headers to normalized names
  const headers = rawHeaders.map(h => HEADER_ALIASES[h] || h)
  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    // Skip rows that are completely empty
    if (values.every(v => !v.trim())) continue
    const row: Record<string, string> = {}
    headers.forEach((header, idx) => { row[header] = (values[idx] || '').trim() })
    // Handle "name" column — split into first/last
    if (row._full_name && !row.first_name) {
      const parts = row._full_name.trim().split(/\s+/)
      row.first_name = parts[0] || ''
      row.last_name = parts.slice(1).join(' ') || ''
    }
    // Handle parentfirstname + parentlastname → parent_name
    if ((row._parent_first || row._parent_last) && !row.parent_name) {
      row.parent_name = `${row._parent_first || ''} ${row._parent_last || ''}`.trim()
    }
    // Handle ClassForKids contactid or username as email if it looks like one
    if (row._contact_email && !row.parent_email && row._contact_email.includes('@')) {
      row.parent_email = row._contact_email
    }
    // Handle date formats: YYYY-MM-DD → DD/MM/YYYY for validation
    if (row.date_of_birth && row.date_of_birth.match(/^\d{4}-\d{2}-\d{2}/)) {
      const [y, m, d] = row.date_of_birth.split('T')[0].split('-')
      row.date_of_birth = `${d}/${m}/${y}`
    }
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
        if (i + 1 < line.length && line[i + 1] === '"') { current += '"'; i++ }
        else inQuotes = false
      } else current += char
    } else {
      if (char === '"') inQuotes = true
      else if (char === ',') { result.push(current); current = '' }
      else current += char
    }
  }
  result.push(current)
  return result
}

function validateRow(row: Record<string, string>, index: number): RowValidation {
  const errors: string[] = []
  const parsed: ParsedRow = {
    first_name: row.first_name || '', last_name: row.last_name || '',
    date_of_birth: row.date_of_birth || '', age_group: row.age_group || '',
    parent_email: row.parent_email || '', parent_name: row.parent_name || '',
    parent_phone: row.parent_phone || '', group_name: row.group_name || '',
    medical_info: row.medical_info || '',
  }
  if (!parsed.first_name) errors.push('first_name required')
  if (!parsed.last_name) errors.push('last_name required')
  if (parsed.date_of_birth) {
    const m = parsed.date_of_birth.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (!m) errors.push('DOB must be DD/MM/YYYY')
    else { const [,d,mo,y] = m.map(Number); if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1900) errors.push('Invalid DOB') }
  }
  if (parsed.parent_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parsed.parent_email)) errors.push('Invalid email')
  return { row: parsed, rowIndex: index, valid: errors.length === 0, errors }
}

function generateTemplate(): string {
  const headers = ['first_name','last_name','date_of_birth','age_group','parent_email','parent_name','parent_phone','group_name','medical_info']
  const example = ['John','Smith','15/03/2015','U10','mary@email.com','Mary Smith','0412345678','Monday U10s','Asthma']
  return [headers.join(','), example.join(',')].join('\n')
}

export default function ImportPlayersModal() {
  const [open, setOpen] = useState(false)
  const [validatedRows, setValidatedRows] = useState<RowValidation[]>([])
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validCount = validatedRows.filter(r => r.valid).length
  const skippedCount = validatedRows.length - validCount

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setResult(null)
    setProgress(0)
    setParseError(null)
    setDetectedHeaders([])
    const reader = new FileReader()
    reader.onerror = () => setParseError('Failed to read file')
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string
        if (!text || text.trim().length === 0) {
          setParseError('File is empty')
          return
        }
        const rows = parseCSV(text)
        if (rows.length === 0) {
          setParseError('No data rows found. Make sure the file has a header row and at least one data row.')
          return
        }
        // Show detected headers for debugging
        const headers = Object.keys(rows[0])
        setDetectedHeaders(headers)
        const validated = rows.map((row, i) => validateRow(row, i + 1))
        setValidatedRows(validated)
      } catch (err) {
        setParseError(`Parse error: ${(err as Error).message}`)
      }
    }
    reader.readAsText(file)
  }, [])

  const handleImport = useCallback(async () => {
    const validRows = validatedRows.filter(r => r.valid)
    if (!validRows.length) return
    setImporting(true); setProgress(0); setResult(null)
    let totalImported = 0
    const allErrors: { row: number; error: string }[] = []
    const chunk = 10
    for (let i = 0; i < validRows.length; i += chunk) {
      const batch = validRows.slice(i, i + chunk)
      try {
        const res = await fetch('/api/import/players', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ players: batch.map(v => ({ ...v.row, _rowIndex: v.rowIndex })) }),
        })
        if (!res.ok) {
          const t = await res.text()
          batch.forEach(v => allErrors.push({ row: v.rowIndex, error: t || 'Failed' }))
        } else {
          const data: ImportResult = await res.json()
          totalImported += data.imported
          allErrors.push(...data.errors)
        }
      } catch (err) {
        batch.forEach(v => allErrors.push({ row: v.rowIndex, error: (err as Error).message }))
      }
      setProgress(Math.min(100, Math.round(((i + chunk) / validRows.length) * 100)))
    }
    setResult({ imported: totalImported, errors: allErrors })
    setImporting(false); setProgress(100)
  }, [validatedRows])

  const reset = useCallback(() => {
    setValidatedRows([]); setResult(null); setProgress(0); setFileName(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const downloadTemplate = () => {
    const blob = new Blob([generateTemplate()], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'player_import_template.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 border border-white/[0.08] rounded-lg text-sm font-medium hover:bg-white/[0.05] transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3-3m0 0l3 3m-3-3v12" />
        </svg>
        Import Players
      </button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-start justify-center pt-16 px-4 overflow-y-auto" onClick={() => !importing && setOpen(false)}>
      <div className="bg-[#141414] border border-[#1e1e1e] rounded-2xl w-full max-w-2xl p-6 space-y-5 mb-16" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Import Players</h2>
            <p className="text-xs text-white/40 mt-0.5">Upload a CSV file to bulk import players</p>
          </div>
          <button onClick={() => setOpen(false)} disabled={importing} className="text-white/40 hover:text-white text-sm disabled:opacity-50">Close</button>
        </div>

        {/* Format hint */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-xs text-blue-400">
          <strong>CSV columns:</strong> first_name, last_name (required), date_of_birth (DD/MM/YYYY), age_group, parent_email, parent_name, parent_phone, group_name, medical_info
        </div>

        {!result && (
          <>
            {/* File upload */}
            <label className="block cursor-pointer">
              <div className="flex items-center justify-center w-full h-28 border-2 border-dashed border-[#2a2a2a] rounded-xl hover:border-primary/50 transition-colors">
                <div className="text-center">
                  <svg className="mx-auto h-7 w-7 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="mt-1 text-sm text-white/40">{fileName || 'Click to upload CSV'}</p>
                </div>
              </div>
              <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
            </label>

            <div className="flex items-center gap-3">
              <button onClick={downloadTemplate} className="text-xs text-primary hover:underline">Download template</button>
              {fileName && <button onClick={reset} className="text-xs text-white/40 hover:text-white">Clear</button>}
            </div>

            {parseError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">{parseError}</div>
            )}

            {detectedHeaders.length > 0 && validatedRows.length > 0 && validCount === 0 && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-xs text-amber-400">
                <strong>Detected columns:</strong> {detectedHeaders.join(', ')}<br />
                <span className="text-amber-400/70">Make sure your CSV has columns named <code>first_name</code> and <code>last_name</code>.</span>
              </div>
            )}
          </>
        )}

        {/* Preview */}
        {validatedRows.length > 0 && !result && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-white">{validatedRows.length} rows found</p>
            <div className="overflow-x-auto max-h-60 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#1e1e1e] text-white/50">
                    <th className="text-left py-2 font-medium">#</th>
                    <th className="text-left py-2 font-medium">Status</th>
                    <th className="text-left py-2 font-medium">Name</th>
                    <th className="text-left py-2 font-medium">Age</th>
                    <th className="text-left py-2 font-medium">Parent</th>
                  </tr>
                </thead>
                <tbody>
                  {validatedRows.slice(0, 15).map(v => (
                    <tr key={v.rowIndex} className="border-b border-[#1e1e1e]/50">
                      <td className="py-1.5 text-white/30">{v.rowIndex}</td>
                      <td className="py-1.5">{v.valid ? <span className="text-green-400">&#10003;</span> : <span className="text-red-400" title={v.errors.join(', ')}>&#10007;</span>}</td>
                      <td className="py-1.5 text-white">{v.row.first_name} {v.row.last_name}</td>
                      <td className="py-1.5 text-white/50">{v.row.age_group || '—'}</td>
                      <td className="py-1.5 text-white/50">{v.row.parent_email || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {validatedRows.length > 15 && <p className="text-xs text-white/30">+ {validatedRows.length - 15} more rows</p>}

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-white/40">{validCount} valid, {skippedCount} with errors</span>
              <button
                onClick={handleImport}
                disabled={importing || validCount === 0}
                className="px-5 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-40 transition-colors"
              >
                {importing ? 'Importing...' : `Import ${validCount} Players`}
              </button>
            </div>
          </div>
        )}

        {/* Progress */}
        {importing && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-white/50">
              <span>Importing...</span><span>{progress}%</span>
            </div>
            <div className="w-full bg-[#1a1a1a] rounded-full h-1.5">
              <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-center">
                <div className="text-2xl font-bold text-green-400">{result.imported}</div>
                <div className="text-xs text-green-500">Imported</div>
              </div>
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-center">
                <div className="text-2xl font-bold text-red-400">{result.errors.length}</div>
                <div className="text-xs text-red-500">Errors</div>
              </div>
            </div>
            {result.errors.length > 0 && (
              <div className="max-h-32 overflow-y-auto space-y-1">
                {result.errors.map((err, i) => (
                  <div key={i} className="text-xs text-red-400 bg-red-500/10 px-3 py-1.5 rounded">Row {err.row}: {err.error}</div>
                ))}
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => { reset(); }} className="px-4 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl text-sm text-white/60 hover:text-white">Import More</button>
              <button onClick={() => { setOpen(false); reset(); window.location.reload() }} className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90">Done</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
