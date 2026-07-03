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

export default function MigrationWizard({
  groups,
  plans,
  existingInvitations,
}: {
  groups: GroupOption[]
  plans: PlanOption[]
  existingInvitations: ExistingInvitation[]
}) {
  const router = useRouter()
  const [step, setStep] = useState<WizardStep>(existingInvitations.length > 0 ? 'done' : 'upload')
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [fileName, setFileName] = useState('')
  const [mapping, setMapping] = useState<Record<string, { groupId: string | null; planId: string | null }>>({})
  const [sendInvitations, setSendInvitations] = useState(true)
  // Optional: if these members have already prepaid (e.g. via ClassForKids),
  // set the date their existing payment runs out so we don't charge them again
  // on confirm — Stripe defers the first charge to this date.
  const [billingStartsAt, setBillingStartsAt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: { row: number; error: string }[]; invitationsQueued: number } | null>(null)

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

  async function handleSubmit() {
    setSubmitting(true)
    try {
      const res = await fetch('/api/migration/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows, classMap: mapping, sendInvitations, billingStartsAt: billingStartsAt || null }),
      })
      const data = await res.json()
      if (res.ok) {
        setResult(data.summary)
        setStep('done')
      } else {
        alert('Import failed: ' + (data.error || 'unknown error'))
      }
    } catch (err) {
      alert('Network error: ' + (err instanceof Error ? err.message : String(err)))
    }
    setSubmitting(false)
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
      <div className="flex items-center gap-2">
        {(['upload', 'map', 'review', 'done'] as WizardStep[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
              step === s ? 'bg-[#4ecde6] text-[#0a0a0a]'
                : (['upload', 'map', 'review', 'done'].indexOf(step) > i) ? 'bg-emerald-500 text-white'
                : 'bg-white/5 text-white/40'
            }`}>{i + 1}</div>
            <span className={`text-xs font-medium capitalize ${step === s ? 'text-white' : 'text-white/50'}`}>{s}</span>
            {i < 3 && <div className="w-4 h-px bg-white/10" />}
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
                <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold mb-1">Invitations</p>
                <p className="text-2xl font-bold text-emerald-400">{sendInvitations ? rows.filter((r) => mapping[r.group_name]?.planId).length : 0}</p>
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

            <label className="flex items-center gap-3 cursor-pointer select-none py-3 px-4 rounded-xl border border-[#1e1e1e] bg-[#0a0a0a]">
              <input
                type="checkbox"
                checked={sendInvitations}
                onChange={(e) => setSendInvitations(e.target.checked)}
                className="w-4 h-4 accent-[#4ecde6]"
              />
              <div>
                <p className="text-sm font-semibold text-white">Send invitation emails immediately</p>
                <p className="text-[11px] text-white/50">
                  Parents get a branded email with a one-click link to confirm their payment details.
                  Their subscription only activates once they click and complete Stripe checkout.
                </p>
              </div>
            </label>

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
                <li>All {rows.length} players are created with their parent accounts</li>
                <li>Each is enrolled in the mapped class</li>
                <li>Those with a matched plan get a &ldquo;pending&rdquo; subscription + unique invite link</li>
                <li>{sendInvitations ? 'Parents are emailed with a one-click checkout link' : 'You can send invitation emails later from this page'}</li>
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
              {submitting ? 'Importing...' : `Import ${rows.length} players & send invitations`}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Done */}
      {step === 'done' && (
        <div className="space-y-4">
          {result && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-6">
              <div className="text-3xl mb-2">🎉</div>
              <h2 className="text-lg font-bold text-white mb-1">Migration complete</h2>
              <p className="text-sm text-white/70">
                <strong className="text-white">{result.imported}</strong> players imported ·
                <strong className="text-emerald-400"> {result.invitationsQueued}</strong> invitation{result.invitationsQueued !== 1 ? 's' : ''} queued.
                {result.errors.length > 0 && (
                  <> <strong className="text-amber-400">{result.errors.length}</strong> errors.</>
                )}
              </p>
            </div>
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
                onClick={() => { setStep('upload'); setRows([]); setResult(null); setFileName('') }}
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

                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-sm">
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
