'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import FileUpload from '@/components/FileUpload'

const STEPS = [
  { label: 'Academy Details', icon: '1' },
  { label: 'Branding', icon: '2' },
  { label: 'Choose Your Plan', icon: '3' },
  { label: 'Your Account', icon: '4' },
  { label: 'Pricing', icon: '5' },
]

interface PlatformPlan {
  slug: string
  name: string
  monthlyPrice: number
  transactionFee: number
  recommended?: boolean
}

const ALL_FEATURES = [
  'Unlimited players', 'Unlimited classes', 'Full analytics', 'Priority support',
  'Custom branding', 'Merch shop', 'Session planner', 'Drill library',
  'White-label', 'QR attendance', 'Parent portal', 'Messaging',
  'Camps & events', 'CSV exports', 'Audit log',
]

const PLATFORM_PLANS: PlatformPlan[] = [
  {
    slug: 'starter',
    name: 'Starter',
    monthlyPrice: 20,
    transactionFee: 3.5,
  },
  {
    slug: 'pro',
    name: 'Pro',
    monthlyPrice: 30,
    transactionFee: 2,
    recommended: true,
  },
  {
    slug: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: 50,
    transactionFee: 1,
  },
]

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export default function OnboardPage() {
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 1: Academy Details
  const [academyName, setAcademyName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')

  // Step 2: Branding
  const [primaryColor, setPrimaryColor] = useState('#4ecde6')
  const [logoUrl, setLogoUrl] = useState('')
  const [heroImageUrl, setHeroImageUrl] = useState('')

  // Step 3: Plan selection
  const [selectedPlan, setSelectedPlan] = useState<string>('pro')
  const [monthlyVolume, setMonthlyVolume] = useState(2000)

  // Step 4: Account
  const [fullName, setFullName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [password, setPassword] = useState('')

  // Default plans created automatically by API

  // Class setup removed — done from dashboard

  const costBreakdown = useMemo(() => {
    return PLATFORM_PLANS.map((plan) => {
      const fee = (monthlyVolume * plan.transactionFee) / 100
      return {
        slug: plan.slug,
        platformFee: plan.monthlyPrice,
        transactionFee: fee,
        total: plan.monthlyPrice + fee,
      }
    })
  }, [monthlyVolume])

  function handleNameChange(value: string) {
    setAcademyName(value)
    if (!slugEdited) {
      setSlug(slugify(value))
    }
  }

  function handleSlugChange(value: string) {
    setSlugEdited(true)
    setSlug(slugify(value))
  }

  function validateStep(): boolean {
    setError(null)
    if (step === 0) {
      if (!academyName.trim()) { setError('Academy name is required'); return false }
      if (!slug.trim()) { setError('Slug is required'); return false }
      if (!contactEmail.trim()) { setError('Contact email is required'); return false }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) { setError('Please enter a valid email'); return false }
    }
    if (step === 2) {
      if (!selectedPlan) { setError('Please select a plan'); return false }
    }
    if (step === 3) {
      if (!fullName.trim()) { setError('Your full name is required'); return false }
      if (!adminEmail.trim()) { setError('Email is required'); return false }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) { setError('Please enter a valid email'); return false }
      if (password.length < 6) { setError('Password must be at least 6 characters'); return false }
    }
    return true
  }

  function nextStep() {
    if (!validateStep()) return
    if (step === 0 && !adminEmail) {
      setAdminEmail(contactEmail)
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  function prevStep() {
    setError(null)
    setStep((s) => Math.max(s - 1, 0))
  }

  async function handleSubmit() {
    setError(null)

    // Validate account fields
    if (!fullName.trim()) { setError('Your full name is required'); return }
    if (!adminEmail.trim()) { setError('Email is required'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) { setError('Please enter a valid email'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }

    setLoading(true)

    try {
      // 1. Create organisation via API
      const orgPayload: Record<string, string> = {
        name: academyName,
        slug,
        description,
        contactEmail,
        contactPhone,
        location,
        primaryColor,
        logoUrl,
        heroImageUrl,
        platformPlan: selectedPlan,
      }

      // Classes can be added from the dashboard after setup

      const res = await fetch('/api/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orgPayload),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to create academy')
        setLoading(false)
        return
      }

      // 2. Create the admin user account via the API (server-side, no client session issues)
      const signupRes = await fetch('/api/onboard/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: adminEmail,
          password,
          fullName,
          orgSlug: slug,
        }),
      })

      const signupData = await signupRes.json()
      if (!signupRes.ok) {
        setError(signupData.error || 'Failed to create account')
        setLoading(false)
        return
      }

      // 3. Sign in directly with the credentials we just used
      const supabase = createClient()
      await supabase.auth.signOut() // clear any existing session
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: adminEmail,
        password,
      })
      if (signInError) {
        // Fallback to signin page if auto-login fails
        window.location.href = `/auth/signin?email=${encodeURIComponent(adminEmail)}&message=${encodeURIComponent('Academy created! Sign in with your new account.')}`
        return
      }
      // Success — go straight to dashboard (full page reload to establish server cookies)
      window.location.href = '/dashboard'
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong'
      setError(message)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#060606] flex flex-col relative">
      {/* Background effects */}
      <div className="absolute top-0 left-1/3 w-[400px] h-[400px] bg-[#4ecde6]/10 rounded-full blur-[150px] animate-glow pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[300px] h-[300px] bg-blue-600/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <div className="relative py-8 px-4 text-center">
        <div className="inline-flex items-center gap-2 mb-3">
          <img src="/logo.png" alt="Player Portal" className="h-10 w-auto object-contain" />
        </div>
        <p className="text-white/40 text-sm">Set up your academy in minutes</p>
      </div>

      {/* Progress Steps */}
      <div className="flex justify-center px-4 mb-8">
        <div className="flex items-center gap-0 max-w-2xl w-full">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-shrink-0">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                    i < step
                      ? 'bg-[#4ecde6] text-[#0a0a0a]'
                      : i === step
                        ? 'bg-[#4ecde6] text-[#0a0a0a] ring-4 ring-accent/30'
                        : 'bg-white/10 text-white/40'
                  }`}
                >
                  {i < step ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    s.icon
                  )}
                </div>
                <span className={`text-xs mt-1.5 whitespace-nowrap ${i <= step ? 'text-white/80' : 'text-white/30'}`}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`h-0.5 flex-1 mx-2 mt-[-1.25rem] transition-all ${
                    i < step ? 'bg-accent' : 'bg-white/10'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Card */}
      <div className="flex-1 flex items-start justify-center px-4 pb-12">
        <div className={`bg-[#141414] border border-[#1e1e1e] rounded-xl w-full ${step === 2 ? 'max-w-4xl' : 'max-w-lg'} p-6 sm:p-8 transition-all duration-300`}>
          {/* Error */}
          {error && (
            <div className="mb-5 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Step 1: Academy Details */}
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-white mb-1">Academy Details</h2>
                <p className="text-[#888] text-sm">Tell us about your football academy</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-1">
                  Academy Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={academyName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Elite Football Academy"
                  className="w-full px-4 py-2.5 border border-[#2a2a2a] rounded-xl text-white bg-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition placeholder:text-white/30"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-1">
                  Academy Slug <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  placeholder="elite-football-academy"
                  className="w-full px-4 py-2.5 border border-[#2a2a2a] rounded-xl text-white bg-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition placeholder:text-white/30"
                />
                {slug && (
                  <p className="mt-1.5 text-xs text-[#888]">
                    Your booking page:{' '}
                    <span className="font-medium text-accent">theplayerportal.net/book/{slug}</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-1">
                  Contact Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="info@youracademy.com"
                  className="w-full px-4 py-2.5 border border-[#2a2a2a] rounded-xl text-white bg-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition placeholder:text-white/30"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-1">Contact Phone</label>
                <input
                  type="text"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+44 7700 900000"
                  className="w-full px-4 py-2.5 border border-[#2a2a2a] rounded-xl text-white bg-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition placeholder:text-white/30"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Tell parents about your academy..."
                  className="w-full px-4 py-2.5 border border-[#2a2a2a] rounded-xl text-white bg-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition placeholder:text-white/30 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-1">Location / City</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. London, UK"
                  className="w-full px-4 py-2.5 border border-[#2a2a2a] rounded-xl text-white bg-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition placeholder:text-white/30"
                />
              </div>
            </div>
          )}

          {/* Step 2: Branding */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-white mb-1">Branding</h2>
                <p className="text-[#888] text-sm">Customise the look of your booking page</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-1">Primary Colour</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-12 h-10 rounded-lg border border-[#1e1e1e] cursor-pointer"
                  />
                  <input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="flex-1 px-4 py-2.5 border border-[#2a2a2a] rounded-xl text-white bg-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition font-mono text-sm placeholder:text-white/30"
                  />
                </div>
                <div className="mt-3 rounded-xl p-4" style={{ backgroundColor: primaryColor }}>
                  <p className="text-white text-sm font-medium">Preview: This is how your accent colour looks</p>
                </div>
              </div>

              <div>
                <FileUpload
                  bucketName="branding"
                  folder="logos"
                  accept="image/*"
                  onUpload={(url) => setLogoUrl(url)}
                  currentUrl={logoUrl}
                  label="Academy Logo"
                />
                <p className="mt-1 text-xs text-[#888]">Optional. You can add this later from settings.</p>
              </div>

              <div>
                <FileUpload
                  bucketName="branding"
                  folder="heroes"
                  accept="image/*"
                  onUpload={(url) => setHeroImageUrl(url)}
                  currentUrl={heroImageUrl}
                  label="Hero Image (shown on your booking page)"
                />
                <p className="mt-1 text-xs text-[#888]">Optional. You can skip this and add it later.</p>
              </div>
            </div>
          )}

          {/* Step 3: Choose Your Plan */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-bold text-white mb-1">Choose Your Plan</h2>
                <p className="text-[#888] text-sm">All features included. Pick the plan that saves you the most.</p>
              </div>

              {/* Plan Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {PLATFORM_PLANS.map((plan) => {
                  const isSelected = selectedPlan === plan.slug
                  const isRecommended = plan.recommended
                  return (
                    <button
                      key={plan.slug}
                      type="button"
                      onClick={() => setSelectedPlan(plan.slug)}
                      className={`relative flex flex-col rounded-2xl p-5 text-left transition-all duration-200 border-2 ${
                        isSelected
                          ? isRecommended
                            ? 'border-[#4ecde6] bg-gradient-to-b from-[#0a1628] to-[#0d1f3c] shadow-[0_0_30px_rgba(78,205,230,0.2)]'
                            : 'border-[#4ecde6] bg-gradient-to-b from-[#0a1628] to-[#0d1f3c] shadow-lg'
                          : isRecommended
                            ? 'border-[#4ecde6]/40 bg-gradient-to-b from-[#0c1a30] to-[#0f2240] hover:border-[#4ecde6]/70 hover:shadow-[0_0_20px_rgba(78,205,230,0.1)]'
                            : 'border-white/10 bg-gradient-to-b from-[#111827] to-[#1a2332] hover:border-white/20'
                      }`}
                    >
                      {/* Recommended badge */}
                      {isRecommended && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                          <span className="px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-[#4ecde6] to-[#2ba8c3] text-white rounded-full shadow-lg shadow-[#4ecde6]/30">
                            Recommended
                          </span>
                        </div>
                      )}

                      {/* Glass overlay */}
                      <div className="absolute inset-0 rounded-2xl bg-white/[0.03] pointer-events-none" />

                      {/* Selected indicator */}
                      <div className={`absolute top-4 right-4 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                        isSelected ? 'border-[#4ecde6] bg-[#4ecde6]' : 'border-white/20'
                      }`}>
                        {isSelected && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>

                      {/* Plan name */}
                      <h3 className="text-lg font-bold text-white mb-1">{plan.name}</h3>

                      {/* Price */}
                      <div className="flex items-baseline gap-1 mb-1">
                        <span className="text-3xl font-extrabold text-white">&pound;{plan.monthlyPrice}</span>
                        <span className="text-white/40 text-sm">/month</span>
                      </div>

                      {/* Transaction fee */}
                      <p className={`text-sm font-semibold mb-4 ${plan.transactionFee === 1 ? 'text-emerald-400' : 'text-white/50'}`}>
                        {`${plan.transactionFee}% transaction fee`}
                      </p>

                      {/* All features badge */}
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#4ecde6]/5 border border-[#4ecde6]/10">
                        <svg className="w-4 h-4 text-[#4ecde6] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-xs font-semibold text-[#4ecde6]">All features included</span>
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Shared feature list */}
              <div className="bg-gradient-to-b from-[#111827] to-[#1a2332] border border-white/10 rounded-2xl p-5">
                <h4 className="text-sm font-bold text-white mb-3">Every plan includes</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {ALL_FEATURES.map((feature) => (
                    <div key={feature} className="flex items-center gap-2 text-xs text-white/60">
                      <svg className="w-3.5 h-3.5 text-[#4ecde6] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      {feature}
                    </div>
                  ))}
                </div>
              </div>

              {/* Cost comparison calculator */}
              <div className="bg-gradient-to-b from-[#111827] to-[#1a2332] border border-white/10 rounded-2xl p-5">
                <h4 className="text-sm font-bold text-white mb-3">
                  Cost Calculator
                </h4>
                <p className="text-white/50 text-xs mb-4">
                  If your academy processes <span className="text-white font-semibold">&pound;{monthlyVolume.toLocaleString()}</span>/month in payments:
                </p>

                {/* Slider */}
                <div className="mb-5">
                  <input
                    type="range"
                    min={500}
                    max={20000}
                    step={500}
                    value={monthlyVolume}
                    onChange={(e) => setMonthlyVolume(Number(e.target.value))}
                    className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-[#4ecde6] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#4ecde6] [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-[#4ecde6]/30"
                  />
                  <div className="flex justify-between text-xs text-white/30 mt-1">
                    <span>&pound;500</span>
                    <span>&pound;20,000</span>
                  </div>
                </div>

                {/* Breakdown table */}
                <div className="grid grid-cols-3 gap-3">
                  {costBreakdown.map((item) => {
                    const plan = PLATFORM_PLANS.find((p) => p.slug === item.slug)!
                    const isCurrent = selectedPlan === item.slug
                    return (
                      <div
                        key={item.slug}
                        className={`rounded-xl p-3 text-center transition-all ${
                          isCurrent
                            ? 'bg-[#4ecde6]/10 border border-[#4ecde6]/30'
                            : 'bg-white/[0.03] border border-white/5'
                        }`}
                      >
                        <p className={`text-xs font-bold mb-1 ${isCurrent ? 'text-[#4ecde6]' : 'text-white/50'}`}>
                          {plan.name}
                        </p>
                        <p className="text-lg font-extrabold text-white">
                          &pound;{item.total.toFixed(0)}
                        </p>
                        <p className="text-[10px] text-white/30 mt-0.5">
                          &pound;{item.platformFee} + &pound;{item.transactionFee.toFixed(0)} fees
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Trial note */}
              <div className="flex items-center justify-center gap-2 text-sm text-white/50">
                <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>14-day free trial &mdash; no card required</span>
              </div>
            </div>
          )}

          {/* Step 4: Your Account */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-white mb-1">Your Account</h2>
                <p className="text-[#888] text-sm">Create your admin account to manage everything</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Smith"
                  className="w-full px-4 py-2.5 border border-[#2a2a2a] rounded-xl text-white bg-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition placeholder:text-white/30"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="you@youracademy.com"
                  className="w-full px-4 py-2.5 border border-[#2a2a2a] rounded-xl text-white bg-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition placeholder:text-white/30"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-1">
                  Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full px-4 py-2.5 border border-[#2a2a2a] rounded-xl text-white bg-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition placeholder:text-white/30"
                />
              </div>

              <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-3">
                <p className="text-sm text-cyan-400">
                  <span className="font-semibold">Admin role</span> will be assigned automatically.
                  You&apos;ll be able to invite coaches and manage everything from the dashboard.
                </p>
              </div>
            </div>
          )}

          {/* Step 5: Pricing (placeholder — currently auto-created) */}
          {step === 4 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-white mb-1">Pricing</h2>
                <p className="text-[#888] text-sm">Set the plans parents will see on your booking page</p>
              </div>

              <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-4">
                <p className="text-sm text-cyan-400">
                  <span className="font-semibold">Default plans</span> will be created for you automatically:
                </p>
                <ul className="mt-2 space-y-1 text-sm text-cyan-300">
                  <li>1 Session / Week &mdash; &pound;30/month</li>
                  <li>2 Sessions / Week &mdash; &pound;50/month</li>
                  <li>Unlimited &mdash; &pound;70/month</li>
                </ul>
                <p className="mt-2 text-xs text-cyan-400">
                  You can customise plans, pricing, and add new ones from the dashboard after setup.
                </p>
              </div>

              <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
                <h3 className="text-sm font-bold text-white mb-2">Your selected platform plan</h3>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#4ecde6] to-[#2ba8c3] flex items-center justify-center">
                    <span className="text-white font-bold text-xs">
                      {PLATFORM_PLANS.find((p) => p.slug === selectedPlan)?.name.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-white">
                      {PLATFORM_PLANS.find((p) => p.slug === selectedPlan)?.name} Plan
                    </p>
                    <p className="text-xs text-[#888]">
                      &pound;{PLATFORM_PLANS.find((p) => p.slug === selectedPlan)?.monthlyPrice}/month &bull;{' '}
                      {`${PLATFORM_PLANS.find((p) => p.slug === selectedPlan)?.transactionFee}% transaction fee`}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-[#1e1e1e]">
            {step > 0 ? (
              <button
                type="button"
                onClick={prevStep}
                disabled={loading}
                className="px-5 py-2.5 text-sm font-medium text-[#888] hover:text-white transition-colors disabled:opacity-50"
              >
                Back
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-3">

              {step < STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={nextStep}
                  className="px-6 py-2.5 bg-[#4ecde6] text-[#0a0a0a] rounded-xl text-sm font-bold hover:opacity-90 transition-colors"
                >
                  Continue
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSubmit()}
                  disabled={loading}
                  className="px-6 py-2.5 bg-[#4ecde6] text-[#0a0a0a] rounded-xl text-sm font-bold hover:opacity-90 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {loading && (
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                  )}
                  {loading ? 'Creating Academy...' : 'Create Academy'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
