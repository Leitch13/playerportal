'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function SignUpPage() {
  return (<Suspense><SignUp /></Suspense>)
}

function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

function SignUp() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [step, setStep] = useState(1)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [orgSlug, setOrgSlug] = useState('')
  const [orgName, setOrgName] = useState<string | null>(null)
  const [orgColor, setOrgColor] = useState('#4ecde6')
  const [orgError, setOrgError] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [childFirstName, setChildFirstName] = useState('')
  const [childLastName, setChildLastName] = useState('')
  const [childDob, setChildDob] = useState('')
  const [childLevel, setChildLevel] = useState('development')
  const [childMedical, setChildMedical] = useState('')
  const [emergencyName, setEmergencyName] = useState('')
  const [emergencyPhone, setEmergencyPhone] = useState('')
  const [addedChildId, setAddedChildId] = useState<string | null>(null)
  const [plans, setPlans] = useState<{id: string; name: string; description: string | null; amount: number; sessions_per_week: number; interval: string}[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [billingOption, setBillingOption] = useState<'monthly' | 'quarterly'>('monthly')
  const [subscribing, setSubscribing] = useState(false)

  const preSelectedPlan = searchParams.get('plan')
  const isTrial = searchParams.get('trial') === '1'
  const preSelectedBilling = searchParams.get('billing')
  const refCode = searchParams.get('ref') || ''
  const [referrerName, setReferrerName] = useState<string | null>(null)

  useEffect(() => { if (preSelectedBilling === 'quarterly') setBillingOption('quarterly') }, [preSelectedBilling])

  useEffect(() => {
    if (refCode) {
      const supabase = createClient()
      supabase.from('profiles').select('full_name').eq('referral_code', refCode).single().then(({ data }) => { if (data?.full_name) setReferrerName(data.full_name.split(' ')[0]) })
    }
  }, [refCode])

  useEffect(() => { const org = searchParams.get('org'); if (org) { setOrgSlug(org); lookupOrg(org) } }, [searchParams])

  async function lookupOrg(slug: string) {
    if (!slug.trim()) { setOrgName(null); setOrgError(''); return }
    const supabase = createClient()
    const { data } = await supabase.from('organisations').select('name, primary_color').ilike('slug', slug.trim()).single()
    if (data) { setOrgName(data.name); if (data.primary_color) setOrgColor(data.primary_color); setOrgError('') }
    else { setOrgName(null); setOrgError('Organisation not found') }
  }

  async function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault()
    if (!orgSlug.trim()) { setOrgError('Please enter your organisation code'); return }
    if (!orgName) { setOrgError('Invalid organisation code'); return }
    setLoading(true); setError('')
    const supabase = createClient()
    const metadata: Record<string, string> = { full_name: fullName, phone, role: 'parent', org_slug: orgSlug.trim().toLowerCase() }
    if (refCode) metadata.ref_code = refCode
    const { error: signUpError } = await supabase.auth.signUp({ email, password, options: { data: metadata } })
    if (signUpError) { setError(signUpError.message); setLoading(false) }
    else {
      fetch('/api/email/welcome', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ parentName: fullName, parentEmail: email, academyName: orgName || 'Player Portal' }) }).catch(() => {})
      const parts = fullName.trim().split(' ')
      if (parts.length > 1) setChildLastName(parts[parts.length - 1])
      setStep(2); setLoading(false)
    }
  }

  async function handleAddChild(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not signed in'); setLoading(false); return }
    const { data: profile } = await supabase.from('profiles').select('organisation_id').eq('id', user.id).single()
    const { data: child, error: childError } = await supabase.from('players').insert({ organisation_id: profile?.organisation_id, parent_id: user.id, first_name: childFirstName, last_name: childLastName, date_of_birth: childDob || null, medical_info: childMedical || null, emergency_contact_name: emergencyName || null, emergency_contact_phone: emergencyPhone || null, playing_level: childLevel }).select('id').single()
    if (childError) { setError(childError.message); setLoading(false); return }
    setAddedChildId(child.id)
    const { data: plansData } = await supabase.from('subscription_plans').select('id, name, description, amount, sessions_per_week, interval').eq('active', true).order('sort_order')
    setPlans(plansData || [])
    if (preSelectedPlan) { const match = (plansData || []).find(p => p.id === preSelectedPlan); if (match) setSelectedPlanId(match.id) }
    setStep(3); setLoading(false)
  }

  async function handleSubscribe() {
    if (!selectedPlanId || !addedChildId) return
    setSubscribing(true)
    try {
      const res = await fetch('/api/stripe/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ planId: selectedPlanId, playerId: addedChildId, billingOption }) })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else { setError(data.error || 'Failed to start subscription'); setSubscribing(false) }
    } catch { setError('Something went wrong'); setSubscribing(false) }
  }

  function getQuarterlyPrice(monthlyAmount: number) { const total = monthlyAmount * 3; const discounted = total * 0.9; return { total, discounted, saving: total - discounted } }
  function handleSkipPlan() { router.push('/dashboard'); router.refresh() }

  const stepLabels = ['Account', 'Child Details', 'Choose Plan']
  const primaryColor = orgColor
  const inputCls = "w-full px-4 py-3 rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] text-white placeholder:text-white/25 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10 transition-all"

  return (
    <div className="min-h-screen bg-[#060606] flex items-center justify-center px-4 py-8 relative overflow-hidden">
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full blur-[200px] opacity-20" style={{ background: primaryColor }} />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full blur-[150px] opacity-10" style={{ background: primaryColor }} />

      <div className="relative w-full max-w-lg">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-white mb-1">{orgName ? orgName : 'Player Portal'}</h1>
          {orgName && <p className="text-sm text-white/40">Create your account to get started</p>}
          {!orgName && !searchParams.get('org') && <p className="text-sm text-white/40">Sign up to join your academy</p>}
        </div>

        {isTrial && <div className="rounded-xl px-4 py-3 mb-4 border border-green-500/20 bg-green-500/10 backdrop-blur-xl"><p className="text-sm font-medium text-green-400 text-center">&#127881; Free Trial — try a class with no commitment!</p></div>}
        {referrerName && <div className="rounded-xl px-4 py-3 mb-4 border border-purple-500/20 bg-purple-500/10 backdrop-blur-xl flex items-center justify-center gap-2"><span className="text-lg">&#127873;</span><p className="text-sm font-medium text-purple-400">Referred by {referrerName}!</p></div>}

        <div className="rounded-2xl border border-[#1e1e1e] bg-[#141414] p-6 sm:p-8 shadow-2xl">
          <div className="flex items-center gap-1 mb-6">
            {stepLabels.map((label, i) => (
              <div key={label} className="flex-1">
                <div className="h-1.5 rounded-full transition-all duration-500" style={{ backgroundColor: i + 1 <= step ? primaryColor : 'rgba(255,255,255,0.08)' }} />
                <p className={`text-[10px] mt-1.5 transition-colors ${i + 1 === step ? 'font-bold' : i + 1 < step ? 'text-white/50' : 'text-white/25'}`} style={i + 1 === step ? { color: primaryColor } : undefined}>{i + 1}. {label}</p>
              </div>
            ))}
          </div>

          {step === 1 && (
            <form onSubmit={handleCreateAccount} className="space-y-4">
              {!searchParams.get('org') && (
                <div>
                  <label className="block text-xs text-white/50 mb-1.5">Organisation Code *</label>
                  <input type="text" value={orgSlug} onChange={(e) => { setOrgSlug(e.target.value); setOrgError(''); setOrgName(null) }} onBlur={() => lookupOrg(orgSlug)} required placeholder="e.g. jsl" className={inputCls} />
                  {orgName && <p className="text-xs font-medium mt-1" style={{ color: primaryColor }}>&#10003; {orgName}</p>}
                  {orgError && <p className="text-xs text-red-400 mt-1">{orgError}</p>}
                </div>
              )}
              <div><label className="block text-xs text-white/50 mb-1.5">Your Full Name *</label><input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="John Smith" className={inputCls} /></div>
              <div><label className="block text-xs text-white/50 mb-1.5">Email *</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@email.com" className={inputCls} /></div>
              <div><label className="block text-xs text-white/50 mb-1.5">Phone</label><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07xxx xxxxxx" className={inputCls} /></div>
              <div><label className="block text-xs text-white/50 mb-1.5">Password *</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} placeholder="Min 6 characters" className={inputCls} /></div>
              <div className="flex items-start gap-3">
                <input type="checkbox" id="terms" checked={agreedToTerms} onChange={(e) => setAgreedToTerms(e.target.checked)} className="mt-1 w-4 h-4 rounded border-white/20 bg-transparent cursor-pointer" style={{ accentColor: primaryColor }} />
                <label htmlFor="terms" className="text-xs text-white/40 cursor-pointer leading-relaxed">I agree to the <Link href="/terms" target="_blank" className="underline hover:text-white/60" style={{ color: primaryColor }}>Terms &amp; Conditions</Link> and confirm I am the parent or legal guardian of the child being registered.</label>
              </div>
              {error && <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}
              <button type="submit" disabled={loading || !agreedToTerms} className="w-full py-3.5 rounded-xl font-bold text-lg transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 flex items-center justify-center gap-2" style={{ backgroundColor: primaryColor, color: '#0a0a0a' }}>
                {loading ? <><Spinner size={20} />Creating account...</> : 'Next \u2192'}
              </button>
              <p className="text-sm text-white/40 text-center">Already have an account? <Link href="/auth/signin" className="underline hover:text-white/60" style={{ color: primaryColor }}>Sign in</Link></p>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleAddChild} className="space-y-4">
              <div className="rounded-xl px-4 py-3 mb-2 border bg-[#0e0e0e]" style={{ borderColor: `${primaryColor}30` }}><p className="text-sm font-medium" style={{ color: primaryColor }}>Account created! Now add your child&apos;s details.</p></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-white/50 mb-1.5">Child&apos;s First Name *</label><input type="text" value={childFirstName} onChange={(e) => setChildFirstName(e.target.value)} required placeholder="First name" className={inputCls} /></div>
                <div><label className="block text-xs text-white/50 mb-1.5">Last Name *</label><input type="text" value={childLastName} onChange={(e) => setChildLastName(e.target.value)} required placeholder="Last name" className={inputCls} /></div>
              </div>
              <div><label className="block text-xs text-white/50 mb-1.5">Date of Birth</label><input type="date" value={childDob} onChange={(e) => setChildDob(e.target.value)} className={`${inputCls} [color-scheme:dark]`} /></div>
              <div>
                <label className="block text-xs text-white/50 mb-1.5">Player Level</label>
                <select value={childLevel} onChange={(e) => setChildLevel(e.target.value)} className={inputCls + ' appearance-none'}>
                  <option value="beginner" className="bg-[#1a1a1a]">Beginner — Just starting out</option>
                  <option value="development" className="bg-[#1a1a1a]">Development — Learning the basics</option>
                  <option value="intermediate" className="bg-[#1a1a1a]">Intermediate — Good understanding</option>
                  <option value="advanced" className="bg-[#1a1a1a]">Advanced — Strong technical ability</option>
                  <option value="elite" className="bg-[#1a1a1a]">Elite — Academy/representative level</option>
                </select>
              </div>
              <div><label className="block text-xs text-white/50 mb-1.5">Medical / Allergies</label><input type="text" value={childMedical} onChange={(e) => setChildMedical(e.target.value)} placeholder="Any medical conditions or allergies" className={inputCls} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-white/50 mb-1.5">Emergency Contact</label><input type="text" value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} placeholder="Contact name" className={inputCls} /></div>
                <div><label className="block text-xs text-white/50 mb-1.5">Emergency Phone</label><input type="tel" value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} placeholder="Phone number" className={inputCls} /></div>
              </div>
              {error && <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}
              <button type="submit" disabled={loading} className="w-full py-3.5 rounded-xl font-bold text-lg transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 flex items-center justify-center gap-2" style={{ backgroundColor: primaryColor, color: '#0a0a0a' }}>
                {loading ? <><Spinner size={20} />Saving...</> : 'Next \u2192 Choose Plan'}
              </button>
            </form>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="rounded-xl px-4 py-3 mb-2 border bg-[#0e0e0e]" style={{ borderColor: `${primaryColor}30` }}>
                <p className="text-sm font-medium" style={{ color: primaryColor }}>{childFirstName} is registered! Choose a subscription plan below.</p>
                <p className="text-xs text-white/40 mt-1">You&apos;ll only be charged from today — no backdated fees.</p>
              </div>
              {plans.length > 0 ? (
                <div className="space-y-4">
                  <div className="bg-[#1a1a1a] rounded-xl p-1 flex">
                    <button type="button" onClick={() => setBillingOption('monthly')} className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${billingOption === 'monthly' ? 'bg-[#2a2a2a] text-white shadow-sm' : 'text-white/40 hover:text-white/60'}`}>Pay Monthly</button>
                    <button type="button" onClick={() => setBillingOption('quarterly')} className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all relative ${billingOption === 'quarterly' ? 'bg-[#2a2a2a] text-white shadow-sm' : 'text-white/40 hover:text-white/60'}`}>Pay 3 Months<span className="absolute -top-2 -right-1 bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">Save 10%</span></button>
                  </div>
                  {plans.map((plan) => {
                    const monthly = Number(plan.amount)
                    const quarterly = getQuarterlyPrice(monthly)
                    const isSelected = selectedPlanId === plan.id
                    return (
                      <button key={plan.id} type="button" onClick={() => setSelectedPlanId(plan.id)} className={`w-full text-left rounded-xl border-2 p-4 transition-all ${isSelected ? 'bg-[#1a1a1a]' : 'border-[#1e1e1e] hover:border-white/[0.12]'}`} style={isSelected ? { borderColor: `${primaryColor}60`, boxShadow: `0 0 30px ${primaryColor}15, 0 0 60px ${primaryColor}08` } : undefined}>
                        <div className="flex items-center justify-between">
                          <div><div className="font-bold text-white">{plan.name}</div>{plan.description && <div className="text-xs text-white/40 mt-0.5">{plan.description}</div>}<div className="text-xs text-white/30 mt-1">{plan.sessions_per_week} session{plan.sessions_per_week !== 1 ? 's' : ''} per week</div></div>
                          <div className="text-right">{billingOption === 'monthly' ? (<><div className="text-2xl font-bold" style={{ color: isSelected ? primaryColor : 'white' }}>&pound;{monthly.toFixed(0)}</div><div className="text-xs text-white/40">/month</div></>) : (<><div className="text-2xl font-bold text-green-400">&pound;{quarterly.discounted.toFixed(0)}</div><div className="text-xs text-white/30 line-through">&pound;{quarterly.total.toFixed(0)}</div><div className="text-[10px] font-semibold text-green-400 mt-0.5">Save &pound;{quarterly.saving.toFixed(0)}</div></>)}</div>
                        </div>
                        {isSelected && <div className="mt-3 pt-3 border-t text-xs font-medium flex items-center gap-1" style={{ borderColor: `${primaryColor}30`, color: primaryColor }}><svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>{billingOption === 'monthly' ? 'Auto-renews monthly, cancel anytime' : '3 months upfront, 10% off! Covers you for the full quarter'}</div>}
                      </button>
                    )
                  })}
                  <button onClick={handleSubscribe} disabled={!selectedPlanId || subscribing} className="w-full py-3.5 rounded-xl font-bold text-lg transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 flex items-center justify-center gap-2" style={{ backgroundColor: billingOption === 'quarterly' ? '#22c55e' : primaryColor, color: billingOption === 'quarterly' ? 'white' : '#0a0a0a' }}>
                    {subscribing ? <><Spinner size={20} />Setting up payment...</> : billingOption === 'quarterly' ? 'Pay 3 Months & Save 10% \u2192' : 'Subscribe & Pay \u2192'}
                  </button>
                  {billingOption === 'quarterly' && selectedPlanId && <p className="text-xs text-center text-green-400 font-medium">One payment of &pound;{getQuarterlyPrice(Number(plans.find(p => p.id === selectedPlanId)?.amount || 0)).discounted.toFixed(2)} covers 3 full months</p>}
                </div>
              ) : <div className="text-center py-6"><p className="text-sm text-white/40">No plans available yet. Your coach will set these up.</p></div>}
              {error && <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}
              <button onClick={handleSkipPlan} className="w-full py-2 text-sm text-white/40 hover:text-white/60 font-medium transition-colors">Skip for now — I&apos;ll choose later</button>
            </div>
          )}
        </div>
        <p className="text-center text-xs text-white/20 mt-6">Powered by Player Portal</p>
      </div>
    </div>
  )
}
