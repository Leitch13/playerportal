'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import FileUpload from '@/components/FileUpload'
import type { UserRole } from '@/lib/types'

/* ── Types ── */
interface Certification {
  id: string
  profile_id: string
  organisation_id: string
  name: string
  type: string
  issued_date: string | null
  expiry_date: string | null
  certificate_url: string | null
  status: string
  created_at: string
}

interface CPDHour {
  id: string
  profile_id: string
  organisation_id: string
  title: string
  description: string | null
  hours: number
  date: string
  evidence_url: string | null
  created_at: string
}

interface CoachSummary {
  id: string
  full_name: string
  email: string
  certsCount: number
  expiredCount: number
  expiringCount: number
  cpdHoursThisYear: number
}

const CERT_TYPES: Record<string, string> = {
  fa_coaching: 'FA Coaching Badge',
  dbs: 'DBS Check',
  first_aid: 'First Aid',
  safeguarding: 'Safeguarding',
  other: 'Other',
}

const CERT_ICONS: Record<string, string> = {
  fa_coaching: '\u26BD',
  dbs: '\uD83D\uDD12',
  first_aid: '\u2695\uFE0F',
  safeguarding: '\uD83D\uDEE1\uFE0F',
  other: '\uD83D\uDCC4',
}

const CPD_TARGET = 20

function getStatus(expiryDate: string | null): 'active' | 'expiring' | 'expired' {
  if (!expiryDate) return 'active'
  const now = new Date()
  const exp = new Date(expiryDate)
  const diff = (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  if (diff < 0) return 'expired'
  if (diff <= 30) return 'expiring'
  return 'active'
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    expiring: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    expired: 'bg-red-500/20 text-red-400 border-red-500/30',
  }
  const labels: Record<string, string> = {
    active: 'Active',
    expiring: 'Expiring Soon',
    expired: 'Expired',
  }
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${colors[status] || colors.active}`}>
      {labels[status] || status}
    </span>
  )
}

function formatDate(d: string | null) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

/* ── Main Component ── */
export default function CoachCPD({
  role,
  userId,
  orgId,
  certifications: initialCerts,
  cpdHours: initialCpd,
  allCoaches,
}: {
  role: UserRole
  userId: string
  orgId: string
  certifications: Record<string, unknown>[]
  cpdHours: Record<string, unknown>[]
  allCoaches: Record<string, unknown>[]
}) {
  const router = useRouter()
  const certs = initialCerts as unknown as Certification[]
  const cpd = initialCpd as unknown as CPDHour[]
  const coaches = allCoaches as unknown as CoachSummary[]

  const [tab, setTab] = useState<'certs' | 'cpd' | 'compliance'>(
    role === 'admin' ? 'compliance' : 'certs'
  )

  const isAdmin = role === 'admin'

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {isAdmin ? 'Coach Compliance' : 'CPD & Certifications'}
          </h1>
          <p className="text-white/40 text-sm mt-1">
            {isAdmin
              ? 'Monitor coach certifications and professional development'
              : 'Track your certifications and continuing professional development'}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white/[0.04] rounded-lg p-1 w-fit">
          {(isAdmin
            ? [
                { key: 'compliance' as const, label: 'Compliance' },
                { key: 'certs' as const, label: 'Certifications' },
                { key: 'cpd' as const, label: 'CPD Hours' },
              ]
            : [
                { key: 'certs' as const, label: 'Certifications' },
                { key: 'cpd' as const, label: 'CPD Hours' },
              ]
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                tab === t.key
                  ? 'bg-white/10 text-white'
                  : 'text-white/40 hover:text-white/60'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {tab === 'certs' && (
          <CertificationsSection certs={certs} userId={userId} orgId={orgId} onRefresh={() => router.refresh()} />
        )}
        {tab === 'cpd' && (
          <CPDSection cpd={cpd} userId={userId} orgId={orgId} onRefresh={() => router.refresh()} />
        )}
        {tab === 'compliance' && isAdmin && (
          <ComplianceSection coaches={coaches} />
        )}
      </div>
    </div>
  )
}

/* ── Certifications Section ── */
function CertificationsSection({
  certs,
  userId,
  orgId,
  onRefresh,
}: {
  certs: Certification[]
  userId: string
  orgId: string
  onRefresh: () => void
}) {
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [type, setType] = useState('fa_coaching')
  const [issuedDate, setIssuedDate] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [certUrl, setCertUrl] = useState('')

  const resetForm = () => {
    setName('')
    setType('fa_coaching')
    setIssuedDate('')
    setExpiryDate('')
    setCertUrl('')
    setEditId(null)
    setShowForm(false)
  }

  const openEdit = (cert: Certification) => {
    setEditId(cert.id)
    setName(cert.name)
    setType(cert.type)
    setIssuedDate(cert.issued_date || '')
    setExpiryDate(cert.expiry_date || '')
    setCertUrl(cert.certificate_url || '')
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    const supabase = createClient()
    const status = getStatus(expiryDate || null)
    const payload = {
      profile_id: userId,
      organisation_id: orgId || null,
      name: name.trim(),
      type,
      issued_date: issuedDate || null,
      expiry_date: expiryDate || null,
      certificate_url: certUrl || null,
      status,
    }

    if (editId) {
      await supabase.from('coach_certifications').update(payload).eq('id', editId)
    } else {
      await supabase.from('coach_certifications').insert(payload)
    }

    setSaving(false)
    resetForm()
    onRefresh()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this certification?')) return
    setDeleting(id)
    const supabase = createClient()
    await supabase.from('coach_certifications').delete().eq('id', id)
    setDeleting(null)
    onRefresh()
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#141414] border border-white/[0.06] rounded-xl p-5">
          <p className="text-white/40 text-xs font-medium uppercase tracking-wider">Total</p>
          <p className="text-2xl font-bold mt-1">{certs.length}</p>
        </div>
        <div className="bg-[#141414] border border-white/[0.06] rounded-xl p-5">
          <p className="text-amber-400/80 text-xs font-medium uppercase tracking-wider">Expiring Soon</p>
          <p className="text-2xl font-bold mt-1 text-amber-400">
            {certs.filter((c) => getStatus(c.expiry_date) === 'expiring').length}
          </p>
        </div>
        <div className="bg-[#141414] border border-white/[0.06] rounded-xl p-5">
          <p className="text-red-400/80 text-xs font-medium uppercase tracking-wider">Expired</p>
          <p className="text-2xl font-bold mt-1 text-red-400">
            {certs.filter((c) => getStatus(c.expiry_date) === 'expired').length}
          </p>
        </div>
      </div>

      {/* Add button */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#4ecde6]/10 text-[#4ecde6] rounded-lg text-sm font-medium hover:bg-[#4ecde6]/20 transition border border-[#4ecde6]/20"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Certification
        </button>
      )}

      {/* Form */}
      {showForm && (
        <div className="bg-[#141414] border border-white/[0.06] rounded-xl p-6 space-y-4">
          <h3 className="text-base font-semibold">{editId ? 'Edit Certification' : 'Add Certification'}</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">Certification Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. UEFA B Coaching Licence"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#4ecde6]/40"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#4ecde6]/40"
              >
                {Object.entries(CERT_TYPES).map(([k, v]) => (
                  <option key={k} value={k} className="bg-[#1a1a1a]">
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">Issued Date</label>
              <input
                type="date"
                value={issuedDate}
                onChange={(e) => setIssuedDate(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#4ecde6]/40"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">Expiry Date</label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#4ecde6]/40"
              />
            </div>
          </div>

          <FileUpload
            bucketName="coaching"
            folder="certifications"
            accept=".pdf,.jpg,.jpeg,.png"
            onUpload={(url) => setCertUrl(url)}
            currentUrl={certUrl}
            label="Certificate (PDF or image)"
          />

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="px-5 py-2.5 bg-[#4ecde6] text-black rounded-lg text-sm font-semibold hover:bg-[#4ecde6]/90 transition disabled:opacity-40"
            >
              {saving ? 'Saving...' : editId ? 'Update' : 'Save'}
            </button>
            <button
              onClick={resetForm}
              className="px-4 py-2.5 text-white/40 hover:text-white/60 text-sm transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Cert cards */}
      {certs.length === 0 && !showForm && (
        <div className="bg-[#141414] border border-white/[0.06] rounded-xl p-10 text-center">
          <div className="text-3xl mb-3">{'\uD83D\uDEE1\uFE0F'}</div>
          <p className="text-white/40 text-sm">No certifications yet. Add your first one above.</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {certs.map((cert) => {
          const computedStatus = getStatus(cert.expiry_date)
          return (
            <div
              key={cert.id}
              className="bg-[#141414] border border-white/[0.06] rounded-xl p-5 space-y-3 hover:border-white/[0.12] transition group"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">{CERT_ICONS[cert.type] || '\uD83D\uDCC4'}</span>
                  <div>
                    <p className="text-sm font-semibold leading-tight">{cert.name}</p>
                    <p className="text-[11px] text-white/30 mt-0.5">{CERT_TYPES[cert.type] || cert.type}</p>
                  </div>
                </div>
                <StatusBadge status={computedStatus} />
              </div>

              <div className="flex gap-6 text-[11px] text-white/40">
                <div>
                  <span className="text-white/25">Issued:</span>{' '}
                  <span className="text-white/60">{formatDate(cert.issued_date)}</span>
                </div>
                <div>
                  <span className="text-white/25">Expires:</span>{' '}
                  <span className={computedStatus === 'expired' ? 'text-red-400' : computedStatus === 'expiring' ? 'text-amber-400' : 'text-white/60'}>
                    {formatDate(cert.expiry_date)}
                  </span>
                </div>
              </div>

              {cert.certificate_url && (
                <a
                  href={cert.certificate_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-[#4ecde6] hover:underline"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                  View Certificate
                </a>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-1 opacity-0 group-hover:opacity-100 transition">
                <button
                  onClick={() => openEdit(cert)}
                  className="text-[11px] text-white/30 hover:text-white/60 transition"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(cert.id)}
                  disabled={deleting === cert.id}
                  className="text-[11px] text-white/30 hover:text-red-400 transition"
                >
                  {deleting === cert.id ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── CPD Hours Section ── */
function CPDSection({
  cpd,
  userId,
  orgId,
  onRefresh,
}: {
  cpd: CPDHour[]
  userId: string
  orgId: string
  onRefresh: () => void
}) {
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [hours, setHours] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [evidenceUrl, setEvidenceUrl] = useState('')

  const now = new Date()
  const yearStart = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0]
  const thisYearCpd = cpd.filter((h) => h.date >= yearStart)
  const totalHours = thisYearCpd.reduce((sum, h) => sum + Number(h.hours), 0)
  const progress = Math.min((totalHours / CPD_TARGET) * 100, 100)

  const resetForm = () => {
    setTitle('')
    setDescription('')
    setHours('')
    setDate(new Date().toISOString().split('T')[0])
    setEvidenceUrl('')
    setShowForm(false)
  }

  const handleSave = async () => {
    if (!title.trim() || !hours) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('cpd_hours').insert({
      profile_id: userId,
      organisation_id: orgId || null,
      title: title.trim(),
      description: description.trim() || null,
      hours: parseFloat(hours),
      date,
      evidence_url: evidenceUrl || null,
    })
    setSaving(false)
    resetForm()
    onRefresh()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this CPD entry?')) return
    setDeleting(id)
    const supabase = createClient()
    await supabase.from('cpd_hours').delete().eq('id', id)
    setDeleting(null)
    onRefresh()
  }

  return (
    <div className="space-y-6">
      {/* Progress card */}
      <div className="bg-[#141414] border border-white/[0.06] rounded-xl p-6">
        <div className="flex items-end justify-between mb-3">
          <div>
            <p className="text-white/40 text-xs font-medium uppercase tracking-wider">CPD Hours This Year</p>
            <p className="text-3xl font-bold mt-1">
              {totalHours.toFixed(1)}{' '}
              <span className="text-base font-normal text-white/30">/ {CPD_TARGET} hrs</span>
            </p>
          </div>
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
              totalHours >= CPD_TARGET
                ? 'bg-emerald-500/20 text-emerald-400'
                : totalHours >= CPD_TARGET * 0.5
                ? 'bg-amber-500/20 text-amber-400'
                : 'bg-white/[0.06] text-white/40'
            }`}
          >
            {totalHours >= CPD_TARGET ? 'Target Met' : `${(CPD_TARGET - totalHours).toFixed(1)} hrs remaining`}
          </span>
        </div>
        <div className="w-full h-2.5 bg-white/[0.06] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              totalHours >= CPD_TARGET
                ? 'bg-emerald-500'
                : totalHours >= CPD_TARGET * 0.5
                ? 'bg-amber-500'
                : 'bg-[#4ecde6]'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Add button */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#4ecde6]/10 text-[#4ecde6] rounded-lg text-sm font-medium hover:bg-[#4ecde6]/20 transition border border-[#4ecde6]/20"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Log CPD Hours
        </button>
      )}

      {/* Form */}
      {showForm && (
        <div className="bg-[#141414] border border-white/[0.06] rounded-xl p-6 space-y-4">
          <h3 className="text-base font-semibold">Log CPD Hours</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Safeguarding Workshop"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#4ecde6]/40"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">Hours</label>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  placeholder="2.0"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#4ecde6]/40"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#4ecde6]/40"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="What did you learn?"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#4ecde6]/40 resize-none"
            />
          </div>

          <FileUpload
            bucketName="coaching"
            folder="cpd-evidence"
            accept=".pdf,.jpg,.jpeg,.png"
            onUpload={(url) => setEvidenceUrl(url)}
            currentUrl={evidenceUrl}
            label="Evidence (optional)"
          />

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving || !title.trim() || !hours}
              className="px-5 py-2.5 bg-[#4ecde6] text-black rounded-lg text-sm font-semibold hover:bg-[#4ecde6]/90 transition disabled:opacity-40"
            >
              {saving ? 'Saving...' : 'Log Hours'}
            </button>
            <button
              onClick={resetForm}
              className="px-4 py-2.5 text-white/40 hover:text-white/60 text-sm transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* CPD log */}
      {cpd.length === 0 && !showForm && (
        <div className="bg-[#141414] border border-white/[0.06] rounded-xl p-10 text-center">
          <div className="text-3xl mb-3">{'\uD83D\uDCDA'}</div>
          <p className="text-white/40 text-sm">No CPD hours logged yet. Start tracking your development above.</p>
        </div>
      )}

      {cpd.length > 0 && (
        <div className="bg-[#141414] border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left px-5 py-3 text-[11px] font-medium text-white/30 uppercase tracking-wider">Date</th>
                  <th className="text-left px-5 py-3 text-[11px] font-medium text-white/30 uppercase tracking-wider">Title</th>
                  <th className="text-left px-5 py-3 text-[11px] font-medium text-white/30 uppercase tracking-wider">Hours</th>
                  <th className="text-left px-5 py-3 text-[11px] font-medium text-white/30 uppercase tracking-wider">Evidence</th>
                  <th className="text-right px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {cpd.map((h) => (
                  <tr key={h.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition group/row">
                    <td className="px-5 py-3 text-white/50">{formatDate(h.date)}</td>
                    <td className="px-5 py-3">
                      <p className="font-medium">{h.title}</p>
                      {h.description && <p className="text-[11px] text-white/30 mt-0.5">{h.description}</p>}
                    </td>
                    <td className="px-5 py-3 font-semibold text-[#4ecde6]">{Number(h.hours).toFixed(1)}</td>
                    <td className="px-5 py-3">
                      {h.evidence_url ? (
                        <a
                          href={h.evidence_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-[#4ecde6] hover:underline"
                        >
                          View
                        </a>
                      ) : (
                        <span className="text-white/20 text-[11px]">-</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => handleDelete(h.id)}
                        disabled={deleting === h.id}
                        className="text-[11px] text-white/20 hover:text-red-400 transition opacity-0 group-hover/row:opacity-100"
                      >
                        {deleting === h.id ? '...' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Admin Compliance Section ── */
function ComplianceSection({ coaches }: { coaches: CoachSummary[] }) {
  const [sending, setSending] = useState<string | null>(null)

  const handleSendReminder = async (coachId: string, email: string, name: string) => {
    setSending(coachId)
    try {
      await fetch('/api/send-cert-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coachId, email, name }),
      })
    } catch (e) {
      console.error('Failed to send reminder', e)
    }
    setSending(null)
  }

  if (coaches.length === 0) {
    return (
      <div className="bg-[#141414] border border-white/[0.06] rounded-xl p-10 text-center">
        <div className="text-3xl mb-3">{'\uD83D\uDC65'}</div>
        <p className="text-white/40 text-sm">No coaches found in your organisation.</p>
      </div>
    )
  }

  const alertCoaches = coaches.filter((c) => c.expiredCount > 0 || c.expiringCount > 0)

  return (
    <div className="space-y-6">
      {/* Alert summary */}
      {alertCoaches.length > 0 && (
        <div className="bg-red-500/[0.08] border border-red-500/20 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <span className="text-sm font-semibold text-red-400">
              {alertCoaches.length} coach{alertCoaches.length !== 1 ? 'es' : ''} with certification issues
            </span>
          </div>
          <p className="text-[11px] text-red-400/60">
            Some coaches have expired or expiring certifications. Send them a reminder to update.
          </p>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-[#141414] border border-white/[0.06] rounded-xl p-5">
          <p className="text-white/40 text-xs font-medium uppercase tracking-wider">Coaches</p>
          <p className="text-2xl font-bold mt-1">{coaches.length}</p>
        </div>
        <div className="bg-[#141414] border border-white/[0.06] rounded-xl p-5">
          <p className="text-white/40 text-xs font-medium uppercase tracking-wider">Fully Compliant</p>
          <p className="text-2xl font-bold mt-1 text-emerald-400">
            {coaches.filter((c) => c.expiredCount === 0 && c.expiringCount === 0 && c.certsCount > 0).length}
          </p>
        </div>
        <div className="bg-[#141414] border border-white/[0.06] rounded-xl p-5">
          <p className="text-amber-400/80 text-xs font-medium uppercase tracking-wider">Expiring</p>
          <p className="text-2xl font-bold mt-1 text-amber-400">
            {coaches.filter((c) => c.expiringCount > 0).length}
          </p>
        </div>
        <div className="bg-[#141414] border border-white/[0.06] rounded-xl p-5">
          <p className="text-red-400/80 text-xs font-medium uppercase tracking-wider">Expired</p>
          <p className="text-2xl font-bold mt-1 text-red-400">
            {coaches.filter((c) => c.expiredCount > 0).length}
          </p>
        </div>
      </div>

      {/* Coach table */}
      <div className="bg-[#141414] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left px-5 py-3 text-[11px] font-medium text-white/30 uppercase tracking-wider">Coach</th>
                <th className="text-center px-5 py-3 text-[11px] font-medium text-white/30 uppercase tracking-wider">Certs</th>
                <th className="text-center px-5 py-3 text-[11px] font-medium text-white/30 uppercase tracking-wider">Expired</th>
                <th className="text-center px-5 py-3 text-[11px] font-medium text-white/30 uppercase tracking-wider">Expiring</th>
                <th className="text-center px-5 py-3 text-[11px] font-medium text-white/30 uppercase tracking-wider">CPD Hours</th>
                <th className="text-center px-5 py-3 text-[11px] font-medium text-white/30 uppercase tracking-wider">Status</th>
                <th className="text-right px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {coaches.map((coach) => {
                const hasIssues = coach.expiredCount > 0 || coach.expiringCount > 0
                const noCerts = coach.certsCount === 0
                return (
                  <tr
                    key={coach.id}
                    className={`border-b border-white/[0.04] transition ${
                      hasIssues ? 'bg-red-500/[0.03]' : ''
                    } hover:bg-white/[0.02]`}
                  >
                    <td className="px-5 py-3">
                      <p className="font-medium">{coach.full_name || 'Unknown'}</p>
                      <p className="text-[11px] text-white/30">{coach.email}</p>
                    </td>
                    <td className="px-5 py-3 text-center">{coach.certsCount}</td>
                    <td className="px-5 py-3 text-center">
                      {coach.expiredCount > 0 ? (
                        <span className="text-red-400 font-semibold">{coach.expiredCount}</span>
                      ) : (
                        <span className="text-white/20">0</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-center">
                      {coach.expiringCount > 0 ? (
                        <span className="text-amber-400 font-semibold">{coach.expiringCount}</span>
                      ) : (
                        <span className="text-white/20">0</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span
                        className={
                          coach.cpdHoursThisYear >= CPD_TARGET
                            ? 'text-emerald-400 font-semibold'
                            : 'text-white/60'
                        }
                      >
                        {coach.cpdHoursThisYear.toFixed(1)}
                      </span>
                      <span className="text-white/20 text-[11px]"> / {CPD_TARGET}</span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      {noCerts ? (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-white/[0.06] text-white/30 border-white/[0.1]">
                          No Certs
                        </span>
                      ) : hasIssues ? (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-red-500/20 text-red-400 border-red-500/30">
                          Action Needed
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                          Compliant
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {(hasIssues || noCerts) && (
                        <button
                          onClick={() => handleSendReminder(coach.id, coach.email, coach.full_name)}
                          disabled={sending === coach.id}
                          className="text-[11px] px-3 py-1.5 rounded-md bg-white/[0.06] text-white/50 hover:text-white hover:bg-white/[0.1] transition border border-white/[0.08] disabled:opacity-40"
                        >
                          {sending === coach.id ? 'Sending...' : 'Send Reminder'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
