'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { StartDatePicker } from '@/components/billing/StartDatePicker'
import { isoDate } from '@/lib/billing/next-session'
import { isSocialLoginEnabled, signInWithGoogle } from '@/lib/social-login'

interface Plan {
  id: string
  name: string
  description: string | null
  amount: number
  sessions_per_week: number
  interval: string
  /** Session-bridge support (migration 072). NULL = falls back to calendar. */
  sessions_per_month?: number | null
}

interface QuickBookFormProps {
  isLoggedIn: boolean
  existingChildren: { id: string; first_name: string; last_name: string }[]
  plans: Plan[]
  orgSlug: string
  orgId: string
  orgName: string
  groupId: string
  groupName: string
  primaryColor: string
  /** Class day/time so the picker can default to the next upcoming session. */
  classDayOfWeek?: string | null
  classTimeSlot?: string | null
  /**
   * Stage 3 flag, resolved server-side from BILLING_FUTURE_START_ENABLED.
   * When true the picker offers today + future dates (up to today+28); when
   * false it's clamped to today-only (Option B). Default false for safety.
   */
  allowFutureStart?: boolean
  /**
   * Per-org bridge billing mode (server-resolved from
   * organisations.bridge_billing_mode). 'calendar' = current calendar-day
   * proration (default). 'session' = checkout-time bridge for plans with
   * sessions_per_month set.
   */
  bridgeMode?: 'calendar' | 'session'
  /**
   * Global quarterly safety kill-switch (server-resolved from
   * QUARTERLY_BILLING_ENABLED). When false the monthly/quarterly toggle is
   * hidden and billing stays monthly-only. Default false for safety.
   */
  quarterlyEnabled?: boolean
}

function getQuarterlyPrice(monthlyAmount: number) {
  const total = monthlyAmount * 3
  const discounted = total * 0.9
  return { total, discounted, saving: total - discounted }
}

function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

function FieldError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p className="mt-1 text-xs text-red-400 flex items-center gap-1">
      <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
      {message}
    </p>
  )
}

function AuthSkeleton() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 pb-12 animate-pulse">
      <div className="flex items-center gap-1 mb-8">{[1, 2, 3].map((i) => (<div key={i} className="flex-1"><div className="h-1 rounded-full bg-white/[0.08]" /><div className="h-2 w-12 bg-white/[0.06] rounded mt-1.5" /></div>))}</div>
      {[1, 2, 3].map((i) => (<div key={i} className="mb-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6"><div className="h-5 w-32 bg-white/[0.08] rounded mb-4" /><div className="space-y-3"><div className="h-12 bg-white/[0.04] rounded-xl" /><div className="grid grid-cols-2 gap-3"><div className="h-12 bg-white/[0.04] rounded-xl" /><div className="h-12 bg-white/[0.04] rounded-xl" /></div></div></div>))}
    </div>
  )
}

function SuccessOverlay({ groupName, primaryColor }: { groupName: string; primaryColor: string }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#060606]/90 backdrop-blur-sm">
      <div className="text-center">
        <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center" style={{ backgroundColor: `${primaryColor}20` }}>
          <svg className="w-10 h-10 animate-bounce" style={{ color: primaryColor }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Booking Confirmed!</h2>
        <p className="text-white/60 mb-1">You&apos;re all set for <span className="font-semibold text-white">{groupName}</span></p>
        <p className="text-white/40 text-sm">Redirecting to payment...</p>
        <div className="mt-6"><Spinner size={24} /></div>
      </div>
    </div>
  )
}

export function QuickBookForm({ isLoggedIn, existingChildren, plans, orgSlug, orgId, orgName, groupId, groupName, primaryColor, classDayOfWeek, classTimeSlot, allowFutureStart = false, bridgeMode = 'calendar', quarterlyEnabled = false }: QuickBookFormProps) {
  const [ready, setReady] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [selectedChildId, setSelectedChildId] = useState<string | ''>('')
  const [childFirstName, setChildFirstName] = useState('')
  const [childLastName, setChildLastName] = useState('')
  const [childDob, setChildDob] = useState('')
  const [childLevel, setChildLevel] = useState('development')
  const [childLeague, setChildLeague] = useState('')
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(plans.length === 1 ? plans[0].id : null)
  const [billingOption, setBillingOption] = useState<'monthly' | 'quarterly'>('monthly')
  // URL preselection: when the parent clicks "Subscribe Now" on the class
  // detail page, they arrive with ?plan=<id>&billing=monthly|quarterly.
  // Read window.location.search inside useEffect (client-only) so we don't
  // force the whole route into Suspense via useSearchParams. Safe because
  // initial render uses the same defaults that existed before this fix.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const urlPlan = params.get('plan')
    const urlBilling = params.get('billing')
    if (urlPlan && plans.some((p) => p.id === urlPlan)) {
      setSelectedPlanId(urlPlan)
    }
    if (urlBilling === 'quarterly' || urlBilling === 'monthly') {
      setBillingOption(urlBilling)
    }
  }, [plans])
  // Chosen start date (ISO YYYY-MM-DD).
  // OPTION B: hard-defaulted to today until Stage 3 (future-start cron)
  // ships. When Stage 3 lands, restore the next-session default by
  // re-importing nextSessionDate from '@/lib/billing/next-session' and
  // computing as: nextSessionDate({ day_of_week, time_slot }) ?? new Date().
  // classDayOfWeek + classTimeSlot are still passed to StartDatePicker so
  // it can show the parent when their next class actually is.
  const defaultStartIso = useMemo(() => isoDate(new Date()), [])
  const [startDate, setStartDate] = useState<string>(defaultStartIso)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [globalError, setGlobalError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [activeStep, setActiveStep] = useState(0)
  const sectionRefs = useRef<(HTMLElement | null)[]>([])

  const isNewChild = selectedChildId === '' || selectedChildId === 'new'
  const selectedPlan = plans.find((p) => p.id === selectedPlanId) || null

  useEffect(() => { const t = setTimeout(() => setReady(true), 300); return () => clearTimeout(t) }, [])

  const steps = isLoggedIn ? ['Child', 'Plan', 'Confirm'] : ['Details', 'Child', 'Plan', 'Confirm']
  const stepOffset = isLoggedIn ? 1 : 0

  const scrollToSection = useCallback((index: number) => {
    setActiveStep(index)
    const el = sectionRefs.current[index]
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  function validateField(field: string, value: string): string {
    if (field === 'fullName') return value.trim().length < 2 ? 'Please enter your full name' : ''
    if (field === 'email') return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? 'Please enter a valid email' : ''
    if (field === 'password') return value.length < 6 ? 'Password must be at least 6 characters' : ''
    if (field === 'childFirstName') return value.trim().length < 1 ? 'First name is required' : ''
    if (field === 'childLastName') return value.trim().length < 1 ? 'Last name is required' : ''
    return ''
  }

  function handleBlur(field: string, value: string) {
    if (!value) return
    setFieldErrors((prev) => ({ ...prev, [field]: validateField(field, value) }))
  }

  function handleDetailsComplete() {
    const errs: Record<string, string> = { fullName: validateField('fullName', fullName), email: validateField('email', email), password: validateField('password', password) }
    setFieldErrors((prev) => ({ ...prev, ...errs }))
    if (!Object.values(errs).some(Boolean) && agreedToTerms) scrollToSection(isLoggedIn ? 0 : 1)
  }

  function handleChildComplete() {
    if (isNewChild) {
      const errs: Record<string, string> = { childFirstName: validateField('childFirstName', childFirstName), childLastName: validateField('childLastName', childLastName) }
      setFieldErrors((prev) => ({ ...prev, ...errs }))
      if (Object.values(errs).some(Boolean)) return
    }
    scrollToSection(isLoggedIn ? 1 : 2)
  }

  async function handleBookAndPay() {
    setGlobalError('')
    setLoading(true)
    try {
      const supabase = createClient()
      let userId: string | null = null
      if (!isLoggedIn) {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName, phone, role: 'parent', org_slug: orgSlug.trim().toLowerCase() } } })
        if (signUpError) { setGlobalError(signUpError.message); setLoading(false); return }
        userId = signUpData.user?.id || null
        fetch('/api/email/welcome', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ parentName: fullName, parentEmail: email, academyName: orgName }) }).catch(() => {})
      } else {
        const { data: { user } } = await supabase.auth.getUser()
        userId = user?.id || null
      }
      if (!userId) { setGlobalError('Could not authenticate. Please try again.'); setLoading(false); return }

      // Record T&C acceptance for audit trail — best-effort, never blocks booking.
      // - New signup (!isLoggedIn): they ticked agreedToTerms in step 1
      // - Logged-in: they saw the "By booking you confirm..." note above the pay button
      // Either way, the act of clicking Book & Pay is the acceptance event.
      try {
        const { data: orgRow } = await supabase.from('organisations').select('terms_text').eq('id', orgId).single()
        const txt = (orgRow?.terms_text as string | null) || ''
        let h = 5381
        for (let i = 0; i < txt.length; i++) h = ((h << 5) + h) ^ txt.charCodeAt(i)
        const versionHash = (h >>> 0).toString(16) + '-' + txt.length
        await supabase.from('academy_terms_acceptances').insert({
          profile_id: userId,
          organisation_id: orgId,
          terms_version_hash: versionHash,
          user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 200) : null,
        })
      } catch { /* non-fatal */ }

      let playerId: string
      if (isNewChild) {
        const { data: profile } = await supabase.from('profiles').select('organisation_id').eq('id', userId).single()
        const { data: child, error: childError } = await supabase.from('players').insert({ organisation_id: profile?.organisation_id || orgId, parent_id: userId, first_name: childFirstName, last_name: childLastName, date_of_birth: childDob || null, playing_level: childLevel, league_level: childLeague || null }).select('id').single()
        if (childError || !child) { setGlobalError(childError?.message || 'Failed to add child'); setLoading(false); return }
        playerId = child.id
      } else {
        playerId = selectedChildId
      }

      // ─── Don't create the enrolment here ───
      // The Stripe webhook creates the enrolment AFTER payment succeeds
      // (using supabase_class_id metadata on the Checkout Session).
      // This closes a loophole where parents could book a class, abandon
      // Stripe Checkout, and still have an active enrolment.
      // See task #77 / migration 058.

      if (!selectedPlanId) {
        setGlobalError('Please select a plan to continue.')
        setLoading(false)
        return
      }

      setShowSuccess(true)
      const res = await fetch('/api/stripe/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: selectedPlanId,
          playerId,
          billingOption,
          classId: groupId, // ← critical: webhook uses this to enrol player on payment success
          // Stage 1: chosen start date for the enrolment. Captured in metadata so
          // Stage 2 can read it for the prorated billing branch. Sent on every
          // signup — the subscribe route + webhook decide what to do with it
          // based on the feature flag.
          activatesOn: startDate || defaultStartIso,
        }),
      })
      const data = await res.json()
      if (data.url) {
        // Booking confirmation email fires from the Stripe webhook after payment,
        // not here — sending it now would be misleading if Checkout was abandoned.
        setTimeout(() => { window.location.href = data.url }, 1200)
        return
      } else {
        setShowSuccess(false)
        // Map known API error codes to friendly text. Anything we don't
        // recognise falls through to the API's `error` field as-is, or a
        // generic fallback if the response had no error field at all.
        const friendly =
          data.error === 'class_full'
            ? 'This class is full — please join the waitlist.'
            : (data.error || 'Failed to start payment')
        setGlobalError(friendly)
        setLoading(false)
        return
      }
    } catch { setShowSuccess(false); setGlobalError('Something went wrong. Please try again.'); setLoading(false) }
  }

  const canSubmit = (isLoggedIn || (fullName && email && password && agreedToTerms)) && (isNewChild ? childFirstName && childLastName : !!selectedChildId) && !!selectedPlanId
  const childDisplayName = isNewChild ? `${childFirstName} ${childLastName}`.trim() : existingChildren.find((c) => c.id === selectedChildId) ? `${existingChildren.find((c) => c.id === selectedChildId)!.first_name} ${existingChildren.find((c) => c.id === selectedChildId)!.last_name}` : ''
  const displayPrice = selectedPlan && billingOption === 'monthly' ? `\u00A3${selectedPlan.amount.toFixed(2)}/mo` : selectedPlan ? `\u00A3${getQuarterlyPrice(selectedPlan.amount).discounted.toFixed(2)} for 3 months` : ''

  if (!ready) return <AuthSkeleton />
  if (showSuccess) return <SuccessOverlay groupName={groupName} primaryColor={primaryColor} />

  const inputCls = (field?: string) => `w-full px-4 py-3 rounded-xl bg-white/[0.04] border text-white placeholder:text-white/25 focus:outline-none focus:ring-1 transition-all ${field && fieldErrors[field] ? 'border-red-500/50 focus:border-red-500/70 focus:ring-red-500/20' : 'border-white/[0.08] focus:border-white/20 focus:ring-white/10'}`

  const sectionCls = (idx: number) => `mb-6 rounded-2xl border bg-white/[0.02] backdrop-blur-xl p-6 transition-all ${activeStep === idx ? 'border-white/[0.12]' : 'border-white/[0.06]'}`

  const checkIcon = <svg className="w-5 h-5 ml-auto shrink-0" style={{ color: primaryColor }} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 pb-12">
      {/* Progress */}
      <div className="flex items-center gap-1 mb-8">
        {steps.map((label, i) => {
          const isCurrent = i === activeStep
          const sIdx = i + stepOffset
          const done = sIdx === 0 && !isLoggedIn ? !!(fullName && email && password && agreedToTerms) : sIdx === 1 ? (isNewChild ? !!(childFirstName && childLastName) : !!selectedChildId) : sIdx === 2 ? !!selectedPlanId : false
          return (
            <button key={label} type="button" onClick={() => scrollToSection(i)} className="flex-1">
              <div className="h-1.5 rounded-full transition-all duration-300" style={{ backgroundColor: done || isCurrent ? primaryColor : 'rgba(255,255,255,0.08)' }} />
              <div className="flex items-center gap-1 mt-1.5">
                {done && <svg className="w-3 h-3 shrink-0" style={{ color: primaryColor }} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>}
                <p className={`text-[10px] ${isCurrent ? 'font-bold' : done ? 'text-white/50' : 'text-white/25'}`} style={isCurrent ? { color: primaryColor } : undefined}>Step {i + 1}: {label}</p>
              </div>
            </button>
          )
        })}
      </div>

      {/* Section 1: Details (guests) */}
      {!isLoggedIn && (
        <section ref={(el) => { sectionRefs.current[0] = el }} className={sectionCls(0)} style={activeStep === 0 ? { borderColor: `${primaryColor}40` } : undefined} onFocus={() => setActiveStep(0)}>
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold" style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}>1</span>
            Your Details
            {fullName && email && password && agreedToTerms && checkIcon}
          </h2>

          {/* Google Sign-In — Phase 1. Visible only when the feature flag
              + per-org allowlist allow this academy. After successful
              Google sign-in the parent returns to the booking flow at
              /auth/callback?next=<current URL>, the existing session
              detection takes over, and Step 1 is skipped automatically. */}
          {isSocialLoginEnabled(orgSlug) && (
            <div className="mb-5">
              <button
                type="button"
                onClick={async () => {
                  const r = await signInWithGoogle({
                    orgSlug,
                    next: typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/dashboard',
                  })
                  if (!r.ok) {
                    setGlobalError(r.error)
                  }
                }}
                className="w-full flex items-center justify-center gap-2.5 py-3 rounded-full bg-white text-black text-sm font-semibold hover:bg-white/90 transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z"/>
                </svg>
                Continue with Google
              </button>
              <div className="flex items-center gap-3 mt-3">
                <div className="flex-1 h-px bg-white/10"></div>
                <span className="text-[11px] text-white/40 uppercase tracking-wider">or sign up with email</span>
                <div className="flex-1 h-px bg-white/10"></div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2"><label className="block text-xs text-white/50 mb-1.5">Full Name *</label><input type="text" value={fullName} onChange={(e) => { setFullName(e.target.value); setFieldErrors((p) => ({ ...p, fullName: '' })) }} onBlur={() => handleBlur('fullName', fullName)} placeholder="John Smith" required className={inputCls('fullName')} /><FieldError message={fieldErrors.fullName || null} /></div>
            <div><label className="block text-xs text-white/50 mb-1.5">Email *</label><input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setFieldErrors((p) => ({ ...p, email: '' })) }} onBlur={() => handleBlur('email', email)} placeholder="you@email.com" required className={inputCls('email')} /><FieldError message={fieldErrors.email || null} /></div>
            <div><label className="block text-xs text-white/50 mb-1.5">Phone</label><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07xxx xxxxxx" className={inputCls()} /></div>
            <div className="sm:col-span-2"><label className="block text-xs text-white/50 mb-1.5">Password *</label><input type="password" value={password} onChange={(e) => { setPassword(e.target.value); setFieldErrors((p) => ({ ...p, password: '' })) }} onBlur={() => handleBlur('password', password)} placeholder="Min 6 characters" required minLength={6} className={inputCls('password')} /><FieldError message={fieldErrors.password || null} /></div>
          </div>
          <div className="flex items-start gap-3 mt-4">
            <input type="checkbox" id="quick-terms" checked={agreedToTerms} onChange={(e) => setAgreedToTerms(e.target.checked)} className="mt-1 w-4 h-4 rounded border-white/20 bg-transparent cursor-pointer" style={{ accentColor: primaryColor }} />
            <label htmlFor="quick-terms" className="text-xs text-white/40 cursor-pointer leading-relaxed">I&apos;ve read and agree to <Link href={`/book/${orgSlug.trim().toLowerCase()}/terms`} target="_blank" className="underline hover:text-white/60" style={{ color: primaryColor }}>{orgName}&apos;s Terms &amp; Conditions</Link> and confirm I am the parent or legal guardian of the child being registered.</label>
          </div>
          <button type="button" onClick={handleDetailsComplete} disabled={!fullName || !email || !password || !agreedToTerms} className="mt-4 w-full py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-30" style={{ backgroundColor: primaryColor, color: '#0a0a0a' }}>Continue to Child Details &rarr;</button>
        </section>
      )}

      {/* Section 2: Child */}
      <section ref={(el) => { sectionRefs.current[isLoggedIn ? 0 : 1] = el }} className={sectionCls(isLoggedIn ? 0 : 1)} style={activeStep === (isLoggedIn ? 0 : 1) ? { borderColor: `${primaryColor}40` } : undefined} onFocus={() => setActiveStep(isLoggedIn ? 0 : 1)}>
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold" style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}>{isLoggedIn ? '1' : '2'}</span>
          Your Child
          {(isNewChild ? childFirstName && childLastName : !!selectedChildId) && checkIcon}
        </h2>
        {isLoggedIn && existingChildren.length > 0 && (
          <div className="mb-4"><label className="block text-xs text-white/50 mb-1.5">Select a child or add a new one</label><select value={selectedChildId} onChange={(e) => setSelectedChildId(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10 transition-all appearance-none"><option value="" className="bg-[#111]">-- Add a new child --</option>{existingChildren.map((c) => <option key={c.id} value={c.id} className="bg-[#111]">{c.first_name} {c.last_name}</option>)}</select></div>
        )}
        {isNewChild && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="block text-xs text-white/50 mb-1.5">First Name *</label><input type="text" value={childFirstName} onChange={(e) => { setChildFirstName(e.target.value); setFieldErrors((p) => ({ ...p, childFirstName: '' })) }} onBlur={() => handleBlur('childFirstName', childFirstName)} placeholder="First name" required className={inputCls('childFirstName')} /><FieldError message={fieldErrors.childFirstName || null} /></div>
            <div><label className="block text-xs text-white/50 mb-1.5">Last Name *</label><input type="text" value={childLastName} onChange={(e) => { setChildLastName(e.target.value); setFieldErrors((p) => ({ ...p, childLastName: '' })) }} onBlur={() => handleBlur('childLastName', childLastName)} placeholder="Last name" required className={inputCls('childLastName')} /><FieldError message={fieldErrors.childLastName || null} /></div>
            <div className="sm:col-span-2"><label className="block text-xs text-white/50 mb-1.5">Date of Birth</label><input type="date" value={childDob} onChange={(e) => setChildDob(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10 transition-all [color-scheme:dark]" /></div>
            <div><label className="block text-xs text-white/50 mb-1.5">Player Level</label><select value={childLevel} onChange={(e) => setChildLevel(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10 transition-all appearance-none"><option value="beginner" className="bg-[#111]">Beginner — Just starting out</option><option value="development" className="bg-[#111]">Development — Learning the basics</option><option value="intermediate" className="bg-[#111]">Intermediate — Good understanding</option><option value="advanced" className="bg-[#111]">Advanced — Strong technical ability</option><option value="elite" className="bg-[#111]">Elite — Academy/representative level</option></select></div>
            <div><label className="block text-xs text-white/50 mb-1.5">League Level</label><select value={childLeague} onChange={(e) => setChildLeague(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10 transition-all appearance-none"><option value="" className="bg-[#111]">Select league level...</option><option value="recreational" className="bg-[#111]">Recreational</option><option value="grassroots" className="bg-[#111]">Grassroots</option><option value="b_league" className="bg-[#111]">B League</option><option value="a_league" className="bg-[#111]">A League</option><option value="academy" className="bg-[#111]">Academy</option><option value="professional" className="bg-[#111]">Professional Development</option></select></div>
          </div>
        )}
        <button type="button" onClick={handleChildComplete} disabled={isNewChild ? !childFirstName || !childLastName : !selectedChildId} className="mt-4 w-full py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-30" style={{ backgroundColor: primaryColor, color: '#0a0a0a' }}>Continue to Choose Plan &rarr;</button>
      </section>

      {/* Section 3: Plan */}
      <section ref={(el) => { sectionRefs.current[isLoggedIn ? 1 : 2] = el }} className={sectionCls(isLoggedIn ? 1 : 2)} style={activeStep === (isLoggedIn ? 1 : 2) ? { borderColor: `${primaryColor}40` } : undefined} onFocus={() => setActiveStep(isLoggedIn ? 1 : 2)}>
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold" style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}>{isLoggedIn ? '2' : '3'}</span>
          Choose Plan
          {selectedPlanId && checkIcon}
        </h2>
        {plans.length === 0 ? <p className="text-sm text-white/40">No plans available yet. Please contact the academy.</p> : (
          <>
            {quarterlyEnabled && (
              <div className="bg-white/[0.04] rounded-xl p-1 flex mb-5">
                <button type="button" onClick={() => setBillingOption('monthly')} className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${billingOption === 'monthly' ? 'bg-white/[0.08] text-white shadow-sm' : 'text-white/40 hover:text-white/60'}`}>Pay Monthly</button>
                <button type="button" onClick={() => setBillingOption('quarterly')} className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all relative ${billingOption === 'quarterly' ? 'bg-white/[0.08] text-white shadow-sm' : 'text-white/40 hover:text-white/60'}`}>Pay 3 Months<span className="absolute -top-2 -right-1 bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">-10%</span></button>
              </div>
            )}
            <div className="space-y-3">
              {plans.map((plan) => {
                const monthly = plan.amount
                const quarterly = getQuarterlyPrice(monthly)
                const isSelected = selectedPlanId === plan.id
                return (
                  <button key={plan.id} type="button" onClick={() => {
                    setSelectedPlanId(plan.id)
                    // For quarterly: no start-date picker → scroll straight to Confirm.
                    // For monthly: let the parent see the StartDatePicker that just
                    // rendered below the plan list (it's the next required step).
                    // Previously this auto-scrolled past the picker, leaving parents
                    // unable to choose a future start date.
                    if (billingOption === 'quarterly') {
                      setTimeout(() => scrollToSection(isLoggedIn ? 2 : 3), 300)
                    }
                  }} className={`w-full text-left rounded-xl border-2 p-4 transition-all ${isSelected ? 'bg-white/[0.04]' : 'border-white/[0.06] hover:border-white/[0.12]'}`} style={isSelected ? { borderColor: `${primaryColor}60`, boxShadow: `0 0 20px ${primaryColor}10` } : undefined}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-white">{plan.name}</div>
                        {plan.description && <div className="text-xs text-white/40 mt-0.5">{plan.description}</div>}
                        <div className="text-xs text-white/30 mt-1">{plan.sessions_per_week} session{plan.sessions_per_week !== 1 ? 's' : ''} per week</div>
                      </div>
                      <div className="text-right">
                        {billingOption === 'monthly' ? (<><div className="text-3xl font-extrabold" style={{ color: isSelected ? primaryColor : '#fff' }}>&pound;{monthly.toFixed(0)}</div><div className="text-sm text-white/50 font-medium">/month</div></>) : (<><div className="text-3xl font-extrabold text-green-400">&pound;{quarterly.discounted.toFixed(0)}</div><div className="text-sm text-white/30 line-through">&pound;{quarterly.total.toFixed(0)}</div><div className="text-xs font-bold text-green-400 mt-0.5">Save &pound;{quarterly.saving.toFixed(0)}</div></>)}
                      </div>
                    </div>
                    {isSelected && <div className="mt-3 pt-3 border-t text-xs font-medium flex items-center gap-1" style={{ borderColor: `${primaryColor}30`, color: primaryColor }}><svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>{billingOption === 'monthly' ? 'Auto-renews monthly, cancel anytime' : '3 months upfront, 10% off'}</div>}
                  </button>
                )
              })}
            </div>

            {/* Start-date picker — only shown for monthly subscriptions.
                Quarterly is upfront-and-done, so a start date doesn't change
                the billing math. Captured in metadata regardless of feature
                flag state so it's available the moment Stage 2 activates. */}
            {billingOption === 'monthly' && selectedPlan && (
              <div className="mt-5 pt-5 border-t border-white/[0.06]">
                <StartDatePicker
                  value={startDate}
                  onChange={setStartDate}
                  classDayOfWeek={classDayOfWeek ?? null}
                  classTimeSlot={classTimeSlot ?? null}
                  classLabel={groupName}
                  monthlyAmount={selectedPlan.amount}
                  primaryColor={primaryColor}
                  allowFutureStart={allowFutureStart}
                  bridgeMode={bridgeMode}
                  sessionsPerMonth={selectedPlan.sessions_per_month ?? null}
                />
              </div>
            )}
          </>
        )}
      </section>

      {/* Section 4: Confirm */}
      <section ref={(el) => { sectionRefs.current[isLoggedIn ? 2 : 3] = el }} className={sectionCls(isLoggedIn ? 2 : 3)} style={activeStep === (isLoggedIn ? 2 : 3) ? { borderColor: `${primaryColor}40` } : undefined} onFocus={() => setActiveStep(isLoggedIn ? 2 : 3)}>
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold" style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}>{isLoggedIn ? '3' : '4'}</span>
          Confirm &amp; Pay
        </h2>
        <div className="space-y-3 mb-6 bg-white/[0.02] rounded-xl p-4 border border-white/[0.04]">
          <div className="flex items-center justify-between text-sm"><span className="text-white/50">Class</span><span className="font-semibold text-white">{groupName}</span></div>
          {childDisplayName && <div className="flex items-center justify-between text-sm"><span className="text-white/50">Child</span><span className="font-semibold text-white">{childDisplayName}</span></div>}
          {selectedPlan && (<><div className="flex items-center justify-between text-sm"><span className="text-white/50">Plan</span><span className="font-semibold text-white">{selectedPlan.name}</span></div><div className="border-t border-white/[0.06]" /><div className="flex items-center justify-between text-sm"><span className="text-white/50">Total</span><span className="text-lg font-extrabold text-white">{displayPrice}</span></div></>)}
        </div>
        {globalError && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-2">
            <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
            <div><p className="font-medium">Booking failed</p><p className="text-xs text-red-400/70 mt-0.5">{globalError}</p></div>
          </div>
        )}
        {isLoggedIn && (
          <p className="text-[11px] text-white/40 mb-3 leading-snug">
            By booking, you confirm you&apos;ve read{' '}
            <Link href={`/book/${orgSlug.trim().toLowerCase()}/terms`} target="_blank" className="underline hover:text-white/70" style={{ color: primaryColor }}>
              {orgName}&apos;s Terms &amp; Conditions
            </Link>
            .
          </p>
        )}
        <button type="button" onClick={handleBookAndPay} disabled={!canSubmit || loading} className="w-full py-5 rounded-2xl font-extrabold text-xl transition-all hover:scale-[1.02] active:scale-[0.99] disabled:opacity-40 disabled:hover:scale-100 flex items-center justify-center gap-3 shadow-lg" style={{ backgroundColor: canSubmit ? primaryColor : 'rgba(255,255,255,0.06)', color: canSubmit ? '#0a0a0a' : 'rgba(255,255,255,0.3)', boxShadow: canSubmit ? `0 8px 30px ${primaryColor}40` : 'none' }}>
          {loading ? <><Spinner size={22} />Setting up your booking...</> : <>Book &amp; Pay {displayPrice} &rarr;</>}
        </button>
        {!canSubmit && !loading && <p className="text-xs text-white/30 text-center mt-3">Complete all sections above to continue</p>}
        {canSubmit && !loading && (
          <div className="text-center mt-3">
            <p className="text-xs text-white/30">You&apos;ll be redirected to our secure payment page</p>
            <div className="flex items-center justify-center gap-2 mt-2 text-white/20">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
              <span className="text-[10px]">SSL encrypted &middot; Powered by Stripe</span>
            </div>
          </div>
        )}
      </section>

      {!isLoggedIn && (
        <p className="text-center text-sm text-white/40">Already have an account? <Link href={`/auth/signin?redirect=/book/${orgSlug}/class/${groupId}/quick-book`} className="underline hover:text-white/60" style={{ color: primaryColor }}>Sign in</Link></p>
      )}

      {/* Extra bottom padding for sticky bar */}
      <div className="h-24" />

      {/* Sticky bottom booking bar — always visible */}
      {canSubmit && !loading && (
        <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-4 pt-3" style={{ background: 'linear-gradient(to top, #0a0a0a 60%, transparent)' }}>
          <div className="max-w-lg mx-auto">
            <button
              type="button"
              onClick={handleBookAndPay}
              disabled={loading}
              className="w-full py-4 rounded-2xl font-extrabold text-lg transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2"
              style={{ backgroundColor: primaryColor, color: '#0a0a0a', boxShadow: `0 -4px 30px ${primaryColor}50` }}
            >
              Book &amp; Pay {displayPrice} &rarr;
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
