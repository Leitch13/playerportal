'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'

interface GroupOption {
  id: string
  name: string
  day: string | null
  time: string | null
}
interface PlanOption {
  id: string
  name: string
  amount: number
  sessionsPerWeek: number
}
interface ExistingInvitation {
  id: string
  status: string
  inviteSentAt: string | null
  inviteConfirmedAt: string | null
  childName: string
  planName: string
  planAmount: number
}

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

type WizardStep = 'upload' | 'map' | 'review' | 'done'

// Migration Safety Phase 1 — chunk size for the bulk import. Each chunk is one
// HTTP request to /api/migration/import. Keeping it small (≤10 rows) means
// each call comfortably finishes within Vercel's per-function budget even with
// Supabase auth signup latency, and a network hiccup loses at most 10 rows of
// progress (the route is idempotent, so re-running the same CSV later picks
// up where we left off).
const IMPORT_CHUNK_SIZE = 10
// Match the chunk size for invitations so per-batch Resend time stays bounded.
const EMAIL_CHUNK_SIZE = 10

interface ConflictRow {
  row: number
  email: string
  existingAcademyId: string
  existingAcademyName: string
  reason: string
}

interface ImportError {
  row: number
  email?: string
  error: string
}

interface InvitationPayload {
  email: string
  parentName: string
  childName: string
  token: string
  planAmount: number
  planName: string
}

interface WarningRow {
  row: number
  email: string
  childName: string
  existingPlayerId: string
  existingDOB: string | null
  csvDOB: string | null
  reason: string
}

interface ImportSummary {
  imported: number
  skipped: number
  conflicts: ConflictRow[]
  warnings: WarningRow[]
  errors: ImportError[]
  invitations: InvitationPayload[]
}

interface SendResult {
  email: string
  token: string
  sent: boolean
  error?: string
}

const HEADER_ALIASES: Record<string, string> = {
  'first_name': 'first_name', 'firstname': 'first_name', 'first name': 'first_name',
  'childfirstname': 'first_name', 'playerfirstname': 'first_name',
  'last_name': 'last_name', 'lastname': 'last_name', 'last name': 'last_name', 'surname': 'last_name',
  'childsurname': 'last_name', 'childlastname': 'last_name', 'playerlastname': 'last_name',
  'dob': 'date_of_birth', 'date of birth': 'date_of_birth', 'date_of_birth': 'date_of_birth',
  'childdateofbirth': 'date_of_birth', 'birthday': 'date_of_birth',
  'age_group': 'age_group', 'agegroup': 'age_group', 'age group': 'age_group', 'age': 'age_group',
  'parent_email': 'parent_email', 'parentemail': 'parent_email', 'parent email': 'parent_email', 'email': 'parent_email',
  'username': 'parent_email', 'contactid': 'parent_email',
  'parent_name': 'parent_name', 'parentname': 'parent_name', 'parent': 'parent_name', 'guardian': 'parent_name',
  'parentfirstname': '_parent_first', 'parentlastname': '_parent_last',
  'parent_phone': 'parent_phone', 'parentphone': 'parent_phone', 'phone': 'parent_phone', 'mobile': 'parent_phone',
  'group_name': 'group_name', 'groupname': 'group_name', 'class': 'group_name', 'team': 'group_name',
  'inprogramme': 'group_name', 'programme': 'group_name',
  'medical_info': 'medical_info', 'medical': 'medical_info', 'allergies': 'medical_info',
  'name': '_full_name', 'childname': '_full_name', 'child name': '_full_name',
}

function splitCSVLines(text: string): string[] {
  const lines: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') { inQuotes = !inQuotes; current += ch }
    else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (current.trim()) lines.push(current)
      current = ''
      if (ch === '\r' && i + 1 < text.length && text[i + 1] === '\n') i++
    } else { current += ch }
  }
  if (current.trim()) lines.push(current)
  return lines
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current); current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

function parseCSV(text: string): ParsedRow[] {
  const clean = text.replace(/^\uFEFF/, '')
  const lines = splitCSVLines(clean)
  if (lines.length < 2) return []
  const rawHeaders = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase().replace(/['"]/g, ''))
  const headers = rawHeaders.map((h) => HEADER_ALIASES[h] || h)
  const rows: ParsedRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    if (values.every((v) => !v.trim())) continue
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => { row[h] = (values[idx] || '').trim().replace(/^"|"$/g, '') })
    if (row._full_name && !row.first_name) {
      const parts = row._full_name.split(/\s+/)
      row.first_name = parts[0] || ''
      row.last_name = parts.slice(1).join(' ')
    }
    if (row._parent_first && !row.parent_name) {
      row.parent_name = `${row._parent_first} ${row._parent_last || ''}`.trim()
    }
    rows.push({
      first_name: row.first_name || '',
      last_name: row.last_name || '',
      date_of_birth: row.date_of_birth || '',
      age_group: row.age_group || '',
      parent_email: row.parent_email || '',
      parent_name: row.parent_name || '',
      parent_phone: row.parent_phone || '',
      group_name: row.group_name || '',
      medical_info: row.medical_info || '',
    })
  }
  return rows
}

function SummaryStat({
  label,
  value,
  accent,
}: {
  label: string
  value: number
  accent: 'emerald' | 'amber' | 'rose' | 'cyan' | 'white'
}) {
  const colour = {
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
    rose: 'text-rose-400',
    cyan: 'text-[#4ecde6]',
    white: 'text-white',
  }[accent]
  return (
    <div className="bg-[#0a0a0a] border border-[#1e1e1e] rounded-xl p-4">
      <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold mb-1">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${colour}`}>{value}</p>
    </div>
  )
}

export default function MigrationWizard({
  orgId,
  groups,
  plans,
  existingInvitations,
}: {
  orgId: string
  groups: GroupOption[]
  plans: PlanOption[]
  existingInvitations: ExistingInvitation[]
}) {
  const router = useRouter()
  const [step, setStep] = useState<WizardStep>(existingInvitations.length > 0 ? 'done' : 'upload')
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [fileName, setFileName] = useState('')
  const [mapping, setMapping] = useState<Record<string, { groupId: string | null; planId: string | null }>>({})
  // Optional: if these members have already prepaid (e.g. via ClassForKids),
  // set the date their existing payment runs out so we don't charge them again
  // on confirm — Stripe defers the first charge to this date.
  const [billingStartsAt, setBillingStartsAt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  // Migration Safety Phase 1 — aggregated summary across all chunked POSTs.
  const [result, setResult] = useState<ImportSummary | null>(null)
  // Progress shown during chunked import: "Imported 20 of 80".
  const [progress, setProgress] = useState<{ done: number; total: number; phase: 'idle' | 'importing' | 'sending' }>({ done: 0, total: 0, phase: 'idle' })
  // Per-recipient send results, populated by the Send Invitations step.
  const [sendResults, setSendResults] = useState<SendResult[]>([])
  const [sending, setSending] = useState(false)
  // If a chunk fails fatally we stop and surface the error here.
  const [fatalError, setFatalError] = useState<string | null>(null)

  // Unique class names from the CSV
  const uniqueClasses = useMemo(() => {
    const counts = new Map<string, number>()
    for (const r of rows) {
      const key = (r.group_name || '(unmapped)').trim()
      counts.set(key, (counts.get(key) || 0) + 1)
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }))
  }, [rows])

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const text = await file.text()
    const parsed = parseCSV(text)
    setRows(parsed)
    // Auto-initialise mapping slots
    const init: Record<string, { groupId: string | null; planId: string | null }> = {}
    for (const r of parsed) {
      const key = (r.group_name || '(unmapped)').trim()
      if (!init[key]) init[key] = { groupId: null, planId: null }
    }
    setMapping(init)
    setStep('map')
  }

  /**
   * Migration Safety Phase 1 — chunked import.
   *
   * Splits the CSV rows into chunks of IMPORT_CHUNK_SIZE and POSTs each chunk
   * sequentially to /api/migration/import. The server route is idempotent
   * per-row (SELECT-before-INSERT on profiles/players/enrolments/subscriptions),
   * so chunking is safe — any chunk that fails can be re-run later by
   * uploading the same CSV again; already-imported rows are skipped.
   *
   * Aggregates imported / skipped / conflicts / errors / invitations across
   * all chunks into a single summary. Fatal chunk failures (non-200 response)
   * stop processing and surface to the admin via fatalError state.
   */
  async function handleSubmit() {
    setSubmitting(true)
    setFatalError(null)
    setSendResults([])

    const chunks: ParsedRow[][] = []
    for (let i = 0; i < rows.length; i += IMPORT_CHUNK_SIZE) {
      chunks.push(rows.slice(i, i + IMPORT_CHUNK_SIZE))
    }

    setProgress({ done: 0, total: rows.length, phase: 'importing' })

    const aggregate: ImportSummary = {
      imported: 0,
      skipped: 0,
      conflicts: [],
      warnings: [],
      errors: [],
      invitations: [],
    }

    let processedRows = 0
    let stopped = false

    for (let ci = 0; ci < chunks.length; ci++) {
      const chunk = chunks[ci]
      try {
        const res = await fetch('/api/migration/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rows: chunk,
            classMap: mapping,
            billingStartsAt: billingStartsAt || null,
          }),
        })
        const data = await res.json()
        if (!res.ok) {
          setFatalError(`Chunk ${ci + 1}/${chunks.length} failed: ${data.error || `HTTP ${res.status}`}`)
          stopped = true
          break
        }
        const s: ImportSummary = data.summary
        // Re-offset row numbers in conflicts/warnings/errors so they map to
        // the original CSV row, not the chunk-local row.
        const offset = ci * IMPORT_CHUNK_SIZE
        for (const c of s.conflicts) aggregate.conflicts.push({ ...c, row: c.row + offset })
        for (const w of (s.warnings || [])) aggregate.warnings.push({ ...w, row: w.row + offset })
        for (const e of s.errors) aggregate.errors.push({ ...e, row: e.row + offset })
        aggregate.imported += s.imported
        aggregate.skipped += s.skipped
        aggregate.invitations.push(...s.invitations)

        processedRows += chunk.length
        setProgress({ done: processedRows, total: rows.length, phase: 'importing' })
      } catch (err) {
        setFatalError(`Network error on chunk ${ci + 1}/${chunks.length}: ${err instanceof Error ? err.message : String(err)}`)
        stopped = true
        break
      }
    }

    setResult(aggregate)
    setSubmitting(false)
    setProgress({ done: processedRows, total: rows.length, phase: 'idle' })

    if (!stopped) setStep('done')
  }

  /**
   * Sends invitations in chunks of EMAIL_CHUNK_SIZE. Called by admin AFTER
   * reviewing the import summary (so conflicts are visible BEFORE emails go
   * out). Returns per-recipient sent/failed for transparency.
   */
  async function handleSendInvitations() {
    if (!result || result.invitations.length === 0) return
    setSending(true)
    setProgress({ done: 0, total: result.invitations.length, phase: 'sending' })

    // orgId is passed in by the parent server component (it's already loaded
    // there from profile.organisation_id). The server route additionally
    // validates that the caller's admin org matches this payload.

    const allResults: SendResult[] = []
    let processed = 0
    const chunks: InvitationPayload[][] = []
    for (let i = 0; i < result.invitations.length; i += EMAIL_CHUNK_SIZE) {
      chunks.push(result.invitations.slice(i, i + EMAIL_CHUNK_SIZE))
    }

    for (const c of chunks) {
      try {
        const res = await fetch('/api/email/migration-invite-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orgId, invitations: c }),
        })
        const data = await res.json()
        if (Array.isArray(data?.results)) allResults.push(...data.results)
        processed += c.length
        setProgress({ done: processed, total: result.invitations.length, phase: 'sending' })
      } catch (err) {
        // Network error on this chunk — record every invitation in the chunk
        // as failed and continue.
        const msg = err instanceof Error ? err.message : String(err)
        for (const inv of c) allResults.push({ email: inv.email, token: inv.token, sent: false, error: `Network: ${msg}` })
      }
    }

    setSendResults(allResults)
    setSending(false)
    setProgress({ done: processed, total: result.invitations.length, phase: 'idle' })
  }

  /**
   * Download a CSV of conflicts + errors so admin can act on them without
   * inspecting browser devtools.
   */
  function downloadIssuesCSV() {
    if (!result) return
    const lines = ['type,row,email,reason']
    for (const c of result.conflicts) {
      lines.push([
        'conflict',
        String(c.row),
        csvEscape(c.email),
        csvEscape(c.reason),
      ].join(','))
    }
    for (const w of result.warnings) {
      lines.push([
        'warning_dob_mismatch',
        String(w.row),
        csvEscape(w.email),
        csvEscape(w.reason),
      ].join(','))
    }
    for (const e of result.errors) {
      lines.push([
        'error',
        String(e.row),
        csvEscape(e.email || ''),
        csvEscape(e.error),
      ].join(','))
    }
    for (const r of sendResults.filter((r) => !r.sent)) {
      lines.push([
        'email_failed',
        '',
        csvEscape(r.email),
        csvEscape(r.error || 'unknown'),
      ].join(','))
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `migration-issues-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  function csvEscape(s: string): string {
    if (s == null) return ''
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }

  const mappedCount = Object.values(mapping).filter((m) => m.groupId && m.planId).length
  const readyToImport = mappedCount > 0 && rows.length > 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Migration Wizard</h1>
        <p className="text-sm text-white/50 mt-1">
          Bulk-import players from ClassForKids (or similar) and send parents one-click subscription invitations.
        </p>
      </div>

      {/* Step indicator */}
      {/* Mobile Polish: 4 steps × ~110px each overflows at 375px. Hide labels
          below sm; on small screens the circle (current step is brand-coloured)
          plus the connector lines communicate progress on their own. */}
      <div className="flex items-center gap-2 sm:gap-2">
        {(['upload', 'map', 'review', 'done'] as WizardStep[]).map((s, i) => (
          <div key={s} className="flex items-center gap-1.5 sm:gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
              step === s ? 'bg-[#4ecde6] text-[#0a0a0a]'
                : (['upload', 'map', 'review', 'done'].indexOf(step) > i) ? 'bg-emerald-500 text-white'
                : 'bg-white/5 text-white/40'
            }`}>{i + 1}</div>
            <span className={`hidden sm:inline text-xs font-medium capitalize ${step === s ? 'text-white' : 'text-white/50'}`}>{s}</span>
            {/* Current-step label visible on mobile too, so users know where they are */}
            {step === s && <span className="sm:hidden text-xs font-medium capitalize text-white">{s}</span>}
            {i < 3 && <div className="w-3 sm:w-4 h-px bg-white/10 shrink-0" />}
          </div>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] p-8 text-center">
          <div className="text-4xl mb-3">📥</div>
          <h2 className="text-lg font-bold text-white mb-2">Upload your player CSV</h2>
          <p className="text-sm text-white/50 max-w-md mx-auto mb-6">
            Export your player list from ClassForKids (or any system). We&apos;ll auto-detect the columns.
            Supports ClassForKids format out of the box.
          </p>
          <label className="inline-block px-6 py-3 rounded-full bg-[#4ecde6] text-[#0a0a0a] font-bold text-sm cursor-pointer hover:bg-[#7dddf0] transition-colors">
            Choose CSV file
            <input type="file" accept=".csv" onChange={onFileChange} className="hidden" />
          </label>
          {fileName && <p className="text-xs text-white/40 mt-3">Selected: {fileName}</p>}
        </div>
      )}

      {/* Step 2: Map classes */}
      {step === 'map' && (
        <div className="space-y-4">
          <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-bold text-white">Map each source class to a Player Portal class + plan</h2>
                <p className="text-xs text-white/50 mt-1">
                  Found <strong className="text-white">{rows.length} players</strong> across <strong className="text-white">{uniqueClasses.length} classes</strong>.
                </p>
              </div>
              <span className="text-xs text-white/50">
                Mapped: <strong className="text-[#4ecde6]">{mappedCount}</strong>/{uniqueClasses.length}
              </span>
            </div>

            {uniqueClasses.length === 0 && (
              <p className="text-sm text-white/40">No classes detected. Make sure your CSV has an &ldquo;inprogramme&rdquo; or &ldquo;class&rdquo; column.</p>
            )}

            <div className="space-y-2">
              {uniqueClasses.map((uc) => {
                const m = mapping[uc.name] || { groupId: null, planId: null }
                return (
                  <div key={uc.name} className="bg-[#0a0a0a] border border-[#1e1e1e] rounded-xl p-3 grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_1fr] gap-2 items-center">
                    <div>
                      <p className="text-sm font-semibold text-white">{uc.name || '(no class)'}</p>
                      <p className="text-[11px] text-white/40">{uc.count} player{uc.count !== 1 ? 's' : ''}</p>
                    </div>
                    <span className="hidden md:block text-white/30">→</span>
                    <select
                      value={m.groupId || ''}
                      onChange={(e) => setMapping({ ...mapping, [uc.name]: { ...m, groupId: e.target.value || null } })}
                      className="bg-[#141414] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs text-white"
                    >
                      <option value="">— Choose class —</option>
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name} {g.day ? `· ${g.day}` : ''}
                        </option>
                      ))}
                    </select>
                    <select
                      value={m.planId || ''}
                      onChange={(e) => setMapping({ ...mapping, [uc.name]: { ...m, planId: e.target.value || null } })}
                      className="bg-[#141414] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs text-white"
                    >
                      <option value="">— Choose plan —</option>
                      {plans.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} · £{p.amount.toFixed(0)}/mo
                        </option>
                      ))}
                    </select>
                  </div>
                )
              })}
            </div>
          </div>

          {mappedCount < uniqueClasses.length && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-300">
              ⚠️ {uniqueClasses.length - mappedCount} class{uniqueClasses.length - mappedCount !== 1 ? 'es' : ''} still unmapped.
              Unmapped players will be imported without a subscription — you can fix them individually later.
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => setStep('upload')}
              className="px-5 py-2.5 rounded-full text-sm text-white/60 hover:text-white border border-white/10 hover:border-white/20 transition-colors"
            >
              ← Back
            </button>
            <button
              onClick={() => setStep('review')}
              disabled={!readyToImport}
              className="px-6 py-2.5 rounded-full text-sm font-bold bg-[#4ecde6] text-[#0a0a0a] hover:bg-[#7dddf0] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Continue to review →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Review & confirm */}
      {step === 'review' && (
        <div className="space-y-4">
          <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] p-6">
            <h2 className="font-bold text-white mb-4">Review before importing</h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <div className="bg-[#0a0a0a] border border-[#1e1e1e] rounded-xl p-4">
                <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold mb-1">Players</p>
                <p className="text-2xl font-bold text-white">{rows.length}</p>
              </div>
              <div className="bg-[#0a0a0a] border border-[#1e1e1e] rounded-xl p-4">
                <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold mb-1">Classes mapped</p>
                <p className="text-2xl font-bold text-[#4ecde6]">{mappedCount}</p>
              </div>
              <div className="bg-[#0a0a0a] border border-[#1e1e1e] rounded-xl p-4">
                <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold mb-1">Pending invites</p>
                <p className="text-2xl font-bold text-emerald-400">{rows.filter((r) => mapping[r.group_name]?.planId).length}</p>
              </div>
              <div className="bg-[#0a0a0a] border border-[#1e1e1e] rounded-xl p-4">
                <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold mb-1">Potential MRR</p>
                <p className="text-2xl font-bold text-white">
                  £{rows.reduce((sum, r) => {
                    const m = mapping[r.group_name]
                    if (!m?.planId) return sum
                    return sum + (plans.find((p) => p.id === m.planId)?.amount || 0)
                  }, 0).toFixed(0)}
                </p>
              </div>
            </div>

            <div className="py-3 px-4 rounded-xl border border-[#4ecde6]/30 bg-[#4ecde6]/[0.05]">
              <p className="text-sm font-semibold text-[#4ecde6] mb-1">Two-step send</p>
              <p className="text-[11px] text-white/60">
                Invitation emails are <strong>not</strong> sent during this import. After the
                import finishes you&apos;ll see a summary including any cross-academy conflicts —
                review those first, then click <strong>&ldquo;Send invitations&rdquo;</strong> on
                the done screen to email parents.
              </p>
            </div>

            <div className="mt-3 py-3 px-4 rounded-xl border border-[#1e1e1e] bg-[#0a0a0a]">
              <p className="text-sm font-semibold text-white mb-1">Already paid you for the current term?</p>
              <p className="text-[11px] text-white/50 mb-2.5">
                If these members have already prepaid (e.g. via ClassForKids), set the date their
                current payment runs out. They&apos;ll be charged £0 on confirm and billed from this
                date instead — no double-charge. Leave blank to bill from confirmation.
              </p>
              <input
                type="date"
                value={billingStartsAt}
                min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
                onChange={(e) => setBillingStartsAt(e.target.value)}
                className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl bg-[#141414] border border-[#1e1e1e] text-white text-sm focus:outline-none focus:border-[#4ecde6]/40 [color-scheme:dark]"
              />
            </div>

            <div className="mt-5 bg-[#4ecde6]/5 border border-[#4ecde6]/15 rounded-xl p-4 text-xs text-white/70">
              <p className="font-semibold text-[#4ecde6] uppercase tracking-wider text-[10px] mb-1">What happens next</p>
              <ul className="space-y-1 pl-4 list-disc">
                <li>Rows are imported in chunks of {IMPORT_CHUNK_SIZE} (progress shown live)</li>
                <li>Each new parent + player + enrolment + pending subscription is created</li>
                <li>Cross-academy collisions are flagged as conflicts and skipped — no profile is moved</li>
                <li>You review the summary, then explicitly click &ldquo;Send invitations&rdquo;</li>
              </ul>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => setStep('map')}
              disabled={submitting}
              className="px-5 py-2.5 rounded-full text-sm text-white/60 hover:text-white border border-white/10 hover:border-white/20 transition-colors disabled:opacity-50"
            >
              ← Back to mapping
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-8 py-3 rounded-full text-sm font-bold bg-[#4ecde6] text-[#0a0a0a] hover:bg-[#7dddf0] disabled:opacity-50 transition-colors"
            >
              {submitting
                ? `Importing ${progress.done}/${progress.total}…`
                : `Import ${rows.length} players (chunked, no emails yet)`}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Done */}
      {step === 'done' && (
        <div className="space-y-4">
          {fatalError && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 text-sm text-rose-300">
              <p className="font-semibold text-rose-200 mb-1">Import stopped</p>
              <p>{fatalError}</p>
              <p className="mt-2 text-xs text-rose-300/70">
                The successfully imported rows are saved. Re-upload the same CSV later to
                resume — already-imported rows will be skipped.
              </p>
            </div>
          )}

          {result && (
            <>
              {/* Import summary stat grid — Mobile Polish: flow 2→3→6 with an
                  `sm` intermediate so 6 tiles don't crunch at narrow widths. */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                <SummaryStat label="Imported" value={result.imported} accent="emerald" />
                <SummaryStat label="Skipped" value={result.skipped} accent="white" />
                <SummaryStat label="Conflicts" value={result.conflicts.length} accent={result.conflicts.length > 0 ? 'amber' : 'white'} />
                <SummaryStat label="DOB warnings" value={result.warnings.length} accent={result.warnings.length > 0 ? 'amber' : 'white'} />
                <SummaryStat label="Errors" value={result.errors.length} accent={result.errors.length > 0 ? 'rose' : 'white'} />
                <SummaryStat label="Pending invites" value={result.invitations.length} accent="cyan" />
              </div>

              {/* Send invitations panel — visible only when there are pending invites */}
              {result.invitations.length > 0 && sendResults.length === 0 && (
                <div className="bg-[#0e1820] border border-[#4ecde6]/25 rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#4ecde6]">
                        {result.invitations.length} parent{result.invitations.length !== 1 ? 's' : ''} ready to be emailed
                      </p>
                      <p className="text-xs text-white/60 mt-1 max-w-lg">
                        Review the conflicts table below first. When you&apos;re ready, click
                        Send to email parents in chunks of {EMAIL_CHUNK_SIZE}. Each successful
                        send is tracked immediately so partial batches never re-send.
                      </p>
                    </div>
                    <button
                      onClick={handleSendInvitations}
                      disabled={sending}
                      className="px-5 py-2.5 rounded-full text-sm font-bold bg-[#4ecde6] text-[#0a0a0a] hover:bg-[#7dddf0] disabled:opacity-50"
                    >
                      {sending ? `Sending ${progress.done}/${progress.total}…` : `Send ${result.invitations.length} invitations`}
                    </button>
                  </div>
                </div>
              )}

              {/* Send results panel — appears after Send Invitations runs */}
              {sendResults.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <SummaryStat label="Emails sent" value={sendResults.filter((r) => r.sent).length} accent="emerald" />
                  <SummaryStat label="Emails failed" value={sendResults.filter((r) => !r.sent).length} accent={sendResults.some((r) => !r.sent) ? 'rose' : 'white'} />
                </div>
              )}

              {/* Conflicts table */}
              {result.conflicts.length > 0 && (
                <div className="bg-amber-500/5 border border-amber-500/25 rounded-2xl p-5">
                  <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                    <h3 className="text-sm font-semibold text-amber-200">
                      Cross-academy conflicts ({result.conflicts.length})
                    </h3>
                    <button
                      onClick={downloadIssuesCSV}
                      className="text-xs font-semibold text-amber-300 hover:text-amber-200 underline"
                    >
                      Download issues CSV
                    </button>
                  </div>
                  <p className="text-xs text-white/60 mb-3">
                    These parent emails already exist in another academy. Their profile was
                    NOT moved and no player/subscription was created. Handle each manually via
                    Migrate Member or ask support.
                  </p>
                  <div className="max-h-64 overflow-auto -mx-2 sm:mx-0">
                    <table className="w-full text-xs min-w-[560px]">
                      <thead className="text-[10px] uppercase tracking-wider text-white/40">
                        <tr>
                          <th className="text-left py-1.5 px-2 font-semibold">Row</th>
                          <th className="text-left py-1.5 px-2 font-semibold">Email</th>
                          <th className="text-left py-1.5 px-2 font-semibold">Existing academy</th>
                          <th className="text-left py-1.5 px-2 font-semibold">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.conflicts.map((c) => (
                          <tr key={`${c.row}-${c.email}`} className="border-t border-white/5">
                            <td className="py-1.5 px-2 text-white/60">{c.row}</td>
                            <td className="py-1.5 px-2 text-white">{c.email}</td>
                            <td className="py-1.5 px-2 text-amber-200">{c.existingAcademyName}</td>
                            <td className="py-1.5 px-2 text-white/50">Migrate manually</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* DOB warnings table */}
              {result.warnings.length > 0 && (
                <div className="bg-amber-500/5 border border-amber-500/25 rounded-2xl p-5">
                  <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                    <h3 className="text-sm font-semibold text-amber-200">
                      DOB mismatches ({result.warnings.length})
                    </h3>
                    <button
                      onClick={downloadIssuesCSV}
                      className="text-xs font-semibold text-amber-300 hover:text-amber-200 underline"
                    >
                      Download issues CSV
                    </button>
                  </div>
                  <p className="text-xs text-white/60 mb-3">
                    These rows match an existing child by name and parent, but the DOB in
                    the CSV differs from the DOB on file. The row was skipped — no player,
                    enrolment, or subscription was created. Could be a typo, a corrected DOB,
                    or a sibling with the same name. Handle each manually via Migrate Member.
                  </p>
                  <div className="max-h-64 overflow-auto -mx-2 sm:mx-0">
                    <table className="w-full text-xs min-w-[620px]">
                      <thead className="text-[10px] uppercase tracking-wider text-white/40">
                        <tr>
                          <th className="text-left py-1.5 px-2 font-semibold">Row</th>
                          <th className="text-left py-1.5 px-2 font-semibold">Email</th>
                          <th className="text-left py-1.5 px-2 font-semibold">Child</th>
                          <th className="text-left py-1.5 px-2 font-semibold">DB DOB</th>
                          <th className="text-left py-1.5 px-2 font-semibold">CSV DOB</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.warnings.map((w) => (
                          <tr key={`${w.row}-${w.existingPlayerId}`} className="border-t border-white/5">
                            <td className="py-1.5 px-2 text-white/60">{w.row}</td>
                            <td className="py-1.5 px-2 text-white">{w.email}</td>
                            <td className="py-1.5 px-2 text-white">{w.childName}</td>
                            <td className="py-1.5 px-2 text-amber-200">{w.existingDOB || '—'}</td>
                            <td className="py-1.5 px-2 text-amber-200">{w.csvDOB || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Errors table */}
              {result.errors.length > 0 && (
                <div className="bg-rose-500/5 border border-rose-500/25 rounded-2xl p-5">
                  <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                    <h3 className="text-sm font-semibold text-rose-200">Errors ({result.errors.length})</h3>
                    <button
                      onClick={downloadIssuesCSV}
                      className="text-xs font-semibold text-rose-300 hover:text-rose-200 underline"
                    >
                      Download issues CSV
                    </button>
                  </div>
                  <div className="max-h-64 overflow-auto -mx-2 sm:mx-0">
                    <table className="w-full text-xs min-w-[520px]">
                      <thead className="text-[10px] uppercase tracking-wider text-white/40">
                        <tr>
                          <th className="text-left py-1.5 px-2 font-semibold">Row</th>
                          <th className="text-left py-1.5 px-2 font-semibold">Email</th>
                          <th className="text-left py-1.5 px-2 font-semibold">Error</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.errors.map((e, i) => (
                          <tr key={`${e.row}-${i}`} className="border-t border-white/5">
                            <td className="py-1.5 px-2 text-white/60">{e.row}</td>
                            <td className="py-1.5 px-2 text-white/80">{e.email || '—'}</td>
                            <td className="py-1.5 px-2 text-rose-200 font-mono text-[11px]">{e.error}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Send-failed table */}
              {sendResults.some((r) => !r.sent) && (
                <div className="bg-rose-500/5 border border-rose-500/25 rounded-2xl p-5">
                  <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                    <h3 className="text-sm font-semibold text-rose-200">
                      Failed email sends ({sendResults.filter((r) => !r.sent).length})
                    </h3>
                  </div>
                  <div className="max-h-64 overflow-auto -mx-2 sm:mx-0">
                    <table className="w-full text-xs min-w-[480px]">
                      <thead className="text-[10px] uppercase tracking-wider text-white/40">
                        <tr>
                          <th className="text-left py-1.5 px-2 font-semibold">Email</th>
                          <th className="text-left py-1.5 px-2 font-semibold">Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sendResults.filter((r) => !r.sent).map((r, i) => (
                          <tr key={`${r.token}-${i}`} className="border-t border-white/5">
                            <td className="py-1.5 px-2 text-white">{r.email}</td>
                            <td className="py-1.5 px-2 text-rose-200 font-mono text-[11px]">{r.error || 'unknown'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}


          {/* Progress tracker */}
          <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-bold text-white">Invitation Progress</h2>
                <p className="text-xs text-white/50 mt-1">
                  Track which parents have confirmed their subscription.
                </p>
              </div>
              <button
                onClick={() => {
                  setStep('upload')
                  setRows([])
                  setResult(null)
                  setFileName('')
                  setProgress({ done: 0, total: 0, phase: 'idle' })
                  setSendResults([])
                  setFatalError(null)
                }}
                className="px-4 py-2 rounded-full text-xs font-semibold bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-white/10"
              >
                {existingInvitations.length > 0 ? 'Import another batch' : 'Start new migration'}
              </button>
            </div>

            {existingInvitations.length === 0 ? (
              <p className="text-sm text-white/40 py-8 text-center">No migrations yet. Upload a CSV to get started.</p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3 mb-5">
                  <div className="bg-[#0a0a0a] border border-[#1e1e1e] rounded-xl p-3">
                    <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">Confirmed</p>
                    <p className="text-2xl font-bold text-emerald-400">
                      {existingInvitations.filter((i) => i.inviteConfirmedAt).length}
                    </p>
                  </div>
                  <div className="bg-[#0a0a0a] border border-[#1e1e1e] rounded-xl p-3">
                    <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">Pending</p>
                    <p className="text-2xl font-bold text-amber-400">
                      {existingInvitations.filter((i) => !i.inviteConfirmedAt && i.status === 'pending_migration').length}
                    </p>
                  </div>
                  <div className="bg-[#0a0a0a] border border-[#1e1e1e] rounded-xl p-3">
                    <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">Total</p>
                    <p className="text-2xl font-bold text-white">{existingInvitations.length}</p>
                  </div>
                </div>

                <div className="max-h-96 overflow-auto -mx-2 sm:mx-0">
                  <table className="w-full text-sm min-w-[520px]">
                    <thead className="text-[11px] uppercase tracking-wider text-white/40">
                      <tr>
                        <th className="text-left py-2 px-2 font-semibold">Player</th>
                        <th className="text-left py-2 px-2 font-semibold">Plan</th>
                        <th className="text-left py-2 px-2 font-semibold">Invited</th>
                        <th className="text-left py-2 px-2 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {existingInvitations.map((i) => (
                        <tr key={i.id} className="border-t border-white/5">
                          <td className="py-2 px-2 text-white">{i.childName}</td>
                          <td className="py-2 px-2 text-white/60">{i.planName} · £{i.planAmount.toFixed(0)}</td>
                          <td className="py-2 px-2 text-white/50 text-xs">
                            {i.inviteSentAt ? new Date(i.inviteSentAt).toLocaleDateString('en-GB') : '—'}
                          </td>
                          <td className="py-2 px-2">
                            {i.inviteConfirmedAt ? (
                              <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">Confirmed</span>
                            ) : i.status === 'pending_migration' ? (
                              <span className="text-[11px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">Pending</span>
                            ) : (
                              <span className="text-[11px] font-semibold text-white/50 bg-white/5 px-2 py-0.5 rounded-full">{i.status}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          <div className="text-center">
            <button
              onClick={() => router.push('/dashboard/players')}
              className="text-sm text-white/50 hover:text-white"
            >
              View all players →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
