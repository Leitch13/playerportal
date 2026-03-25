'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface OrgData {
  id: string
  name: string
  slug: string
  description: string
  contact_email: string
  contact_phone: string
  location: string
  primary_color: string
  logo_url: string
  hero_image_url: string
}

interface TeamMember {
  id: string
  name: string
  email: string
  role: string
  joinedAt: string
}

interface UsageData {
  players: number
  coaches: number
  classes: number
}

const TABS = ['General', 'Branding', 'Team', 'Billing', 'Danger Zone'] as const
type Tab = typeof TABS[number]

export default function SettingsForm({
  org,
  team,
  usage,
}: {
  org: OrgData | null
  team: TeamMember[]
  usage: UsageData
}) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('General')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [form, setForm] = useState<OrgData>(org || {
    id: '', name: '', slug: '', description: '', contact_email: '',
    contact_phone: '', location: '', primary_color: '#4ecde6',
    logo_url: '', hero_image_url: '',
  })
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [copied, setCopied] = useState(false)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  async function handleSave(fields: Partial<OrgData>) {
    if (!org) return
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('organisations').update(fields).eq('id', org.id)
    if (error) {
      showToast(`Error: ${error.message}`)
    } else {
      showToast('Settings saved!')
      router.refresh()
    }
    setSaving(false)
  }

  async function handleRemoveMember(id: string) {
    if (!confirm('Remove this team member? They will lose access.')) return
    const supabase = createClient()
    await supabase.from('profiles').update({ organisation_id: null, role: 'parent' }).eq('id', id)
    router.refresh()
    showToast('Member removed')
  }

  function copySlug() {
    navigator.clipboard.writeText(`${window.location.origin}/book/${form.slug}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const inputClass = 'w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all'

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-primary text-white px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium animate-in fade-in slide-in-from-top-2">
          {toast}
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-text-light text-sm mt-1">Manage your academy</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Tab nav */}
        <div className="flex lg:flex-col gap-1 lg:w-48 shrink-0 overflow-x-auto lg:overflow-visible">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold text-left whitespace-nowrap transition-all ${
                tab === t ? 'bg-primary text-white' : 'text-text-light hover:bg-surface hover:text-primary'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {tab === 'General' && (
            <div className="bg-white rounded-2xl border border-border p-6 space-y-5">
              <h2 className="font-bold text-lg">General Information</h2>
              <div>
                <label className="text-xs font-medium text-text-light block mb-1.5">Academy Name</label>
                <input className={inputClass} value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              </div>
              <div>
                <label className="text-xs font-medium text-text-light block mb-1.5">Booking URL (slug)</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-surface border border-border rounded-xl px-4 py-2.5 text-sm text-text-light">
                    /book/<strong className="text-primary">{form.slug}</strong>
                  </div>
                  <button onClick={copySlug} className="px-3 py-2.5 rounded-xl text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                    {copied ? '✓ Copied' : 'Copy URL'}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-text-light block mb-1.5">Description</label>
                <textarea className={inputClass} rows={3} value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-text-light block mb-1.5">Contact Email</label>
                  <input type="email" className={inputClass} value={form.contact_email} onChange={e => setForm({...form, contact_email: e.target.value})} />
                </div>
                <div>
                  <label className="text-xs font-medium text-text-light block mb-1.5">Contact Phone</label>
                  <input type="tel" className={inputClass} value={form.contact_phone} onChange={e => setForm({...form, contact_phone: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-text-light block mb-1.5">Location</label>
                <input className={inputClass} value={form.location} onChange={e => setForm({...form, location: e.target.value})} placeholder="e.g. Manchester, UK" />
              </div>
              <button
                onClick={() => handleSave({ name: form.name, description: form.description, contact_email: form.contact_email, contact_phone: form.contact_phone, location: form.location })}
                disabled={saving}
                className="px-6 py-2.5 rounded-xl font-semibold text-sm bg-accent text-white hover:opacity-90 disabled:opacity-50 transition-all"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}

          {tab === 'Branding' && (
            <div className="bg-white rounded-2xl border border-border p-6 space-y-5">
              <h2 className="font-bold text-lg">Branding</h2>
              <div>
                <label className="text-xs font-medium text-text-light block mb-1.5">Primary Colour</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={form.primary_color}
                    onChange={e => setForm({...form, primary_color: e.target.value})}
                    className="w-12 h-12 rounded-xl border border-border cursor-pointer"
                  />
                  <input
                    className={inputClass + ' max-w-[140px]'}
                    value={form.primary_color}
                    onChange={e => setForm({...form, primary_color: e.target.value})}
                    placeholder="#4ecde6"
                  />
                  <div className="flex-1 h-12 rounded-xl" style={{ backgroundColor: form.primary_color }} />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-text-light block mb-1.5">Logo URL</label>
                <input className={inputClass} value={form.logo_url} onChange={e => setForm({...form, logo_url: e.target.value})} placeholder="https://..." />
                {form.logo_url && (
                  <div className="mt-2 w-20 h-20 rounded-xl border border-border overflow-hidden bg-surface flex items-center justify-center">
                    <img src={form.logo_url} alt="Logo" className="max-w-full max-h-full object-contain" />
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-text-light block mb-1.5">Hero Image URL</label>
                <input className={inputClass} value={form.hero_image_url} onChange={e => setForm({...form, hero_image_url: e.target.value})} placeholder="https://..." />
                {form.hero_image_url && (
                  <div className="mt-2 w-full h-32 rounded-xl border border-border overflow-hidden bg-surface">
                    <img src={form.hero_image_url} alt="Hero" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
              <button
                onClick={() => handleSave({ primary_color: form.primary_color, logo_url: form.logo_url, hero_image_url: form.hero_image_url })}
                disabled={saving}
                className="px-6 py-2.5 rounded-xl font-semibold text-sm bg-accent text-white hover:opacity-90 disabled:opacity-50 transition-all"
              >
                {saving ? 'Saving...' : 'Save Branding'}
              </button>
            </div>
          )}

          {tab === 'Team' && (
            <div className="bg-white rounded-2xl border border-border p-6 space-y-5">
              <h2 className="font-bold text-lg">Team Members</h2>
              <div className="space-y-2">
                {team.map(m => (
                  <div key={m.id} className="flex items-center justify-between p-3 rounded-xl border border-border/50 hover:bg-surface/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center text-sm font-bold text-accent">
                        {m.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{m.name}</p>
                        <p className="text-xs text-text-light">{m.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                        m.role === 'admin' ? 'bg-purple-50 text-purple-600' :
                        m.role === 'coach' ? 'bg-blue-50 text-blue-600' :
                        'bg-gray-50 text-gray-500'
                      }`}>
                        {m.role}
                      </span>
                      {m.role !== 'admin' && (
                        <button
                          onClick={() => handleRemoveMember(m.id)}
                          className="text-xs text-text-light hover:text-red-500 transition-colors"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-border">
                <h3 className="font-semibold text-sm mb-2">Invite Team Members</h3>
                <p className="text-xs text-text-light mb-3">Share this signup link. New coaches/admins will join your academy automatically.</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-surface border border-border rounded-xl px-4 py-2.5 text-sm text-text-light truncate">
                    /auth/signup?org={form.slug}
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/auth/signup?org=${form.slug}`)
                      showToast('Link copied!')
                    }}
                    className="px-3 py-2.5 rounded-xl text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors whitespace-nowrap"
                  >
                    Copy Link
                  </button>
                </div>
              </div>
            </div>
          )}

          {tab === 'Billing' && (
            <div className="bg-white rounded-2xl border border-border p-6 space-y-5">
              <h2 className="font-bold text-lg">Billing & Usage</h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 rounded-xl bg-surface/50">
                  <p className="text-2xl font-bold text-accent">{usage.players}</p>
                  <p className="text-xs text-text-light">Players</p>
                </div>
                <div className="text-center p-4 rounded-xl bg-surface/50">
                  <p className="text-2xl font-bold text-accent">{usage.coaches}</p>
                  <p className="text-xs text-text-light">Coaches</p>
                </div>
                <div className="text-center p-4 rounded-xl bg-surface/50">
                  <p className="text-2xl font-bold text-accent">{usage.classes}</p>
                  <p className="text-xs text-text-light">Classes</p>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                <p className="font-semibold text-emerald-700">Pro Plan</p>
                <p className="text-sm text-emerald-600 mt-0.5">All features included. Manage billing via Stripe.</p>
              </div>
              <button className="px-6 py-2.5 rounded-xl font-semibold text-sm bg-primary text-white hover:opacity-90 transition-all">
                Manage Billing Portal
              </button>
            </div>
          )}

          {tab === 'Danger Zone' && (
            <div className="bg-white rounded-2xl border border-red-200 p-6 space-y-5">
              <h2 className="font-bold text-lg text-red-600">Danger Zone</h2>
              <p className="text-sm text-text-light">These actions are irreversible. Please be careful.</p>

              <div className="p-4 rounded-xl border border-border space-y-3">
                <div>
                  <p className="font-semibold text-sm">Export All Data</p>
                  <p className="text-xs text-text-light">Download all your academy data as CSV files</p>
                </div>
                <a
                  href="/dashboard/exports"
                  className="inline-block px-4 py-2 rounded-lg text-xs font-semibold border border-border hover:bg-surface transition-colors"
                >
                  Go to Exports
                </a>
              </div>

              <div className="p-4 rounded-xl border border-red-200 bg-red-50/50 space-y-3">
                <div>
                  <p className="font-semibold text-sm text-red-600">Delete Academy</p>
                  <p className="text-xs text-text-light">Permanently delete your academy and all data. This cannot be undone.</p>
                </div>
                <div>
                  <label className="text-xs text-text-light block mb-1.5">
                    Type <strong className="text-red-600">{form.name}</strong> to confirm
                  </label>
                  <input
                    className="w-full border border-red-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
                    value={deleteConfirm}
                    onChange={e => setDeleteConfirm(e.target.value)}
                    placeholder={form.name}
                  />
                </div>
                <button
                  disabled={deleteConfirm !== form.name}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-red-500 text-white hover:bg-red-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  Delete Academy Forever
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
