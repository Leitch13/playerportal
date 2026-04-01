'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Lead {
  id: string
  organisation_id: string
  source: string
  first_name: string
  last_name: string | null
  email: string | null
  phone: string | null
  child_name: string | null
  child_age: number | null
  interested_in: string | null
  status: string
  notes: string | null
  assigned_to: string | null
  follow_up_date: string | null
  lost_reason: string | null
  created_at: string
  updated_at: string
}

interface TeamMember {
  id: string
  full_name: string
  email: string
  role: string
}

interface TrainingGroup {
  id: string
  name: string
}

interface Props {
  leads: Lead[]
  teamMembers: TeamMember[]
  trainingGroups: TrainingGroup[]
  orgId: string
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const STATUSES = ['new', 'contacted', 'trial_booked', 'trial_attended', 'enrolled', 'lost'] as const
type Status = typeof STATUSES[number]

const STATUS_CONFIG: Record<Status, { label: string; color: string; bg: string; border: string }> = {
  new:             { label: 'New',             color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/30' },
  contacted:       { label: 'Contacted',       color: 'text-yellow-400',  bg: 'bg-yellow-500/10',  border: 'border-yellow-500/30' },
  trial_booked:    { label: 'Trial Booked',    color: 'text-purple-400',  bg: 'bg-purple-500/10',  border: 'border-purple-500/30' },
  trial_attended:  { label: 'Trial Attended',  color: 'text-cyan-400',    bg: 'bg-cyan-500/10',    border: 'border-cyan-500/30' },
  enrolled:        { label: 'Enrolled',        color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  lost:            { label: 'Lost',            color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/30' },
}

const SOURCES = ['manual', 'facebook', 'website', 'phone', 'walk_in', 'referral'] as const

const SOURCE_LABELS: Record<string, string> = {
  manual: 'Manual', facebook: 'Facebook', website: 'Website',
  phone: 'Phone', walk_in: 'Walk-in', referral: 'Referral',
}

const LOST_REASONS = [
  'Too expensive', 'Location', 'Timing', 'Chose competitor', 'No response', 'Other',
]

/* ------------------------------------------------------------------ */
/*  Inline SVG icons                                                   */
/* ------------------------------------------------------------------ */

function IconPlus() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
}
function IconList() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
}
function IconBoard() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="2" width="4" height="12" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="6" y="2" width="4" height="8" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="11" y="2" width="4" height="10" rx="1" stroke="currentColor" strokeWidth="1.5"/></svg>
}
function IconClose() {
  return <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
}
function IconChevronRight() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
}
function IconChevronLeft() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
}
function IconUser() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.2"/><path d="M2.5 12.5c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
}
function IconCalendar() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1.5" y="2.5" width="11" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M1.5 5.5h11M4.5 1v2.5M9.5 1v2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function LeadsPipeline({ leads: initialLeads, teamMembers, trainingGroups, orgId }: Props) {
  const router = useRouter()
  const [view, setView] = useState<'pipeline' | 'list'>('pipeline')
  const [leads, setLeads] = useState(initialLeads)
  const [showAddModal, setShowAddModal] = useState(false)
  const [detailLead, setDetailLead] = useState<Lead | null>(null)
  const [saving, setSaving] = useState(false)

  /* ---- Stats ---- */
  const stats = useMemo(() => {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const thisMonth = leads.filter(l => new Date(l.created_at) >= monthStart)
    const enrolled = leads.filter(l => l.status === 'enrolled')
    const avgDays = enrolled.length > 0
      ? Math.round(enrolled.reduce((sum, l) => sum + daysSince(l.created_at), 0) / enrolled.length)
      : 0
    const sourceCounts: Record<string, number> = {}
    leads.forEach(l => { sourceCounts[l.source] = (sourceCounts[l.source] || 0) + 1 })
    const maxSource = Math.max(...Object.values(sourceCounts), 1)
    return {
      thisMonth: thisMonth.length,
      conversionRate: leads.length > 0 ? Math.round((enrolled.length / leads.length) * 100) : 0,
      avgDaysToConvert: avgDays,
      sourceCounts,
      maxSource,
    }
  }, [leads])

  /* ---- Supabase mutations ---- */

  async function updateLead(id: string, updates: Partial<Lead>) {
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('leads').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id)
    if (!error) {
      setLeads(prev => prev.map(l => l.id === id ? { ...l, ...updates, updated_at: new Date().toISOString() } : l))
      if (detailLead?.id === id) setDetailLead(prev => prev ? { ...prev, ...updates, updated_at: new Date().toISOString() } : null)
    }
    setSaving(false)
  }

  async function addLead(data: Partial<Lead>) {
    setSaving(true)
    const supabase = createClient()
    const { data: inserted, error } = await supabase.from('leads').insert({ ...data, organisation_id: orgId }).select().single()
    if (!error && inserted) {
      setLeads(prev => [inserted, ...prev])
    }
    setSaving(false)
    setShowAddModal(false)
  }

  async function moveStatus(lead: Lead, direction: 'forward' | 'backward') {
    const idx = STATUSES.indexOf(lead.status as Status)
    if (direction === 'forward' && idx < STATUSES.length - 1) {
      await updateLead(lead.id, { status: STATUSES[idx + 1] })
    } else if (direction === 'backward' && idx > 0) {
      await updateLead(lead.id, { status: STATUSES[idx - 1] })
    }
  }

  /* ---- Group leads by status ---- */
  const grouped = useMemo(() => {
    const map: Record<Status, Lead[]> = { new: [], contacted: [], trial_booked: [], trial_attended: [], enrolled: [], lost: [] }
    leads.forEach(l => {
      if (map[l.status as Status]) map[l.status as Status].push(l)
    })
    return map
  }, [leads])

  const memberName = (id: string | null) => {
    if (!id) return null
    return teamMembers.find(m => m.id === id)?.full_name || null
  }

  /* ------------------------------------------------------------------ */
  /*  Render                                                             */
  /* ------------------------------------------------------------------ */

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Leads Pipeline</h1>
          <p className="text-white/60 text-sm mt-1">Track enquiries from first contact to enrolment</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-[#141414] rounded-lg p-1 border border-[#1e1e1e]">
            <button
              onClick={() => setView('pipeline')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${view === 'pipeline' ? 'bg-[#1e1e1e] text-white shadow-sm' : 'text-white/40 hover:text-white/70'}`}
            >
              <IconBoard /> Board
            </button>
            <button
              onClick={() => setView('list')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${view === 'list' ? 'bg-[#1e1e1e] text-white shadow-sm' : 'text-white/40 hover:text-white/70'}`}
            >
              <IconList /> List
            </button>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-lg text-sm font-bold bg-[#4ecde6] text-[#0a0a0a] hover:bg-[#4ecde6]/90 transition-colors flex items-center gap-1.5"
          >
            <IconPlus /> Add Lead
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] p-4">
          <p className="text-xs text-white/50 font-medium mb-1">Leads This Month</p>
          <p className="text-2xl font-bold text-[#4ecde6]">{stats.thisMonth}</p>
        </div>
        <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] p-4">
          <p className="text-xs text-white/50 font-medium mb-1">Conversion Rate</p>
          <p className="text-2xl font-bold text-emerald-400">{stats.conversionRate}%</p>
        </div>
        <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] p-4">
          <p className="text-xs text-white/50 font-medium mb-1">Avg Days to Convert</p>
          <p className="text-2xl font-bold text-purple-400">{stats.avgDaysToConvert}</p>
        </div>
        <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] p-4">
          <p className="text-xs text-white/50 font-medium mb-1">Leads by Source</p>
          <div className="flex items-end gap-1 h-8 mt-1">
            {Object.entries(stats.sourceCounts).map(([src, count]) => (
              <div key={src} className="flex flex-col items-center flex-1 min-w-0">
                <div
                  className="w-full bg-[#4ecde6]/60 rounded-sm min-h-[2px] transition-all"
                  style={{ height: `${Math.max((count / stats.maxSource) * 28, 2)}px` }}
                  title={`${SOURCE_LABELS[src] || src}: ${count}`}
                />
                <span className="text-[8px] text-white/40 mt-0.5 truncate w-full text-center">{SOURCE_LABELS[src]?.[0] || src[0]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pipeline View */}
      {view === 'pipeline' && (
        <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          {STATUSES.map(status => {
            const config = STATUS_CONFIG[status]
            const columnLeads = grouped[status]
            return (
              <div key={status} className="flex-shrink-0 w-[280px]">
                <div className={`rounded-xl border ${config.border} ${config.bg} px-3 py-2 mb-2 flex items-center justify-between`}>
                  <span className={`text-sm font-bold ${config.color}`}>{config.label}</span>
                  <span className={`text-xs font-bold ${config.color} bg-white/5 rounded-full px-2 py-0.5`}>{columnLeads.length}</span>
                </div>
                <div className="space-y-2 min-h-[200px]">
                  {columnLeads.map(lead => (
                    <button
                      key={lead.id}
                      onClick={() => setDetailLead(lead)}
                      className="w-full text-left bg-[#141414] rounded-xl border border-[#1e1e1e] p-3 hover:border-[#2e2e2e] transition-all group"
                    >
                      <div className="flex items-start justify-between mb-1.5">
                        <p className="text-sm font-semibold text-white truncate">
                          {lead.first_name} {lead.last_name || ''}
                        </p>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${config.bg} ${config.color} flex-shrink-0 ml-2`}>
                          {SOURCE_LABELS[lead.source] || lead.source}
                        </span>
                      </div>
                      {lead.child_name && (
                        <p className="text-xs text-white/50 mb-1">
                          Child: {lead.child_name}{lead.child_age ? ` (${lead.child_age})` : ''}
                        </p>
                      )}
                      {lead.interested_in && (
                        <p className="text-xs text-white/40 mb-1.5 truncate">{lead.interested_in}</p>
                      )}
                      <div className="flex items-center justify-between text-[10px] text-white/30">
                        <span>{daysSince(lead.created_at)}d ago</span>
                        {memberName(lead.assigned_to) && (
                          <span className="flex items-center gap-1 text-white/40">
                            <IconUser /> {memberName(lead.assigned_to)?.split(' ')[0]}
                          </span>
                        )}
                      </div>
                      {/* Quick move buttons */}
                      <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {STATUSES.indexOf(status) > 0 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); moveStatus(lead, 'backward') }}
                            className="flex-1 flex items-center justify-center gap-1 text-[10px] text-white/50 hover:text-white bg-white/5 hover:bg-white/10 rounded-md py-1 transition-colors"
                          >
                            <IconChevronLeft /> Back
                          </button>
                        )}
                        {STATUSES.indexOf(status) < STATUSES.length - 1 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); moveStatus(lead, 'forward') }}
                            className="flex-1 flex items-center justify-center gap-1 text-[10px] text-white/50 hover:text-white bg-white/5 hover:bg-white/10 rounded-md py-1 transition-colors"
                          >
                            Next <IconChevronRight />
                          </button>
                        )}
                      </div>
                    </button>
                  ))}
                  {columnLeads.length === 0 && (
                    <div className="text-center text-white/20 text-xs py-8">No leads</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* List View */}
      {view === 'list' && (
        <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1e1e1e] text-white/50 text-xs">
                  <th className="text-left px-4 py-3 font-medium">Name</th>
                  <th className="text-left px-4 py-3 font-medium">Child</th>
                  <th className="text-left px-4 py-3 font-medium">Source</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Assigned To</th>
                  <th className="text-left px-4 py-3 font-medium">Follow-up</th>
                  <th className="text-left px-4 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {leads.map(lead => {
                  const config = STATUS_CONFIG[lead.status as Status] || STATUS_CONFIG.new
                  return (
                    <tr
                      key={lead.id}
                      onClick={() => setDetailLead(lead)}
                      className="border-b border-[#1e1e1e] hover:bg-white/[0.02] cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-white">
                        {lead.first_name} {lead.last_name || ''}
                      </td>
                      <td className="px-4 py-3 text-white/60">
                        {lead.child_name || '-'}{lead.child_age ? ` (${lead.child_age})` : ''}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-white/5 text-white/60">
                          {SOURCE_LABELS[lead.source] || lead.source}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={lead.status}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => updateLead(lead.id, { status: e.target.value })}
                          className={`text-xs font-semibold px-2 py-1 rounded-lg border-0 ${config.bg} ${config.color} bg-opacity-20 cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#4ecde6]/50`}
                        >
                          {STATUSES.map(s => (
                            <option key={s} value={s} className="bg-[#1a1a1a] text-white">{STATUS_CONFIG[s].label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-white/60 text-xs">
                        {memberName(lead.assigned_to) || '-'}
                      </td>
                      <td className="px-4 py-3 text-white/60 text-xs">
                        {lead.follow_up_date ? (
                          <span className={new Date(lead.follow_up_date) < new Date() ? 'text-red-400' : ''}>
                            {formatDate(lead.follow_up_date)}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3 text-white/40 text-xs">{formatDate(lead.created_at)}</td>
                    </tr>
                  )
                })}
                {leads.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-white/30">
                      No leads yet. Click &quot;Add Lead&quot; to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Lead Modal */}
      {showAddModal && (
        <AddLeadModal
          onClose={() => setShowAddModal(false)}
          onSave={addLead}
          trainingGroups={trainingGroups}
          saving={saving}
        />
      )}

      {/* Lead Detail Panel */}
      {detailLead && (
        <LeadDetailPanel
          lead={detailLead}
          onClose={() => setDetailLead(null)}
          onUpdate={updateLead}
          onMove={moveStatus}
          teamMembers={teamMembers}
          trainingGroups={trainingGroups}
          saving={saving}
        />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Add Lead Modal                                                     */
/* ------------------------------------------------------------------ */

function AddLeadModal({
  onClose, onSave, trainingGroups, saving,
}: {
  onClose: () => void
  onSave: (data: Partial<Lead>) => void
  trainingGroups: TrainingGroup[]
  saving: boolean
}) {
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '',
    child_name: '', child_age: '', interested_in: '', source: 'manual', notes: '',
  })

  const set = (key: string, val: string) => setForm(prev => ({ ...prev, [key]: val }))

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.first_name.trim()) return
    onSave({
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      child_name: form.child_name.trim() || null,
      child_age: form.child_age ? parseInt(form.child_age) : null,
      interested_in: form.interested_in || null,
      source: form.source,
      notes: form.notes.trim() || null,
      status: 'new',
    } as Partial<Lead>)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#141414] rounded-2xl border border-[#1e1e1e] w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e1e1e]">
          <h2 className="text-lg font-bold">Add New Lead</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors"><IconClose /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-white/50 font-medium mb-1">First Name *</label>
              <input
                value={form.first_name} onChange={e => set('first_name', e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#4ecde6]/50 transition-colors"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-white/50 font-medium mb-1">Last Name</label>
              <input
                value={form.last_name} onChange={e => set('last_name', e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#4ecde6]/50 transition-colors"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-white/50 font-medium mb-1">Email</label>
              <input
                type="email" value={form.email} onChange={e => set('email', e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#4ecde6]/50 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-white/50 font-medium mb-1">Phone</label>
              <input
                value={form.phone} onChange={e => set('phone', e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#4ecde6]/50 transition-colors"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-white/50 font-medium mb-1">Child Name</label>
              <input
                value={form.child_name} onChange={e => set('child_name', e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#4ecde6]/50 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-white/50 font-medium mb-1">Child Age</label>
              <input
                type="number" min="3" max="18" value={form.child_age} onChange={e => set('child_age', e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#4ecde6]/50 transition-colors"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-white/50 font-medium mb-1">Interested In</label>
            <select
              value={form.interested_in} onChange={e => set('interested_in', e.target.value)}
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#4ecde6]/50 transition-colors"
            >
              <option value="">Select a group...</option>
              {trainingGroups.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-white/50 font-medium mb-1">Source</label>
            <select
              value={form.source} onChange={e => set('source', e.target.value)}
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#4ecde6]/50 transition-colors"
            >
              {SOURCES.map(s => <option key={s} value={s}>{SOURCE_LABELS[s]}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-white/50 font-medium mb-1">Notes</label>
            <textarea
              value={form.notes} onChange={e => set('notes', e.target.value)} rows={3}
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#4ecde6]/50 transition-colors resize-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold text-white/60 hover:text-white bg-white/5 hover:bg-white/10 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving || !form.first_name.trim()} className="px-4 py-2 rounded-lg text-sm font-bold bg-[#4ecde6] text-[#0a0a0a] hover:bg-[#4ecde6]/90 transition-colors disabled:opacity-50">
              {saving ? 'Saving...' : 'Add Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Lead Detail Panel (slide-over)                                     */
/* ------------------------------------------------------------------ */

function LeadDetailPanel({
  lead, onClose, onUpdate, onMove, teamMembers, trainingGroups, saving,
}: {
  lead: Lead
  onClose: () => void
  onUpdate: (id: string, updates: Partial<Lead>) => Promise<void>
  onMove: (lead: Lead, dir: 'forward' | 'backward') => Promise<void>
  teamMembers: TeamMember[]
  trainingGroups: TrainingGroup[]
  saving: boolean
}) {
  const [editNotes, setEditNotes] = useState('')
  const [showLostModal, setShowLostModal] = useState(false)
  const [lostReason, setLostReason] = useState('')

  const config = STATUS_CONFIG[lead.status as Status] || STATUS_CONFIG.new
  const statusIdx = STATUSES.indexOf(lead.status as Status)

  async function appendNote() {
    if (!editNotes.trim()) return
    const timestamp = new Date().toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    const newNote = `[${timestamp}] ${editNotes.trim()}`
    const combined = lead.notes ? `${lead.notes}\n${newNote}` : newNote
    await onUpdate(lead.id, { notes: combined })
    setEditNotes('')
  }

  async function markAsLost() {
    await onUpdate(lead.id, { status: 'lost', lost_reason: lostReason })
    setShowLostModal(false)
  }

  async function convertToTrial() {
    const supabase = createClient()
    await supabase.from('trial_bookings').insert({
      organisation_id: lead.organisation_id,
      parent_name: `${lead.first_name} ${lead.last_name || ''}`.trim(),
      parent_email: lead.email || '',
      parent_phone: lead.phone || '',
      child_name: lead.child_name || '',
      child_age: lead.child_age,
      notes: `Converted from lead. ${lead.notes || ''}`.trim(),
      status: 'pending',
    })
    await onUpdate(lead.id, { status: 'trial_booked' })
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#0f0f0f] w-full max-w-md h-full overflow-y-auto border-l border-[#1e1e1e] animate-slide-in">
        {/* Header */}
        <div className="sticky top-0 bg-[#0f0f0f] border-b border-[#1e1e1e] px-6 py-4 z-10">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold">{lead.first_name} {lead.last_name || ''}</h2>
            <button onClick={onClose} className="text-white/40 hover:text-white transition-colors"><IconClose /></button>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${config.bg} ${config.color}`}>{config.label}</span>
            <span className="text-xs text-white/30">{daysSince(lead.created_at)} days ago</span>
          </div>
          {/* Pipeline navigation */}
          <div className="flex gap-2 mt-3">
            {statusIdx > 0 && (
              <button
                onClick={() => onMove(lead, 'backward')}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-1 text-xs font-semibold text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg py-2 transition-colors disabled:opacity-50"
              >
                <IconChevronLeft /> {STATUS_CONFIG[STATUSES[statusIdx - 1]]?.label}
              </button>
            )}
            {statusIdx < STATUSES.length - 1 && (
              <button
                onClick={() => onMove(lead, 'forward')}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-1 text-xs font-semibold text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg py-2 transition-colors disabled:opacity-50"
              >
                {STATUS_CONFIG[STATUSES[statusIdx + 1]]?.label} <IconChevronRight />
              </button>
            )}
          </div>
        </div>

        <div className="px-6 py-4 space-y-5">
          {/* Contact Info */}
          <section>
            <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-3">Contact</h3>
            <div className="space-y-2">
              {lead.email && (
                <p className="text-sm text-white/70">
                  <span className="text-white/40 w-16 inline-block">Email</span> {lead.email}
                </p>
              )}
              {lead.phone && (
                <p className="text-sm text-white/70">
                  <span className="text-white/40 w-16 inline-block">Phone</span> {lead.phone}
                </p>
              )}
              <p className="text-sm text-white/70">
                <span className="text-white/40 w-16 inline-block">Source</span> {SOURCE_LABELS[lead.source] || lead.source}
              </p>
            </div>
          </section>

          {/* Child Info */}
          {(lead.child_name || lead.child_age) && (
            <section>
              <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-3">Child</h3>
              <div className="space-y-2">
                {lead.child_name && <p className="text-sm text-white/70">{lead.child_name}{lead.child_age ? ` (age ${lead.child_age})` : ''}</p>}
                {lead.interested_in && <p className="text-sm text-white/50">Interested in: {lead.interested_in}</p>}
              </div>
            </section>
          )}

          {/* Interested In */}
          <section>
            <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-3">Interested In</h3>
            <select
              value={lead.interested_in || ''}
              onChange={e => onUpdate(lead.id, { interested_in: e.target.value || null })}
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#4ecde6]/50 transition-colors"
            >
              <option value="">None selected</option>
              {trainingGroups.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
            </select>
          </section>

          {/* Assign To */}
          <section>
            <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-3">Assigned To</h3>
            <select
              value={lead.assigned_to || ''}
              onChange={e => onUpdate(lead.id, { assigned_to: e.target.value || null })}
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#4ecde6]/50 transition-colors"
            >
              <option value="">Unassigned</option>
              {teamMembers.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
            </select>
          </section>

          {/* Follow-up Date */}
          <section>
            <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <IconCalendar /> Follow-up Date
            </h3>
            <input
              type="date"
              value={lead.follow_up_date || ''}
              onChange={e => onUpdate(lead.id, { follow_up_date: e.target.value || null })}
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#4ecde6]/50 transition-colors [color-scheme:dark]"
            />
          </section>

          {/* Notes */}
          <section>
            <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-3">Notes</h3>
            {lead.notes && (
              <div className="bg-[#1a1a1a] rounded-lg p-3 mb-3 text-xs text-white/60 whitespace-pre-wrap max-h-40 overflow-y-auto border border-[#2a2a2a]">
                {lead.notes}
              </div>
            )}
            <div className="flex gap-2">
              <input
                value={editNotes}
                onChange={e => setEditNotes(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && appendNote()}
                placeholder="Add a note..."
                className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#4ecde6]/50 transition-colors"
              />
              <button
                onClick={appendNote}
                disabled={!editNotes.trim()}
                className="px-3 py-2 rounded-lg text-xs font-bold bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors disabled:opacity-30"
              >
                Add
              </button>
            </div>
          </section>

          {/* Lost reason display */}
          {lead.status === 'lost' && lead.lost_reason && (
            <section>
              <h3 className="text-xs font-bold text-red-400/60 uppercase tracking-wider mb-2">Lost Reason</h3>
              <p className="text-sm text-red-400/80">{lead.lost_reason}</p>
            </section>
          )}

          {/* Action buttons */}
          <section className="space-y-2 pt-2">
            {lead.status !== 'trial_booked' && lead.status !== 'trial_attended' && lead.status !== 'enrolled' && lead.status !== 'lost' && (
              <button
                onClick={convertToTrial}
                disabled={saving}
                className="w-full px-4 py-2.5 rounded-lg text-sm font-bold bg-[#4ecde6] text-[#0a0a0a] hover:bg-[#4ecde6]/90 transition-colors disabled:opacity-50"
              >
                Convert to Trial Booking
              </button>
            )}
            {lead.status !== 'lost' && (
              <button
                onClick={() => setShowLostModal(true)}
                className="w-full px-4 py-2.5 rounded-lg text-sm font-semibold bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors"
              >
                Mark as Lost
              </button>
            )}
          </section>
        </div>

        {/* Lost Reason Modal */}
        {showLostModal && (
          <div className="absolute inset-0 z-20 flex items-center justify-center p-6">
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowLostModal(false)} />
            <div className="relative bg-[#141414] rounded-2xl border border-[#1e1e1e] p-6 w-full max-w-sm">
              <h3 className="text-base font-bold mb-4">Why was this lead lost?</h3>
              <div className="space-y-2 mb-4">
                {LOST_REASONS.map(reason => (
                  <button
                    key={reason}
                    onClick={() => setLostReason(reason)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors border ${
                      lostReason === reason
                        ? 'border-red-500/50 bg-red-500/10 text-red-400'
                        : 'border-[#2a2a2a] bg-[#1a1a1a] text-white/60 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowLostModal(false)}
                  className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold text-white/60 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={markAsLost}
                  disabled={!lostReason || saving}
                  className="flex-1 px-4 py-2 rounded-lg text-sm font-bold bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in {
          animation: slideIn 0.2s ease-out;
        }
      `}</style>
    </div>
  )
}
