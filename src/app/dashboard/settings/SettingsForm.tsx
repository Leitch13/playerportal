'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import EmailSetup from './EmailSetup'
import StripeSetup from './StripeSetup'
import PlatformBilling from './PlatformBilling'
import ScoringCategories from './ScoringCategories'
import DataExportButton from '@/components/DataExportButton'
import EmbedCode from './EmbedCode'
import FileUpload from '@/components/FileUpload'

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
  google_review_url: string
  sibling_discount_enabled: boolean
  sibling_discount_percent: number
  quarterly_billing_enabled: boolean
  quarterly_discount_percent: number
  retention_offer_enabled: boolean
  retention_offer_percent: number
  retention_offer_months: number | null
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

const TABS = ['General', 'Branding', 'Team', 'Scoring', 'Email', 'Billing', 'Website Embed', 'Data & Backups', 'Danger Zone'] as const
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
    logo_url: '', hero_image_url: '', google_review_url: '',
    sibling_discount_enabled: false, sibling_discount_percent: 10,
    quarterly_billing_enabled: true, quarterly_discount_percent: 10,
    retention_offer_enabled: true, retention_offer_percent: 50, retention_offer_months: 1,
  })
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [copied, setCopied] = useState(false)
  const [staffName, setStaffName] = useState('')
  const [staffEmail, setStaffEmail] = useState('')
  const [staffRole, setStaffRole] = useState<'coach' | 'admin'>('coach')
  const [addingStaff, setAddingStaff] = useState(false)

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

  async function handleAddStaff(e: React.FormEvent) {
    e.preventDefault()
    if (!staffName.trim() || !staffEmail.trim()) { showToast('Enter a name and email'); return }
    setAddingStaff(true)
    try {
      const res = await fetch('/api/staff/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: staffName.trim(), email: staffEmail.trim(), role: staffRole }),
      })
      const data = await res.json()
      if (!res.ok) { showToast(data.error || 'Could not add staff member'); setAddingStaff(false); return }
      showToast(
        data.status === 'updated'
          ? `Existing account updated to ${staffRole}`
          : `${staffRole === 'admin' ? 'Admin' : 'Coach'} added — they'll get an email to set their password`
      )
      setStaffName(''); setStaffEmail(''); setStaffRole('coach')
      router.refresh()
    } catch {
      showToast('Something went wrong')
    }
    setAddingStaff(false)
  }

  function copySlug() {
    navigator.clipboard.writeText(`${window.location.origin}/book/${form.slug}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const inputClass = 'w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all placeholder:text-white/30'

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
        <p className="text-[#888] text-sm mt-1">Manage your academy</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Tab nav */}
        <div className="flex lg:flex-col gap-1 lg:w-48 shrink-0 overflow-x-auto lg:overflow-visible">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold text-left whitespace-nowrap transition-all ${
                tab === t ? 'bg-primary text-white' : 'text-white/60 hover:bg-[#1e1e1e] hover:text-white'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {tab === 'General' && (
            <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] p-6 space-y-5">
              <h2 className="font-bold text-lg">General Information</h2>
              <div>
                <label className="text-xs font-medium text-white/70 block mb-1.5">Academy Name</label>
                <input className={inputClass} value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              </div>
              <div>
                <label className="text-xs font-medium text-white/70 block mb-1.5">Booking URL (Your Academy ID)</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-[#888]">
                    /book/<strong className="text-primary">{form.slug}</strong>
                  </div>
                  <button onClick={copySlug} className="px-3 py-2.5 rounded-xl text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                    {copied ? '✓ Copied' : 'Copy URL'}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-white/70 block mb-1.5">Description</label>
                <textarea className={inputClass} rows={3} value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-white/70 block mb-1.5">Contact Email</label>
                  <input type="email" className={inputClass} value={form.contact_email} onChange={e => setForm({...form, contact_email: e.target.value})} />
                </div>
                <div>
                  <label className="text-xs font-medium text-white/70 block mb-1.5">Contact Phone</label>
                  <input type="tel" className={inputClass} value={form.contact_phone} onChange={e => setForm({...form, contact_phone: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-white/70 block mb-1.5">Location</label>
                <input className={inputClass} value={form.location} onChange={e => setForm({...form, location: e.target.value})} placeholder="e.g. Manchester, UK" />
              </div>
              <div>
                <label className="text-xs font-medium text-white/70 block mb-1.5">Google Review URL</label>
                <input className={inputClass} value={form.google_review_url} onChange={e => setForm({...form, google_review_url: e.target.value})} placeholder="https://g.page/r/your-academy/review" />
                <p className="text-[10px] text-white/30 mt-1">Parents will be directed here after rating their experience positively. Find your link at Google Business Profile.</p>
              </div>
              <button
                onClick={() => handleSave({ name: form.name, description: form.description, contact_email: form.contact_email, contact_phone: form.contact_phone, location: form.location, google_review_url: form.google_review_url })}
                disabled={saving}
                className="px-6 py-2.5 rounded-xl font-semibold text-sm bg-accent text-white hover:opacity-90 disabled:opacity-50 transition-all"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}

          {tab === 'Branding' && (
            <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] p-6 space-y-5">
              <h2 className="font-bold text-lg">Branding</h2>
              <div>
                <label className="text-xs font-medium text-white/70 block mb-1.5">Primary Colour</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={form.primary_color}
                    onChange={e => setForm({...form, primary_color: e.target.value})}
                    className="w-12 h-12 rounded-xl border border-white/[0.08] cursor-pointer"
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
                <label className="text-xs font-medium text-white/70 block mb-1.5">Logo</label>
                <FileUpload
                  bucketName="branding"
                  folder="logos"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  currentUrl={form.logo_url}
                  onUpload={(url) => setForm({ ...form, logo_url: url })}
                />
                <p className="text-[11px] text-white/30 mt-1.5">PNG with a transparent background works best. Max 10MB. Remember to hit Save Branding.</p>
              </div>
              <div>
                <label className="text-xs font-medium text-white/70 block mb-1.5">Hero Image URL</label>
                <input className={inputClass} value={form.hero_image_url} onChange={e => setForm({...form, hero_image_url: e.target.value})} placeholder="https://..." />
                {form.hero_image_url && (
                  <div className="mt-2 w-full h-32 rounded-xl border border-white/[0.08] overflow-hidden bg-surface">
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
            <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] p-6 space-y-5">
              <h2 className="font-bold text-lg">Team Members</h2>
              <div className="space-y-2">
                {team.map(m => (
                  <div key={m.id} className="flex items-center justify-between p-3 rounded-xl border border-[#1e1e1e] hover:bg-[#1a1a1a] transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center text-sm font-bold text-accent">
                        {m.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{m.name}</p>
                        <p className="text-xs text-[#888]">{m.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                        m.role === 'admin' ? 'bg-purple-500/20 text-purple-400' :
                        m.role === 'coach' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-white/[0.05] text-white/50'
                      }`}>
                        {m.role}
                      </span>
                      {m.role !== 'admin' && (
                        <button
                          onClick={() => handleRemoveMember(m.id)}
                          className="text-xs text-[#888] hover:text-red-500 transition-colors"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-[#1e1e1e] space-y-5">
                <div>
                  <h3 className="font-semibold text-sm mb-1">Add a Staff Member</h3>
                  <p className="text-xs text-[#888] mb-3">Add a coach or admin to your academy. They&apos;ll get an email to set their password and sign in. Admins can manage everything — payments, settings and billing — so only add admins you fully trust.</p>
                  <form onSubmit={handleAddStaff} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        className={inputClass}
                        placeholder="Full name"
                        value={staffName}
                        onChange={e => setStaffName(e.target.value)}
                      />
                      <input
                        type="email"
                        className={inputClass}
                        placeholder="Email address"
                        value={staffEmail}
                        onChange={e => setStaffEmail(e.target.value)}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        className={inputClass + ' max-w-[150px]'}
                        value={staffRole}
                        onChange={e => setStaffRole(e.target.value as 'coach' | 'admin')}
                      >
                        <option value="coach">Coach</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button
                        type="submit"
                        disabled={addingStaff}
                        className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-accent text-white hover:opacity-90 disabled:opacity-50 transition-all whitespace-nowrap"
                      >
                        {addingStaff ? 'Adding…' : 'Add staff member'}
                      </button>
                    </div>
                  </form>
                </div>

                <div>
                  <h3 className="font-semibold text-sm mb-1">Parent Booking Link</h3>
                  <p className="text-xs text-[#888] mb-3">This is the link you give to parents to subscribe their kids to your classes.</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-[#888] truncate">
                      /book/{form.slug}
                    </div>
                    <a
                      href={`/book/${form.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2.5 rounded-xl text-xs font-semibold bg-white/10 text-white hover:bg-white/15 transition-colors whitespace-nowrap inline-flex items-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                      View
                    </a>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/book/${form.slug}`)
                        showToast('Parent booking link copied!')
                      }}
                      className="px-3 py-2.5 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors whitespace-nowrap"
                    >
                      Copy Link
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'Scoring' && org && <ScoringCategories orgId={org.id} />}

          {tab === 'Email' && <EmailSetup academyName={form.name} contactEmail={form.contact_email} />}

          {tab === 'Billing' && (
            <div className="space-y-6">
              <PlatformBilling usage={usage} />
              <StripeSetup />

              {/* Sibling Discount */}
              <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] p-6 space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-bold text-lg text-white">Sibling Discount</h2>
                    <p className="text-sm text-white/50 mt-1 max-w-lg">
                      Automatically apply a discount when a parent signs up a second (or more) child.
                      The discount is applied to every renewal for as long as the sibling is enrolled.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 mt-1">
                    <input
                      type="checkbox"
                      checked={form.sibling_discount_enabled}
                      onChange={(e) => setForm({ ...form, sibling_discount_enabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-[#2a2a2a] peer-focus:ring-2 peer-focus:ring-accent/30 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#4ecde6]"></div>
                  </label>
                </div>

                {form.sibling_discount_enabled && (
                  <>
                    <div className="max-w-xs">
                      <label className="block text-xs font-semibold text-white/60 mb-1.5">Discount percentage</label>
                      <div className="relative">
                        <input
                          type="number"
                          min={1}
                          max={50}
                          step={1}
                          value={form.sibling_discount_percent}
                          onChange={(e) => setForm({ ...form, sibling_discount_percent: Math.max(1, Math.min(50, Number(e.target.value) || 10)) })}
                          className={inputClass + ' pr-10'}
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 text-sm font-semibold">%</span>
                      </div>
                      <p className="text-[11px] text-white/40 mt-1.5">Most academies set this at 10–15%</p>
                    </div>

                    <div className="bg-[#4ecde6]/5 border border-[#4ecde6]/15 rounded-xl p-4 text-sm space-y-1.5">
                      <p className="text-[#4ecde6] font-semibold text-xs uppercase tracking-wider">Example</p>
                      <p className="text-white/70">
                        If the Smith family signs up Jamie at <strong className="text-white">£50/mo</strong>, then later adds his sister Lily:
                      </p>
                      <ul className="text-white/70 space-y-0.5 pl-4">
                        <li>• Jamie: £50/mo (no change)</li>
                        <li>• Lily: £{(50 * (1 - form.sibling_discount_percent / 100)).toFixed(2)}/mo ({form.sibling_discount_percent}% off applied automatically)</li>
                        <li>• Family total: £{(50 + 50 * (1 - form.sibling_discount_percent / 100)).toFixed(2)}/mo</li>
                      </ul>
                    </div>
                  </>
                )}

                <button
                  onClick={() => handleSave({
                    sibling_discount_enabled: form.sibling_discount_enabled,
                    sibling_discount_percent: form.sibling_discount_percent,
                  })}
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#4ecde6] text-[#0a0a0a] hover:bg-[#7dddf0] disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Saving...' : 'Save sibling discount'}
                </button>
              </div>

              {/* Quarterly (3-month prepay) billing */}
              <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] p-6 space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-bold text-lg text-white">Quarterly Billing (3-Month Prepay)</h2>
                    <p className="text-sm text-white/50 mt-1 max-w-lg">
                      Give parents the option to pay upfront for 3 months with a discount. Improves your cash flow
                      and reduces churn. You choose whether to offer it and how much to discount.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 mt-1">
                    <input
                      type="checkbox"
                      checked={form.quarterly_billing_enabled}
                      onChange={(e) => setForm({ ...form, quarterly_billing_enabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-[#2a2a2a] peer-focus:ring-2 peer-focus:ring-accent/30 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#4ecde6]"></div>
                  </label>
                </div>

                {form.quarterly_billing_enabled && (
                  <>
                    <div className="max-w-xs">
                      <label className="block text-xs font-semibold text-white/60 mb-1.5">Discount percentage</label>
                      <div className="relative">
                        <input
                          type="number"
                          min={0}
                          max={50}
                          step={1}
                          value={form.quarterly_discount_percent}
                          onChange={(e) => setForm({ ...form, quarterly_discount_percent: Math.max(0, Math.min(50, Number(e.target.value) || 0)) })}
                          className={inputClass + ' pr-10'}
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 text-sm font-semibold">%</span>
                      </div>
                      <p className="text-[11px] text-white/40 mt-1.5">Common: 5–10%. Set to 0 to still offer prepay without a discount.</p>
                    </div>

                    <div className="bg-[#4ecde6]/5 border border-[#4ecde6]/15 rounded-xl p-4 text-sm space-y-1.5">
                      <p className="text-[#4ecde6] font-semibold text-xs uppercase tracking-wider">Example on a £50/mo plan</p>
                      <ul className="text-white/70 space-y-0.5 pl-4">
                        <li>• Monthly: £50 × 3 = £150</li>
                        <li>• Quarterly: <strong className="text-white">£{(150 * (1 - form.quarterly_discount_percent / 100)).toFixed(2)}</strong> upfront ({form.quarterly_discount_percent}% off)</li>
                        <li>• Parent saves: £{(150 * form.quarterly_discount_percent / 100).toFixed(2)} · Effective rate: £{(150 * (1 - form.quarterly_discount_percent / 100) / 3).toFixed(2)}/mo</li>
                      </ul>
                    </div>
                  </>
                )}

                {!form.quarterly_billing_enabled && (
                  <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 text-sm text-white/50">
                    Parents will only see monthly billing. Quarterly option is hidden from your booking page.
                  </div>
                )}

                <button
                  onClick={() => handleSave({
                    quarterly_billing_enabled: form.quarterly_billing_enabled,
                    quarterly_discount_percent: form.quarterly_discount_percent,
                  })}
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#4ecde6] text-[#0a0a0a] hover:bg-[#7dddf0] disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Saving...' : 'Save quarterly billing'}
                </button>
              </div>

              {/* Cancellation retention offer */}
              <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] p-6 space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-bold text-lg text-white">Cancellation Retention Offer</h2>
                    <p className="text-sm text-white/50 mt-1 max-w-lg">
                      When a parent tries to cancel, offer them a last-chance discount to stay.
                      Typically saves 30–40% of potential churn. You choose the discount and how long it lasts.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 mt-1">
                    <input
                      type="checkbox"
                      checked={form.retention_offer_enabled}
                      onChange={(e) => setForm({ ...form, retention_offer_enabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-[#2a2a2a] peer-focus:ring-2 peer-focus:ring-accent/30 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#4ecde6]"></div>
                  </label>
                </div>

                {form.retention_offer_enabled && (
                  <>
                    {/* Quick presets */}
                    <div>
                      <label className="block text-xs font-semibold text-white/60 mb-2">Quick presets</label>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { label: '25% off forever', p: 25, m: null },
                          { label: '50% off for 2 months', p: 50, m: 2 },
                          { label: '50% off for 1 month', p: 50, m: 1 },
                          { label: '10% off forever', p: 10, m: null },
                        ].map((preset) => {
                          const active = form.retention_offer_percent === preset.p && form.retention_offer_months === preset.m
                          return (
                            <button
                              key={preset.label}
                              type="button"
                              onClick={() => setForm({ ...form, retention_offer_percent: preset.p, retention_offer_months: preset.m })}
                              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                                active
                                  ? 'bg-[#4ecde6] text-[#0a0a0a]'
                                  : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                              }`}
                            >
                              {preset.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Custom inputs */}
                    <div className="grid grid-cols-2 gap-4 max-w-md">
                      <div>
                        <label className="block text-xs font-semibold text-white/60 mb-1.5">Discount %</label>
                        <div className="relative">
                          <input
                            type="number"
                            min={1}
                            max={90}
                            step={1}
                            value={form.retention_offer_percent}
                            onChange={(e) => setForm({ ...form, retention_offer_percent: Math.max(1, Math.min(90, Number(e.target.value) || 25)) })}
                            className={inputClass + ' pr-10'}
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 text-sm font-semibold">%</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-white/60 mb-1.5">Duration</label>
                        <select
                          value={form.retention_offer_months == null ? 'forever' : String(form.retention_offer_months)}
                          onChange={(e) => setForm({ ...form, retention_offer_months: e.target.value === 'forever' ? null : Number(e.target.value) })}
                          className={inputClass}
                        >
                          <option value="forever">Forever</option>
                          <option value="1">1 month</option>
                          <option value="2">2 months</option>
                          <option value="3">3 months</option>
                          <option value="6">6 months</option>
                          <option value="12">12 months</option>
                        </select>
                      </div>
                    </div>

                    <div className="bg-[#4ecde6]/5 border border-[#4ecde6]/15 rounded-xl p-4 text-sm space-y-1.5">
                      <p className="text-[#4ecde6] font-semibold text-xs uppercase tracking-wider">What parents will see</p>
                      <p className="text-white/70">
                        When a parent on a <strong className="text-white">£50/mo</strong> plan tries to cancel:
                      </p>
                      <p className="text-white/80 pl-4">
                        &quot;Wait! How about <strong className="text-[#4ecde6]">{form.retention_offer_percent}% off</strong> your subscription — {form.retention_offer_months ? `for ${form.retention_offer_months} month${form.retention_offer_months !== 1 ? 's' : ''}` : 'forever'}?&quot;
                      </p>
                      <p className="text-white/60 text-xs pl-4">
                        New rate: £{(50 * (1 - form.retention_offer_percent / 100)).toFixed(2)}/mo
                        {form.retention_offer_months
                          ? ` for ${form.retention_offer_months} month${form.retention_offer_months !== 1 ? 's' : ''}, then back to £50/mo`
                          : ' for as long as they stay subscribed'}
                      </p>
                    </div>
                  </>
                )}

                {!form.retention_offer_enabled && (
                  <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 text-sm text-white/50">
                    No retention offer will be shown. Parents clicking cancel go straight to the confirmation step.
                  </div>
                )}

                <button
                  onClick={() => handleSave({
                    retention_offer_enabled: form.retention_offer_enabled,
                    retention_offer_percent: form.retention_offer_percent,
                    retention_offer_months: form.retention_offer_months,
                  })}
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#4ecde6] text-[#0a0a0a] hover:bg-[#7dddf0] disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Saving...' : 'Save retention offer'}
                </button>
              </div>
            </div>
          )}

          {tab === 'Website Embed' && org && <EmbedCode slug={form.slug} />}

          {tab === 'Data & Backups' && (
            <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] p-6 space-y-5">
              <h2 className="font-bold text-lg">Data & Backups</h2>
              <div className="p-4 rounded-xl border border-[#1e1e1e] space-y-3">
                <div>
                  <p className="font-semibold text-sm">Export All Data</p>
                  <p className="text-xs text-[#888]">Download a backup of all your academy data as JSON</p>
                </div>
                <DataExportButton />
              </div>
            </div>
          )}

          {tab === 'Danger Zone' && (
            <div className="bg-white/[0.05] backdrop-blur-xl rounded-2xl border border-red-500/20 p-6 space-y-5">
              <h2 className="font-bold text-lg text-red-400">Danger Zone</h2>
              <p className="text-sm text-[#888]">These actions are irreversible. Please be careful.</p>

              <div className="p-4 rounded-xl border border-[#1e1e1e] space-y-3">
                <div>
                  <p className="font-semibold text-sm">Export All Data</p>
                  <p className="text-xs text-[#888]">Download all your academy data as CSV files</p>
                </div>
                <a
                  href="/dashboard/exports"
                  className="inline-block px-4 py-2 rounded-lg text-xs font-semibold border border-[#2a2a2a] hover:bg-[#1e1e1e] transition-colors"
                >
                  Go to Exports
                </a>
              </div>

              <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/10 space-y-3">
                <div>
                  <p className="font-semibold text-sm text-red-400">Delete Academy</p>
                  <p className="text-xs text-[#888]">Permanently delete your academy and all data. This cannot be undone.</p>
                </div>
                <div>
                  <label className="text-xs text-[#888] block mb-1.5">
                    Type <strong className="text-red-600">{form.name}</strong> to confirm
                  </label>
                  <input
                    className="w-full bg-[#1a1a1a] border border-red-500/30 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500/30"
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
