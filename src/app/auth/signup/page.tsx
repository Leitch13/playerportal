'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import AcademySearch from '@/components/AcademySearch'
import { isQuarterlyEnabledForOrgPublic } from '@/lib/quarterly-billing'

export default function SignUpPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#060606]">
        <Spinner size={24} />
      </div>
    }>
      <SignUp />
    </Suspense>
  )
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
  // Per-org quarterly enablement (allowlist) for this academy — fetched in
  // lookupOrg. Gates the client-side quarterly toggle / pre-selection below.
  const [orgId, setOrgId] = useState<string | null>(null)
  const [orgQuarterlyEnabled, setOrgQuarterlyEnabled] = useState<boolean | null>(null)
  const [orgColor, setOrgColor] = useState('#4ecde6')
  const [orgLogo, setOrgLogo] = useState<string | null>(null)
  const [orgError, setOrgError] = useState('')
  const [showAcademySearch, setShowAcademySearch] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  // True until we've checked whether the user is already signed in. Prevents the
  // step-1 form flashing on screen before the useEffect bumps logged-in users to step 2/3.
  const [detectingSession, setDetectingSession] = useState(true)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [childFirstName, setChildFirstName] = useState('')
  const [childLastName, setChildLastName] = useState('')
  const [childDob, setChildDob] = useState('')
  const [childLevel, setChildLevel] = useState('development')
  const [childLeague, setChildLeague] = useState('')
  const [childMedical, setChildMedical] = useState('')
  const [emergencyName, setEmergencyName] = useState('')
  const [emergencyPhone, setEmergencyPhone] = useState('')
  const [addedChildId, setAddedChildId] = useState<string | null>(null)
  const [plans, setPlans] = useState<{id: string; name: string; description: string | null; amount: number; sessions_per_week: number; interval: string}[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [billingOption, setBillingOption] = useState<'monthly' | 'quarterly'>('monthly')
  const [subscribing, setSubscribing] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const preSelectedPlan = searchParams.get('plan')
  const isTrial = searchParams.get('trial') === '1'
  const preSelectedBilling = searchParams.get('billing')
  const refCode = searchParams.get('ref') || ''
  // class= carries the class the parent came from; used to auto-enrol after subscribe
  const preSelectedClassId = searchParams.get('class')
  // intent=waitlist means the parent landed here from a FULL class page wanting
  // to join its waitlist. After we create their account + child, we skip the
  // subscribe step entirely and POST to /api/waitlist/join, then drop them on
  // the dashboard with a toast.
  const signupIntent = searchParams.get('intent') // 'waitlist' | null
  // billedFrom= (YYYY-MM-DD): MIGRATION links for parents who already prepaid the
  // academy elsewhere. Card captured now, £0 today, first charge on this date.
  const billedFrom = searchParams.get('billedFrom')
  // SECURITY (role-escalation fix): the public signup page must NEVER grant a
  // staff role. Previously ?role=admin / ?role=coach in the URL was trusted and
  // written into user metadata, letting anyone who knew an academy's public slug
  // self-provision as that academy's admin/coach. Self-serve signup is now ALWAYS
  // a parent; coaches/admins are created server-side only (api/onboard/signup and
  // a future invite-token flow). Defense-in-depth: the handle_new_user DB trigger
  // also coerces any metadata role to 'parent', so a direct supabase.auth.signUp
  // that bypasses this page cannot escalate either. URL role param is ignored.
  const isStaffInvite = false
  const inviteRole = 'parent'
  const [referrerName, setReferrerName] = useState<string | null>(null)

  useEffect(() => { if (preSelectedBilling === 'quarterly' && isQuarterlyEnabledForOrgPublic(orgId, orgQuarterlyEnabled)) setBillingOption('quarterly') }, [preSelectedBilling, orgId, orgQuarterlyEnabled])

  // ─── Logged-in parents adding a new subscription ───
  // If the user is already authenticated and lands on /auth/signup (e.g. clicked
  // Subscribe Now on a class detail page), skip step 1 entirely. Jump to step 2
  // if they have no children, or step 3 (plan selection) if they have at least
  // one child registered.
  useEffect(() => {
    let cancelled = false
    // Hard timeout so a hanging Supabase call never leaves the page frozen
    const timeout = setTimeout(() => { if (!cancelled) setDetectingSession(false) }, 4000)
    async function detectExistingSession() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || cancelled) {
          setDetectingSession(false)
          return
        }
      // Pre-fill name/email from profile so the user isn't asked to repeat themselves.
      // ALSO fetch profile.organisation_id so we can detect cross-academy signups —
      // a parent logged in at Academy A who visits Academy B's signup link should
      // NOT re-use Academy A children for an Academy B enrolment (breaks multi-tenancy).
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email, organisation_id')
        .eq('id', user.id)
        .single()
      if (cancelled) return
      if (profile?.full_name) setFullName(profile.full_name)
      if (profile?.email || user.email) setEmail(profile?.email || user.email || '')

      // Resolve the org-param's org id so we can compare against the parent's home org.
      const orgSlugParam = searchParams.get('org')
      let targetOrgId: string | null = null
      if (orgSlugParam) {
        const { data: targetOrg } = await supabase
          .from('organisations')
          .select('id')
          .ilike('slug', orgSlugParam)
          .single()
        targetOrgId = (targetOrg?.id as string) || null
      }
      const isCrossAcademy = !!targetOrgId && !!profile?.organisation_id && targetOrgId !== profile.organisation_id

      // For cross-academy signups, force them to add a fresh child (never reuse one
      // from a different academy — would create cross-tenant enrolments).
      // For same-academy, reuse the most recent child to skip step 2.
      const { data: existingPlayers } = isCrossAcademy
        ? { data: [] }
        : await supabase
            .from('players')
            .select('id, first_name, last_name')
            .eq('parent_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
      if (cancelled) return

      if (existingPlayers && existingPlayers.length > 0) {
        // Reuse the most recent child for the new subscription
        const child = existingPlayers[0]
        setAddedChildId(child.id)
        // Trigger the plan fetch (mirrors handleAddChild's plan-loading logic)
        const { data: classRow } = preSelectedClassId
          ? await supabase
              .from('training_groups')
              .select('class_type')
              .eq('id', preSelectedClassId)
              .single()
          : { data: null }
        const classClassType = (classRow?.class_type as string | null) || null
        type PlanRow = { id: string; name: string; description: string | null; amount: number; sessions_per_week: number; interval: string; class_type: string | null; training_group_id: string | null }
        const baseSelect = 'id, name, description, amount, sessions_per_week, interval, class_type, training_group_id'
        const orgId = (await supabase.from('profiles').select('organisation_id').eq('id', user.id).single()).data?.organisation_id
        let plansData: PlanRow[] = []
        if (preSelectedClassId) {
          const { data } = await supabase.from('subscription_plans').select(baseSelect).eq('active', true).eq('organisation_id', orgId).eq('training_group_id', preSelectedClassId).order('sort_order')
          plansData = (data as PlanRow[] | null) || []
        }
        if (plansData.length === 0 && classClassType) {
          const { data } = await supabase.from('subscription_plans').select(baseSelect).eq('active', true).eq('organisation_id', orgId).eq('class_type', classClassType).is('training_group_id', null).order('sort_order')
          plansData = (data as PlanRow[] | null) || []
        }
        if (plansData.length === 0) {
          const { data } = await supabase.from('subscription_plans').select(baseSelect).eq('active', true).eq('organisation_id', orgId).is('class_type', null).is('training_group_id', null).order('sort_order')
          plansData = (data as PlanRow[] | null) || []
        }
        if (cancelled) return
        setPlans(plansData)
        if (preSelectedPlan) {
          const match = plansData.find((p) => p.id === preSelectedPlan)
          if (match) setSelectedPlanId(match.id)
        }
        setStep(3)
      } else {
        // Logged in but no child yet — skip to step 2 (add child)
        setStep(2)
      }
      } catch { /* non-fatal — fall through to default form */ }
      finally {
        if (!cancelled) setDetectingSession(false)
      }
    }
    detectExistingSession()
    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (refCode) {
      const supabase = createClient()
      supabase.from('profiles').select('full_name').eq('referral_code', refCode).single().then(({ data }) => { if (data?.full_name) setReferrerName(data.full_name.split(' ')[0]) })
    }
  }, [refCode])

  useEffect(() => {
    const org = searchParams.get('org')
    if (org) { setOrgSlug(org); lookupOrg(org); setShowAcademySearch(false) }
    else { setShowAcademySearch(true) }
  }, [searchParams])

  async function lookupOrg(slug: string) {
    if (!slug.trim()) { setOrgName(null); setOrgError(''); return }
    const supabase = createClient()
    const { data } = await supabase.from('organisations').select('id, name, primary_color, logo_url, quarterly_billing_enabled').ilike('slug', slug.trim()).single()
    if (data) { setOrgName(data.name); setOrgId(data.id); setOrgQuarterlyEnabled((data as { quarterly_billing_enabled?: boolean | null }).quarterly_billing_enabled ?? null); if (data.primary_color) setOrgColor(data.primary_color); if (data.logo_url) setOrgLogo(data.logo_url); setOrgError('') }
    else {
      // Migration 094 — the DB trigger now refuses to create a profile when
      // the org_slug doesn't resolve, so blocking submission here surfaces a
      // friendly message instead of letting the user hit a cryptic DB error.
      setOrgName(null); setOrgId(null); setOrgQuarterlyEnabled(null)
      setOrgError("We couldn't find that academy. Please use the booking link your academy sent you.")
    }
  }

  async function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault()
    if (!orgSlug.trim()) { setOrgError('Please enter your organisation code'); return }
    if (!orgName) {
      // Belt-and-braces preflight — the DB trigger will also reject this,
      // but blocking client-side gives the user a friendlier message and
      // avoids creating an auth.users row that has no matching profile.
      setOrgError("We couldn't find that academy. Please use the booking link your academy sent you.")
      return
    }
    setLoading(true); setError('')
    const supabase = createClient()
    const metadata: Record<string, string> = { full_name: fullName, phone, role: inviteRole, org_slug: orgSlug.trim().toLowerCase() }
    if (refCode) metadata.ref_code = refCode
    const { error: signUpError } = await supabase.auth.signUp({ email, password, options: { data: metadata } })
    if (signUpError) { setError(signUpError.message); setLoading(false) }
    else {
      // Staff invites (coach/admin) skip the child/subscription steps and go straight to dashboard
      if (isStaffInvite) {
        setLoading(false)
        router.push('/dashboard')
        return
      }
      // Record the parent's acceptance of the academy's T&Cs for legal compliance.
      // Best-effort — failures here don't block signup. profile_id resolves via auth.uid() in RLS.
      try {
        const { data: { user } } = await supabase.auth.getUser()
        const { data: orgRow } = await supabase
          .from('organisations')
          .select('id, terms_text')
          .ilike('slug', orgSlug.trim().toLowerCase())
          .single()
        if (user && orgRow?.id) {
          // Tiny hash of the terms content so we know which version they accepted.
          const txt = (orgRow.terms_text as string | null) || ''
          let h = 5381
          for (let i = 0; i < txt.length; i++) h = ((h << 5) + h) ^ txt.charCodeAt(i)
          const versionHash = (h >>> 0).toString(16) + '-' + txt.length
          await supabase.from('academy_terms_acceptances').insert({
            profile_id: user.id,
            organisation_id: orgRow.id,
            terms_version_hash: versionHash,
            user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 200) : null,
          })
        }
      } catch { /* non-fatal */ }

      fetch('/api/email/welcome', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ parentName: fullName, parentEmail: email, academyName: orgName || 'Player Portal', academySlug: orgSlug.trim().toLowerCase() }) }).catch(() => {})
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
    const { data: child, error: childError } = await supabase.from('players').insert({ organisation_id: profile?.organisation_id, parent_id: user.id, first_name: childFirstName, last_name: childLastName, date_of_birth: childDob || null, medical_info: childMedical || null, emergency_contact_name: emergencyName || null, emergency_contact_phone: emergencyPhone || null, playing_level: childLevel, league_level: childLeague || null }).select('id').single()
    if (childError) { setError(childError.message); setLoading(false); return }
    setAddedChildId(child.id)

    // Strict class-plan matching with proper precedence:
    //   1. Plans directly linked to this class via training_group_id → use ONLY these
    //   2. Plans tagged with matching class_type (and not linked to other classes) → fallback
    //   3. Truly org-wide plans (no class_type, no training_group_id) → final fallback
    // The Mini Ballers £28 plan is linked via training_group_id, not class_type,
    // so the previous filter was missing it and falling back to org-wide defaults.
    let classClassType: string | null = null
    if (preSelectedClassId) {
      const { data: classRow } = await supabase
        .from('training_groups')
        .select('class_type')
        .eq('id', preSelectedClassId)
        .single()
      classClassType = (classRow?.class_type as string | null) || null
    }

    type PlanRow = { id: string; name: string; description: string | null; amount: number; sessions_per_week: number; interval: string; class_type: string | null; training_group_id: string | null }
    const baseSelect = 'id, name, description, amount, sessions_per_week, interval, class_type, training_group_id'
    let plansData: PlanRow[] = []

    // Tier 1: plans directly linked to this class
    if (preSelectedClassId) {
      const { data } = await supabase
        .from('subscription_plans')
        .select(baseSelect)
        .eq('active', true)
        .eq('organisation_id', profile?.organisation_id)
        .eq('training_group_id', preSelectedClassId)
        .order('sort_order')
      plansData = (data as PlanRow[] | null) || []
    }

    // Tier 2: plans matching this class's class_type (and not linked to other classes)
    if (plansData.length === 0 && classClassType) {
      const { data } = await supabase
        .from('subscription_plans')
        .select(baseSelect)
        .eq('active', true)
        .eq('organisation_id', profile?.organisation_id)
        .eq('class_type', classClassType)
        .is('training_group_id', null)
        .order('sort_order')
      plansData = (data as PlanRow[] | null) || []
    }

    // Tier 3: truly org-wide plans (no class_type, no group link)
    if (plansData.length === 0) {
      const { data } = await supabase
        .from('subscription_plans')
        .select(baseSelect)
        .eq('active', true)
        .eq('organisation_id', profile?.organisation_id)
        .is('class_type', null)
        .is('training_group_id', null)
        .order('sort_order')
      plansData = (data as PlanRow[] | null) || []
    }

    // ── Waitlist intent: skip the subscribe step entirely. Parent came here
    // from a full class page so we just need to add them to the waitlist
    // and drop them on the dashboard. No Stripe in this path.
    if (signupIntent === 'waitlist' && preSelectedClassId) {
      try {
        await fetch('/api/waitlist/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ groupId: preSelectedClassId, playerId: child.id }),
        })
      } catch {
        // Non-fatal — they can still rejoin from the class page or dashboard.
      }
      router.push('/dashboard?welcome=waitlist')
      router.refresh()
      return
    }

    setPlans(plansData)
    if (preSelectedPlan) { const match = (plansData || []).find(p => p.id === preSelectedPlan); if (match) setSelectedPlanId(match.id) }
    setStep(3); setLoading(false)
  }

  async function handleSubscribe() {
    if (!selectedPlanId || !addedChildId) return
    setSubscribing(true)
    try {
      const res = await fetch('/api/stripe/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ planId: selectedPlanId, playerId: addedChildId, billingOption, classId: preSelectedClassId || null, firstBillingDate: billedFrom || null }) })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else { setError(data.error || 'Failed to start subscription'); setSubscribing(false) }
    } catch { setError('Something went wrong'); setSubscribing(false) }
  }

  function getQuarterlyPrice(monthlyAmount: number) { const total = monthlyAmount * 3; const discounted = total * 0.9; return { total, discounted, saving: total - discounted } }
  function handleSkipPlan() { router.push('/dashboard'); router.refresh() }

  const stepLabels = isStaffInvite ? ['Create Account'] : ['Account', 'Child Details', 'Choose Plan']
  const primaryColor = orgColor
  const inputCls = "w-full px-3.5 py-3 sm:px-4 sm:py-3.5 rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] text-white placeholder:text-white/25 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10 transition-all"

  return (
    <div className="min-h-screen bg-[#060606] flex items-center justify-center px-4 py-6 sm:py-8 relative overflow-hidden">
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full blur-[200px] opacity-20" style={{ background: primaryColor }} />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full blur-[150px] opacity-10" style={{ background: primaryColor }} />

      <div className="relative w-full max-w-lg">
        <div className="text-center mb-5 sm:mb-6">
          {orgLogo && orgName && (
            <img src={orgLogo} alt={orgName} className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl object-cover mx-auto mb-2.5 sm:mb-3 bg-[#1a1a1a]" />
          )}
          <h1 className="text-xl sm:text-2xl font-bold text-white mb-1">{orgName ? orgName : 'Player Portal'}</h1>
          {orgName && <p className="text-xs sm:text-sm text-white/40">Create your account to get started</p>}
          {!orgName && !searchParams.get('org') && <p className="text-xs sm:text-sm text-white/40">Sign up to join your academy</p>}
        </div>

        {isTrial && <div className="rounded-xl px-3.5 py-2.5 sm:px-4 sm:py-3 mb-3 sm:mb-4 border border-green-500/20 bg-green-500/10 backdrop-blur-xl"><p className="text-xs sm:text-sm font-medium text-green-400 text-center">&#127881; Free Trial — try a class with no commitment!</p></div>}
        {referrerName && <div className="rounded-xl px-3.5 py-2.5 sm:px-4 sm:py-3 mb-3 sm:mb-4 border border-purple-500/20 bg-purple-500/10 backdrop-blur-xl flex items-center justify-center gap-2"><span className="text-lg">&#127873;</span><p className="text-xs sm:text-sm font-medium text-purple-400">Referred by {referrerName}!</p></div>}

        <div className="rounded-2xl border border-[#1e1e1e] bg-[#141414] p-4 sm:p-8 shadow-2xl">
          {detectingSession ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Spinner size={32} />
              <p className="mt-4 text-sm text-white/50">Loading your booking…</p>
            </div>
          ) : (
          <>
          <div className="flex items-center gap-1 mb-5 sm:mb-6">
            {stepLabels.map((label, i) => (
              <div key={label} className="flex-1">
                <div className="h-1.5 rounded-full transition-all duration-500" style={{ backgroundColor: i + 1 <= step ? primaryColor : 'rgba(255,255,255,0.08)' }} />
                <p className={`text-[10px] mt-1.5 transition-colors ${i + 1 === step ? 'font-bold' : i + 1 < step ? 'text-white/50' : 'text-white/25'}`} style={i + 1 === step ? { color: primaryColor } : undefined}>{i + 1}. {label}</p>
              </div>
            ))}
          </div>

          {step === 1 && showAcademySearch && !orgName && (
            <div className="space-y-3 sm:space-y-4">
              <div>
                <label className="block text-xs sm:text-sm text-white/50 mb-1 sm:mb-1.5">Find Your Academy *</label>
                <AcademySearch
                  onSelect={(academy) => {
                    setOrgSlug(academy.slug)
                    setOrgName(academy.name)
                    if (academy.logo_url) setOrgLogo(academy.logo_url)
                    setShowAcademySearch(false)
                    setOrgError('')
                  }}
                  inputClassName={inputCls}
                />
              </div>
              <div className="relative flex items-center gap-3 text-white/20 text-xs">
                <div className="flex-1 border-t border-white/10" />
                <span>or enter code</span>
                <div className="flex-1 border-t border-white/10" />
              </div>
              <div>
                <label className="block text-xs sm:text-sm text-white/50 mb-1 sm:mb-1.5">Organisation Code</label>
                <input type="text" value={orgSlug} onChange={(e) => { setOrgSlug(e.target.value); setOrgError(''); setOrgName(null) }} onBlur={() => lookupOrg(orgSlug)} placeholder="e.g. jsl" className={inputCls} />
                {orgError && <p className="text-xs text-red-400 mt-1">{orgError}</p>}
              </div>
            </div>
          )}

          {step === 1 && (!showAcademySearch || orgName) && (
            <form onSubmit={handleCreateAccount} className="space-y-3 sm:space-y-4">
              {orgName && !searchParams.get('org') && (
                <div className="flex items-center gap-3 rounded-xl px-4 py-3 border bg-[#0e0e0e]" style={{ borderColor: `${primaryColor}30` }}>
                  {orgLogo && <img src={orgLogo} alt="" className="w-8 h-8 rounded-lg object-cover bg-[#2a2a2a]" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: primaryColor }}>{orgName}</p>
                  </div>
                  <button type="button" onClick={() => { setOrgName(null); setOrgSlug(''); setOrgLogo(null); setOrgColor('#4ecde6'); setShowAcademySearch(true) }} className="text-xs text-white/30 hover:text-white/60 transition-colors">Change</button>
                </div>
              )}
              <div><label className="block text-xs sm:text-sm text-white/50 mb-1 sm:mb-1.5">Your Full Name *</label><input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="John Smith" className={inputCls} /></div>
              <div><label className="block text-xs sm:text-sm text-white/50 mb-1 sm:mb-1.5">Email *</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@email.com" className={inputCls} /></div>
              <div><label className="block text-xs sm:text-sm text-white/50 mb-1 sm:mb-1.5">Phone</label><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07xxx xxxxxx" className={inputCls} /></div>
              <div><label className="block text-xs sm:text-sm text-white/50 mb-1 sm:mb-1.5">Password *</label><div className="relative"><input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} placeholder="Min 6 characters" className={inputCls + ' pr-10'} /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">{showPassword ? (<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9.27-3.11-11-7.5a11.72 11.72 0 013.168-4.477M6.343 6.343A9.97 9.97 0 0112 5c5 0 9.27 3.11 11 7.5a11.7 11.7 0 01-4.373 5.157M6.343 6.343L3 3m3.343 3.343l2.829 2.829M17.657 17.657L21 21m-3.343-3.343l-2.829-2.829M9.878 9.878a3 3 0 104.243 4.243" /></svg>) : (<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>)}</button></div></div>
              <div className="flex items-start gap-2.5 sm:gap-3">
                <input type="checkbox" id="terms" checked={agreedToTerms} onChange={(e) => setAgreedToTerms(e.target.checked)} className="mt-0.5 sm:mt-1 w-4 h-4 rounded border-white/20 bg-transparent cursor-pointer shrink-0" style={{ accentColor: primaryColor }} />
                <label htmlFor="terms" className="text-[11px] sm:text-xs text-white/40 cursor-pointer leading-relaxed">
                  I agree to {orgName ? <Link href={`/book/${orgSlug.trim().toLowerCase()}/terms`} target="_blank" className="underline hover:text-white/60" style={{ color: primaryColor }}>{orgName}&apos;s Terms &amp; Conditions</Link> : <Link href="/terms" target="_blank" className="underline hover:text-white/60" style={{ color: primaryColor }}>the Terms &amp; Conditions</Link>}
                  {orgName && <> and the <Link href="/terms" target="_blank" className="underline hover:text-white/60" style={{ color: primaryColor }}>Player Portal platform terms</Link></>}
                  . I confirm I am the parent or legal guardian of the child being registered.
                </label>
              </div>
              {error && <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}
              <button type="submit" disabled={loading || !agreedToTerms} className="w-full py-3.5 sm:py-4 rounded-xl font-bold text-base sm:text-lg transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 flex items-center justify-center gap-2" style={{ backgroundColor: primaryColor, color: '#0a0a0a' }}>
                {loading ? <><Spinner size={20} />Creating account...</> : 'Next \u2192'}
              </button>
              <p className="text-xs sm:text-sm text-white/40 text-center">Already have an account? <Link href="/auth/signin" className="underline hover:text-white/60" style={{ color: primaryColor }}>Sign in</Link></p>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleAddChild} className="space-y-3 sm:space-y-4">
              <div className="rounded-xl px-3.5 py-2.5 sm:px-4 sm:py-3 mb-2 border bg-[#0e0e0e]" style={{ borderColor: `${primaryColor}30` }}><p className="text-xs sm:text-sm font-medium" style={{ color: primaryColor }}>Account created! Now add your child&apos;s details.</p></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs sm:text-sm text-white/50 mb-1 sm:mb-1.5">Child&apos;s First Name *</label><input type="text" value={childFirstName} onChange={(e) => setChildFirstName(e.target.value)} required placeholder="First name" className={inputCls} /></div>
                <div><label className="block text-xs sm:text-sm text-white/50 mb-1 sm:mb-1.5">Last Name *</label><input type="text" value={childLastName} onChange={(e) => setChildLastName(e.target.value)} required placeholder="Last name" className={inputCls} /></div>
              </div>
              <div><label className="block text-xs sm:text-sm text-white/50 mb-1 sm:mb-1.5">Date of Birth</label><input type="date" value={childDob} onChange={(e) => setChildDob(e.target.value)} className={`${inputCls} [color-scheme:dark]`} /></div>
              <div>
                <label className="block text-xs sm:text-sm text-white/50 mb-1 sm:mb-1.5">Player Level</label>
                <select value={childLevel} onChange={(e) => setChildLevel(e.target.value)} className={inputCls + ' appearance-none'}>
                  <option value="beginner" className="bg-[#1a1a1a]">Beginner — Just starting out</option>
                  <option value="development" className="bg-[#1a1a1a]">Development — Learning the basics</option>
                  <option value="intermediate" className="bg-[#1a1a1a]">Intermediate — Good understanding</option>
                  <option value="advanced" className="bg-[#1a1a1a]">Advanced — Strong technical ability</option>
                  <option value="elite" className="bg-[#1a1a1a]">Elite — Academy/representative level</option>
                </select>
              </div>
              <div>
                <label className="block text-xs sm:text-sm text-white/50 mb-1 sm:mb-1.5">League Level</label>
                <select value={childLeague} onChange={(e) => setChildLeague(e.target.value)} className={inputCls + ' appearance-none'}>
                  <option value="" className="bg-[#1a1a1a]">Select league level...</option>
                  <option value="recreational" className="bg-[#1a1a1a]">Recreational</option>
                  <option value="grassroots" className="bg-[#1a1a1a]">Grassroots</option>
                  <option value="b_league" className="bg-[#1a1a1a]">B League</option>
                  <option value="a_league" className="bg-[#1a1a1a]">A League</option>
                  <option value="academy" className="bg-[#1a1a1a]">Academy</option>
                  <option value="professional" className="bg-[#1a1a1a]">Professional Development</option>
                </select>
              </div>
              <div><label className="block text-xs sm:text-sm text-white/50 mb-1 sm:mb-1.5">Medical / Allergies</label><input type="text" value={childMedical} onChange={(e) => setChildMedical(e.target.value)} placeholder="Any medical conditions or allergies" className={inputCls} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs sm:text-sm text-white/50 mb-1 sm:mb-1.5">Emergency Contact</label><input type="text" value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} placeholder="Contact name" className={inputCls} /></div>
                <div><label className="block text-xs sm:text-sm text-white/50 mb-1 sm:mb-1.5">Emergency Phone</label><input type="tel" value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} placeholder="Phone number" className={inputCls} /></div>
              </div>
              {error && <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}
              <button type="submit" disabled={loading} className="w-full py-3.5 sm:py-4 rounded-xl font-bold text-base sm:text-lg transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 flex items-center justify-center gap-2" style={{ backgroundColor: primaryColor, color: '#0a0a0a' }}>
                {loading ? <><Spinner size={20} />Saving...</> : 'Next \u2192 Choose Plan'}
              </button>
              <button type="button" onClick={() => setStep(1)} className="w-full py-2 text-sm text-white/40 hover:text-white/60 font-medium transition-colors flex items-center justify-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                Back
              </button>
            </form>
          )}

          {step === 3 && (
            <div className="space-y-3 sm:space-y-4">
              <div className="rounded-xl px-3.5 py-2.5 sm:px-4 sm:py-3 mb-2 border bg-[#0e0e0e]" style={{ borderColor: `${primaryColor}30` }}>
                <p className="text-xs sm:text-sm font-medium" style={{ color: primaryColor }}>{childFirstName} is registered! Choose a subscription plan below.</p>
                {billedFrom ? (
                  <p className="text-xs text-white/40 mt-1">
                    You won&apos;t be charged today — your first payment is on{' '}
                    <strong className="text-white/70">
                      {new Date(billedFrom).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </strong>
                    . Add your card now to keep your place.
                  </p>
                ) : (
                  <p className="text-xs text-white/40 mt-1">You&apos;ll only be charged from today — no backdated fees.</p>
                )}
              </div>
              {plans.length > 0 ? (
                <div className="space-y-3 sm:space-y-4">
                  {/* Migration links are monthly-only (deferred first charge can't apply to a one-off quarterly payment).
                      Quarterly toggle also hidden globally while quarterly billing is disabled (safety kill-switch). */}
                  {!billedFrom && isQuarterlyEnabledForOrgPublic(orgId, orgQuarterlyEnabled) && (
                  <div className="bg-[#1a1a1a] rounded-xl p-1 flex">
                    <button type="button" onClick={() => setBillingOption('monthly')} className={`flex-1 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${billingOption === 'monthly' ? 'bg-[#2a2a2a] text-white shadow-sm' : 'text-white/40 hover:text-white/60'}`}>Pay Monthly</button>
                    <button type="button" onClick={() => setBillingOption('quarterly')} className={`flex-1 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-all relative ${billingOption === 'quarterly' ? 'bg-[#2a2a2a] text-white shadow-sm' : 'text-white/40 hover:text-white/60'}`}>Pay 3 Months<span className="absolute -top-2 -right-1 bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">Save 10%</span></button>
                  </div>
                  )}
                  {plans.map((plan) => {
                    const monthly = Number(plan.amount)
                    const quarterly = getQuarterlyPrice(monthly)
                    const isSelected = selectedPlanId === plan.id
                    return (
                      <button key={plan.id} type="button" onClick={() => setSelectedPlanId(plan.id)} className={`w-full text-left rounded-xl border-2 p-3.5 sm:p-4 transition-all ${isSelected ? 'bg-[#1a1a1a]' : 'border-[#1e1e1e] hover:border-white/[0.12]'}`} style={isSelected ? { borderColor: `${primaryColor}60`, boxShadow: `0 0 30px ${primaryColor}15, 0 0 60px ${primaryColor}08` } : undefined}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0"><div className="font-bold text-sm sm:text-base text-white">{plan.name}</div>{plan.description && <div className="text-xs text-white/40 mt-0.5">{plan.description}</div>}<div className="text-xs text-white/30 mt-1">{plan.sessions_per_week} session{plan.sessions_per_week !== 1 ? 's' : ''} per week</div></div>
                          <div className="text-right shrink-0">{billingOption === 'monthly' ? (<><div className="text-xl sm:text-2xl font-bold" style={{ color: isSelected ? primaryColor : 'white' }}>&pound;{monthly.toFixed(0)}</div><div className="text-xs text-white/40">/month</div></>) : (<><div className="text-xl sm:text-2xl font-bold text-green-400">&pound;{quarterly.discounted.toFixed(0)}</div><div className="text-xs text-white/30 line-through">&pound;{quarterly.total.toFixed(0)}</div><div className="text-[10px] font-semibold text-green-400 mt-0.5">Save &pound;{quarterly.saving.toFixed(0)}</div></>)}</div>
                        </div>
                        {isSelected && <div className="mt-2.5 sm:mt-3 pt-2.5 sm:pt-3 border-t text-xs font-medium flex items-center gap-1" style={{ borderColor: `${primaryColor}30`, color: primaryColor }}><svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>{billingOption === 'monthly' ? 'Auto-renews monthly, cancel anytime' : '3 months upfront, 10% off! Covers you for the full quarter'}</div>}
                      </button>
                    )
                  })}
                  <button onClick={handleSubscribe} disabled={!selectedPlanId || subscribing} className="w-full py-3.5 sm:py-4 rounded-xl font-bold text-base sm:text-lg transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 flex items-center justify-center gap-2" style={{ backgroundColor: billingOption === 'quarterly' ? '#22c55e' : primaryColor, color: billingOption === 'quarterly' ? 'white' : '#0a0a0a' }}>
                    {subscribing ? <><Spinner size={20} />Setting up payment...</> : billingOption === 'quarterly' ? 'Pay 3 Months & Save 10% \u2192' : 'Subscribe & Pay \u2192'}
                  </button>
                  {billingOption === 'quarterly' && selectedPlanId && <p className="text-xs text-center text-green-400 font-medium">One payment of &pound;{getQuarterlyPrice(Number(plans.find(p => p.id === selectedPlanId)?.amount || 0)).discounted.toFixed(2)} covers 3 full months</p>}
                </div>
              ) : <div className="text-center py-6"><p className="text-sm text-white/40">No plans available yet. Your coach will set these up.</p></div>}
              {error && <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}
              <button type="button" onClick={() => setStep(2)} className="w-full py-2 text-sm text-white/40 hover:text-white/60 font-medium transition-colors flex items-center justify-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                Back
              </button>
              <button onClick={handleSkipPlan} className="w-full py-2 text-sm text-white/40 hover:text-white/60 font-medium transition-colors">Skip for now — I&apos;ll choose later</button>
            </div>
          )}
          </>
          )}
        </div>
        <p className="text-center text-xs text-white/20 mt-5 sm:mt-6">Powered by Player Portal</p>
      </div>
    </div>
  )
}
