'use client'

import { useState, useCallback, useRef } from 'react'

/* ─── Types ─── */

type PortalField =
  | 'first_name'
  | 'last_name'
  | 'date_of_birth'
  | 'parent_name'
  | 'parent_email'
  | 'parent_phone'
  | 'group_name'
  | 'medical_info'
  | 'age_group'
  | '__skip__'

interface FileState {
  file: File | null
  headers: string[]
  rows: Record<string, string>[]
}

interface ColumnMapping {
  csvHeader: string
  portalField: PortalField
}

interface ImportStats {
  players_imported: number
  players_skipped: number
  parents_created: number
  groups_created: number
  enrolments_created: number
  errors: { row: number; error: string }[]
}

/* ─── Auto-map logic ─── */

const AUTO_MAP: Record<string, PortalField> = {
  'child first name': 'first_name',
  'first name': 'first_name',
  'firstname': 'first_name',
  'first_name': 'first_name',
  'child surname': 'last_name',
  'last name': 'last_name',
  'surname': 'last_name',
  'lastname': 'last_name',
  'last_name': 'last_name',
  'date of birth': 'date_of_birth',
  'dob': 'date_of_birth',
  'date_of_birth': 'date_of_birth',
  'birth date': 'date_of_birth',
  'birthdate': 'date_of_birth',
  'parent/guardian name': 'parent_name',
  'parent name': 'parent_name',
  'parent_name': 'parent_name',
  'guardian name': 'parent_name',
  'parent/guardian email': 'parent_email',
  'parent email': 'parent_email',
  'parent_email': 'parent_email',
  'guardian email': 'parent_email',
  'email': 'parent_email',
  'email address': 'parent_email',
  'parent/guardian phone': 'parent_phone',
  'parent phone': 'parent_phone',
  'parent_phone': 'parent_phone',
  'phone': 'parent_phone',
  'mobile': 'parent_phone',
  'phone number': 'parent_phone',
  'mobile number': 'parent_phone',
  'guardian phone': 'parent_phone',
  'class name': 'group_name',
  'class': 'group_name',
  'group': 'group_name',
  'group name': 'group_name',
  'group_name': 'group_name',
  'medical info': 'medical_info',
  'medical': 'medical_info',
  'medical_info': 'medical_info',
  'notes': 'medical_info',
  'additional info': 'medical_info',
  'medical notes': 'medical_info',
  'health info': 'medical_info',
  'age group': 'age_group',
  'age': 'age_group',
  'age_group': 'age_group',
}

const PORTAL_FIELDS: { value: PortalField; label: string }[] = [
  { value: '__skip__', label: '-- Skip this column --' },
  { value: 'first_name', label: 'First Name' },
  { value: 'last_name', label: 'Last Name' },
  { value: 'date_of_birth', label: 'Date of Birth' },
  { value: 'parent_name', label: 'Parent Name' },
  { value: 'parent_email', label: 'Parent Email' },
  { value: 'parent_phone', label: 'Parent Phone' },
  { value: 'group_name', label: 'Class / Group Name' },
  { value: 'medical_info', label: 'Medical / Notes' },
  { value: 'age_group', label: 'Age Group' },
]

/* ─── CSV Parser ─── */

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

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '')
  if (lines.length < 2) return { headers: [], rows: [] }

  const headers = parseCSVLine(lines[0]).map((h) => h.trim())
  const rows: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    const row: Record<string, string> = {}
    headers.forEach((header, idx) => {
      row[header] = (values[idx] || '').trim()
    })
    rows.push(row)
  }

  return { headers, rows }
}

function autoMapHeaders(headers: string[]): ColumnMapping[] {
  return headers.map((h) => {
    const normalized = h.toLowerCase().trim()
    const mapped = AUTO_MAP[normalized] || '__skip__'
    return { csvHeader: h, portalField: mapped }
  })
}

/* ─── File Upload Zone ─── */

function FileUploadZone({
  label,
  required,
  file,
  onFile,
}: {
  label: string
  required?: boolean
  file: File | null
  onFile: (file: File) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const f = e.dataTransfer.files[0]
      if (f && f.name.endsWith('.csv')) onFile(f)
    },
    [onFile]
  )

  return (
    <div
      className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
        dragOver
          ? 'border-[#4ecde6]/60 bg-[#4ecde6]/5'
          : file
          ? 'border-emerald-500/40 bg-emerald-500/5'
          : 'border-[#1e1e1e] hover:border-[#4ecde6]/30'
      }`}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onFile(f)
        }}
      />
      {file ? (
        <div className="flex items-center justify-center gap-2">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <span className="text-sm text-emerald-400 font-medium">{file.name}</span>
        </div>
      ) : (
        <>
          <svg className="mx-auto h-8 w-8 text-[#888]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="mt-2 text-sm text-white font-medium">{label}</p>
          <p className="text-xs text-[#888] mt-1">
            Drag & drop or click to upload
            {required && <span className="text-red-400 ml-1">*required</span>}
          </p>
        </>
      )}
    </div>
  )
}

/* ─── Main Component ─── */

export default function MigrateForm() {
  const [step, setStep] = useState(1)

  // Step 1: File uploads
  const [playersFile, setPlayersFile] = useState<FileState>({ file: null, headers: [], rows: [] })
  const [parentsFile, setParentsFile] = useState<FileState>({ file: null, headers: [], rows: [] })
  const [classesFile, setClassesFile] = useState<FileState>({ file: null, headers: [], rows: [] })
  const [paymentsFile, setPaymentsFile] = useState<FileState>({ file: null, headers: [], rows: [] })

  // Step 2: Column mapping
  const [mappings, setMappings] = useState<ColumnMapping[]>([])

  // Step 3: Import
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stats, setStats] = useState<ImportStats | null>(null)
  const [sendWelcomeEmails, setSendWelcomeEmails] = useState(false)

  const readFile = useCallback((file: File): Promise<FileState> => {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const text = e.target?.result as string
        const { headers, rows } = parseCSV(text)
        resolve({ file, headers, rows })
      }
      reader.readAsText(file)
    })
  }, [])

  const handlePlayersFile = useCallback(
    async (file: File) => {
      const state = await readFile(file)
      setPlayersFile(state)
    },
    [readFile]
  )

  const handleParentsFile = useCallback(
    async (file: File) => {
      const state = await readFile(file)
      setParentsFile(state)
    },
    [readFile]
  )

  const handleClassesFile = useCallback(
    async (file: File) => {
      const state = await readFile(file)
      setClassesFile(state)
    },
    [readFile]
  )

  const handlePaymentsFile = useCallback(
    async (file: File) => {
      const state = await readFile(file)
      setPaymentsFile(state)
    },
    [readFile]
  )

  // Proceed to step 2 — auto-map columns
  const goToStep2 = useCallback(() => {
    // Merge headers from all uploaded files, but primarily from the players file
    const allHeaders = [...playersFile.headers]

    // Add unique headers from other files
    for (const f of [parentsFile, classesFile]) {
      for (const h of f.headers) {
        if (!allHeaders.some((ah) => ah.toLowerCase() === h.toLowerCase())) {
          allHeaders.push(h)
        }
      }
    }

    const autoMapped = autoMapHeaders(allHeaders)
    setMappings(autoMapped)
    setStep(2)
  }, [playersFile, parentsFile, classesFile])

  // Update a mapping
  const updateMapping = useCallback((index: number, field: PortalField) => {
    setMappings((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], portalField: field }
      return next
    })
  }, [])

  // Build mapped preview data
  const getMappedRows = useCallback(() => {
    // Combine rows from all sources, primarily players file
    const allRows = [...playersFile.rows]

    // If parents file has data, try to merge by email or index
    if (parentsFile.rows.length > 0) {
      const parentEmailHeader = parentsFile.headers.find((h) => {
        const n = h.toLowerCase()
        return n.includes('email')
      })
      if (parentEmailHeader) {
        const parentMap = new Map<string, Record<string, string>>()
        for (const row of parentsFile.rows) {
          const email = row[parentEmailHeader]?.toLowerCase()
          if (email) parentMap.set(email, row)
        }

        // Try to match with players
        const playerEmailMapping = mappings.find((m) => m.portalField === 'parent_email')
        if (playerEmailMapping) {
          for (const playerRow of allRows) {
            const email = playerRow[playerEmailMapping.csvHeader]?.toLowerCase()
            if (email && parentMap.has(email)) {
              const parentRow = parentMap.get(email)!
              // Merge parent columns into player row
              for (const [key, value] of Object.entries(parentRow)) {
                if (!playerRow[key]) playerRow[key] = value
              }
            }
          }
        }
      }
    }

    // Map to portal fields
    const activeMappings = mappings.filter((m) => m.portalField !== '__skip__')

    return allRows.map((row) => {
      const mapped: Record<string, string> = {}
      for (const m of activeMappings) {
        mapped[m.portalField] = row[m.csvHeader] || ''
      }
      return mapped
    })
  }, [playersFile, parentsFile, mappings])

  // Get class names from classes file
  const getClassNames = useCallback(() => {
    if (classesFile.rows.length === 0) return []
    const nameHeader = classesFile.headers.find((h) => {
      const n = h.toLowerCase()
      return n.includes('class') || n.includes('group') || n.includes('name')
    })
    if (!nameHeader) return []
    return classesFile.rows.map((r) => r[nameHeader]).filter(Boolean)
  }, [classesFile])

  // Step 3: Start import
  const startImport = useCallback(async () => {
    setImporting(true)
    setProgress(0)
    setStats(null)

    const mappedRows = getMappedRows()
    const classNames = getClassNames()

    const chunkSize = 25
    const totalChunks = Math.ceil(mappedRows.length / chunkSize)
    let aggregatedStats: ImportStats = {
      players_imported: 0,
      players_skipped: 0,
      parents_created: 0,
      groups_created: 0,
      enrolments_created: 0,
      errors: [],
    }

    for (let i = 0; i < mappedRows.length; i += chunkSize) {
      const chunk = mappedRows.slice(i, i + chunkSize)
      const chunkIndex = Math.floor(i / chunkSize)

      try {
        const res = await fetch('/api/import/migrate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rows: chunk.map((row, idx) => ({ ...row, _rowIndex: i + idx + 1 })),
            classNames: chunkIndex === 0 ? classNames : [],
            sendWelcomeEmails,
          }),
        })

        if (!res.ok) {
          const errText = await res.text()
          for (let j = 0; j < chunk.length; j++) {
            aggregatedStats.errors.push({
              row: i + j + 1,
              error: errText || 'Request failed',
            })
          }
        } else {
          const data: ImportStats = await res.json()
          aggregatedStats.players_imported += data.players_imported
          aggregatedStats.players_skipped += data.players_skipped
          aggregatedStats.parents_created += data.parents_created
          aggregatedStats.groups_created += data.groups_created
          aggregatedStats.enrolments_created += data.enrolments_created
          aggregatedStats.errors.push(...data.errors)
        }
      } catch (err) {
        for (let j = 0; j < chunk.length; j++) {
          aggregatedStats.errors.push({
            row: i + j + 1,
            error: (err as Error).message,
          })
        }
      }

      setProgress(Math.min(100, Math.round(((chunkIndex + 1) / totalChunks) * 100)))
    }

    setStats(aggregatedStats)
    setImporting(false)
    setProgress(100)
  }, [getMappedRows, getClassNames, sendWelcomeEmails])

  const mappedPreview = step >= 2 ? getMappedRows().slice(0, 5) : []
  const totalRows = playersFile.rows.length

  const hasFirstName = mappings.some((m) => m.portalField === 'first_name')
  const hasLastName = mappings.some((m) => m.portalField === 'last_name')
  const canProceedToStep3 = hasFirstName && hasLastName

  return (
    <div className="space-y-6">
      {/* Step Indicators */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                step === s
                  ? 'bg-[#4ecde6] text-black'
                  : step > s
                  ? 'bg-emerald-500 text-white'
                  : 'bg-[#1a1a1a] text-[#888] border border-[#1e1e1e]'
              }`}
            >
              {step > s ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                s
              )}
            </div>
            <span className={`text-sm font-medium ${step === s ? 'text-white' : 'text-[#888]'}`}>
              {s === 1 ? 'Upload' : s === 2 ? 'Map Columns' : 'Import'}
            </span>
            {s < 3 && <div className="w-12 h-px bg-[#1e1e1e]" />}
          </div>
        ))}
      </div>

      {/* ═══ STEP 1: Upload ═══ */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="bg-[#141414] rounded-xl border border-[#1e1e1e] p-6">
            <h2 className="text-lg font-semibold text-white mb-2">Upload Your Export Files</h2>
            <p className="text-sm text-[#888] mb-6">
              In ClassForKids, go to Reports &rarr; Export Data &rarr; Download CSV
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FileUploadZone
                label="Players / Children CSV"
                required
                file={playersFile.file}
                onFile={handlePlayersFile}
              />
              <FileUploadZone
                label="Parents / Guardians CSV"
                file={parentsFile.file}
                onFile={handleParentsFile}
              />
              <FileUploadZone
                label="Classes / Groups CSV"
                file={classesFile.file}
                onFile={handleClassesFile}
              />
              <FileUploadZone
                label="Payment History CSV"
                file={paymentsFile.file}
                onFile={handlePaymentsFile}
              />
            </div>
          </div>

          {playersFile.file && (
            <div className="bg-[#141414] rounded-xl border border-[#1e1e1e] p-6">
              <h3 className="text-sm font-semibold text-white mb-3">Detected Data</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div className="p-3 bg-[#1a1a1a] rounded-lg border border-[#1e1e1e]">
                  <div className="text-xl font-bold text-white">{playersFile.rows.length}</div>
                  <div className="text-xs text-[#888]">Players</div>
                </div>
                <div className="p-3 bg-[#1a1a1a] rounded-lg border border-[#1e1e1e]">
                  <div className="text-xl font-bold text-white">{playersFile.headers.length}</div>
                  <div className="text-xs text-[#888]">Columns</div>
                </div>
                <div className="p-3 bg-[#1a1a1a] rounded-lg border border-[#1e1e1e]">
                  <div className="text-xl font-bold text-white">{parentsFile.rows.length || '--'}</div>
                  <div className="text-xs text-[#888]">Parents</div>
                </div>
                <div className="p-3 bg-[#1a1a1a] rounded-lg border border-[#1e1e1e]">
                  <div className="text-xl font-bold text-white">{classesFile.rows.length || '--'}</div>
                  <div className="text-xs text-[#888]">Classes</div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-[#1e1e1e]">
                <p className="text-xs text-[#888] mb-2">Detected columns:</p>
                <div className="flex flex-wrap gap-1.5">
                  {playersFile.headers.map((h) => (
                    <span key={h} className="px-2 py-1 bg-[#1a1a1a] border border-[#1e1e1e] rounded text-xs text-[#888]">
                      {h}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={goToStep2}
                  className="px-5 py-2.5 bg-[#4ecde6] text-black rounded-lg text-sm font-semibold hover:bg-[#4ecde6]/90 transition-colors"
                >
                  Next: Map Columns
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ STEP 2: Map Columns ═══ */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="bg-[#141414] rounded-xl border border-[#1e1e1e] p-6">
            <h2 className="text-lg font-semibold text-white mb-2">Map Your Columns</h2>
            <p className="text-sm text-[#888] mb-6">
              We have auto-detected common ClassForKids columns. Review and adjust the mapping below.
            </p>

            <div className="space-y-3">
              {mappings.map((m, idx) => (
                <div key={m.csvHeader} className="flex items-center gap-3">
                  <div className="flex-1 px-3 py-2 bg-[#1a1a1a] border border-[#1e1e1e] rounded-lg text-sm text-white">
                    {m.csvHeader}
                  </div>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                  <select
                    value={m.portalField}
                    onChange={(e) => updateMapping(idx, e.target.value as PortalField)}
                    className={`flex-1 px-3 py-2 bg-[#1a1a1a] border rounded-lg text-sm appearance-none cursor-pointer ${
                      m.portalField === '__skip__'
                        ? 'border-[#1e1e1e] text-[#888]'
                        : 'border-[#4ecde6]/30 text-white'
                    }`}
                  >
                    {PORTAL_FIELDS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {!canProceedToStep3 && (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
                You must map both First Name and Last Name to proceed.
              </div>
            )}
          </div>

          {/* Preview */}
          {mappedPreview.length > 0 && (
            <div className="bg-[#141414] rounded-xl border border-[#1e1e1e] p-6">
              <h3 className="text-sm font-semibold text-white mb-3">Preview (first 5 rows)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#1e1e1e]">
                      {mappings
                        .filter((m) => m.portalField !== '__skip__')
                        .map((m) => (
                          <th key={m.portalField} className="text-left py-2 font-medium text-[#888] pr-4">
                            {PORTAL_FIELDS.find((f) => f.value === m.portalField)?.label || m.portalField}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {mappedPreview.map((row, idx) => (
                      <tr key={idx} className="border-b border-[#1e1e1e] last:border-0">
                        {mappings
                          .filter((m) => m.portalField !== '__skip__')
                          .map((m) => (
                            <td key={m.portalField} className="py-2 text-white pr-4">
                              {row[m.portalField] || <span className="text-[#888]">--</span>}
                            </td>
                          ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-between">
            <button
              onClick={() => setStep(1)}
              className="px-5 py-2.5 bg-[#1a1a1a] text-white border border-[#1e1e1e] rounded-lg text-sm font-medium hover:bg-[#222] transition-colors"
            >
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!canProceedToStep3}
              className="px-5 py-2.5 bg-[#4ecde6] text-black rounded-lg text-sm font-semibold hover:bg-[#4ecde6]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next: Review & Import
            </button>
          </div>
        </div>
      )}

      {/* ═══ STEP 3: Import ═══ */}
      {step === 3 && (
        <div className="space-y-6">
          {!stats && (
            <>
              <div className="bg-[#141414] rounded-xl border border-[#1e1e1e] p-6">
                <h2 className="text-lg font-semibold text-white mb-2">Ready to Import</h2>
                <p className="text-sm text-[#888] mb-6">
                  Review the summary below and start your import.
                </p>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div className="p-4 bg-[#4ecde6]/5 border border-[#4ecde6]/20 rounded-xl">
                    <div className="text-2xl font-bold text-[#4ecde6]">{totalRows}</div>
                    <div className="text-xs text-[#888] mt-1">Players</div>
                  </div>
                  <div className="p-4 bg-[#4ecde6]/5 border border-[#4ecde6]/20 rounded-xl">
                    <div className="text-2xl font-bold text-[#4ecde6]">
                      {new Set(getMappedRows().map((r) => r.parent_email).filter(Boolean)).size}
                    </div>
                    <div className="text-xs text-[#888] mt-1">Parents</div>
                  </div>
                  <div className="p-4 bg-[#4ecde6]/5 border border-[#4ecde6]/20 rounded-xl">
                    <div className="text-2xl font-bold text-[#4ecde6]">
                      {new Set([
                        ...getMappedRows().map((r) => r.group_name).filter(Boolean),
                        ...getClassNames(),
                      ]).size}
                    </div>
                    <div className="text-xs text-[#888] mt-1">Classes</div>
                  </div>
                  <div className="p-4 bg-[#4ecde6]/5 border border-[#4ecde6]/20 rounded-xl">
                    <div className="text-2xl font-bold text-[#4ecde6]">
                      {mappings.filter((m) => m.portalField !== '__skip__').length}
                    </div>
                    <div className="text-xs text-[#888] mt-1">Fields Mapped</div>
                  </div>
                </div>

                {/* Welcome emails option */}
                <div className="mt-6 pt-4 border-t border-[#1e1e1e]">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sendWelcomeEmails}
                      onChange={(e) => setSendWelcomeEmails(e.target.checked)}
                      className="w-4 h-4 rounded border-[#1e1e1e] bg-[#1a1a1a] text-[#4ecde6] focus:ring-[#4ecde6] focus:ring-offset-0"
                    />
                    <div>
                      <span className="text-sm text-white font-medium">Send welcome emails to imported parents</span>
                      <p className="text-xs text-[#888]">
                        Parents will receive an invitation to create their Player Portal account
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => setStep(2)}
                  disabled={importing}
                  className="px-5 py-2.5 bg-[#1a1a1a] text-white border border-[#1e1e1e] rounded-lg text-sm font-medium hover:bg-[#222] disabled:opacity-50 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={startImport}
                  disabled={importing}
                  className="px-6 py-2.5 bg-emerald-500 text-white rounded-lg text-sm font-semibold hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {importing ? 'Importing...' : 'Start Import'}
                </button>
              </div>
            </>
          )}

          {/* Progress Bar */}
          {importing && (
            <div className="bg-[#141414] rounded-xl border border-[#1e1e1e] p-6">
              <div className="flex items-center justify-between text-sm mb-3">
                <span className="text-white font-medium">Importing your data...</span>
                <span className="text-[#888]">{progress}%</span>
              </div>
              <div className="w-full bg-[#1a1a1a] rounded-full h-2.5">
                <div
                  className="bg-[#4ecde6] h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-[#888] mt-2">
                Please do not close this page while the import is running.
              </p>
            </div>
          )}

          {/* Results */}
          {stats && (
            <div className="space-y-6">
              <div className="bg-[#141414] rounded-xl border border-[#1e1e1e] p-6">
                <h2 className="text-lg font-semibold text-white mb-4">Import Complete</h2>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                  <div className="p-4 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                    <div className="text-2xl font-bold text-emerald-400">{stats.players_imported}</div>
                    <div className="text-xs text-emerald-500">Players Imported</div>
                  </div>
                  <div className="p-4 bg-yellow-500/10 rounded-xl border border-yellow-500/20">
                    <div className="text-2xl font-bold text-yellow-400">{stats.players_skipped}</div>
                    <div className="text-xs text-yellow-500">Duplicates Skipped</div>
                  </div>
                  <div className="p-4 bg-blue-500/10 rounded-xl border border-blue-500/20">
                    <div className="text-2xl font-bold text-blue-400">{stats.parents_created}</div>
                    <div className="text-xs text-blue-500">Parents Created</div>
                  </div>
                  <div className="p-4 bg-purple-500/10 rounded-xl border border-purple-500/20">
                    <div className="text-2xl font-bold text-purple-400">{stats.groups_created}</div>
                    <div className="text-xs text-purple-500">Groups Created</div>
                  </div>
                  <div className="p-4 bg-red-500/10 rounded-xl border border-red-500/20">
                    <div className="text-2xl font-bold text-red-400">{stats.errors.length}</div>
                    <div className="text-xs text-red-500">Errors</div>
                  </div>
                </div>

                {stats.errors.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-sm font-medium text-white mb-2">Error Details</h3>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {stats.errors.map((err, idx) => (
                        <div key={idx} className="text-sm text-red-400 bg-red-500/10 px-3 py-1.5 rounded">
                          Row {err.row}: {err.error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <a
                  href="/dashboard/players"
                  className="px-5 py-2.5 bg-[#4ecde6] text-black rounded-lg text-sm font-semibold hover:bg-[#4ecde6]/90 transition-colors"
                >
                  View Players
                </a>
                <a
                  href="/dashboard/players/import/migrate"
                  className="px-5 py-2.5 bg-[#1a1a1a] text-white border border-[#1e1e1e] rounded-lg text-sm font-medium hover:bg-[#222] transition-colors"
                >
                  Import More
                </a>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
