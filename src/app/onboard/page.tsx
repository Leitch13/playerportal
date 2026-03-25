'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const STEPS = [
  { label: 'Academy Details', icon: '1' },
  { label: 'Branding', icon: '2' },
  { label: 'Your Account', icon: '3' },
  { label: 'Pricing', icon: '4' },
  { label: 'First Class', icon: '5' },
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
  const router = useRouter()
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

  // Step 3: Account
  const [fullName, setFullName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [password, setPassword] = useState('')

  // Step 4: Pricing
  const [plans, setPlans] = useState([
    { name: '1 Session / Week', amount: '30', sessions: '1' },
    { name: '2 Sessions / Week', amount: '50', sessions: '2' },
    { name: 'Unlimited', amount: '70', sessions: '7' },
  ])

  function updatePlan(index: number, field: string, value: string) {
    setPlans(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p))
  }

  function addPlan() {
    if (plans.length < 5) {
      setPlans(prev => [...prev, { name: '', amount: '', sessions: '1' }])
    }
  }

  function removePlan(index: number) {
    if (plans.length > 1) {
      setPlans(prev => prev.filter((_, i) => i !== index))
    }
  }

  // Step 5: First Class
  const [className, setClassName] = useState('')
  const [classDay, setClassDay] = useState('')
  const [classTime, setClassTime] = useState('')
  const [classCapacity, setClassCapacity] = useState('20')

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

  async function handleSubmit(skipClass = false) {
    if (!skipClass && !validateStep()) return
    setLoading(true)
    setError(null)

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
      }

      if (!skipClass && className && classDay && classTime) {
        orgPayload.className = className
        orgPayload.classDay = classDay
        orgPayload.classTime = classTime
        orgPayload.classCapacity = classCapacity
      }

      const res = await fetch('/api/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...orgPayload,
          plans: plans.filter(p => p.name && p.amount).map(p => ({
            name: p.name,
            amount: parseFloat(p.amount) || 0,
            sessions_per_week: parseInt(p.sessions) || 1,
          })),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to create academy')
        setLoading(false)
        return
      }

      // 2. Sign out any existing session first
      const supabase = createClient()
      await supabase.auth.signOut()

      // 3. Sign up the admin user
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: adminEmail,
        password,
        options: {
          data: {
            full_name: fullName,
            org_slug: slug,
            role: 'admin',
          },
        },
      })

      if (signUpError) {
        setError(signUpError.message)
        setLoading(false)
        return
      }

      // If no session returned, try signing in directly
      if (signUpData?.user && !signUpData?.session) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: adminEmail,
          password,
        })

        if (signInError) {
          // Email confirmation is required — show message
          setError('Account created! Check your email to confirm, then sign in at /auth/signin')
          setLoading(false)
          return
        }
      }

      // 4. Redirect to dashboard
      router.push('/dashboard')
      router.refresh() // Clear any cached session data
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
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#4ecde6] to-[#2ba8c3] flex items-center justify-center shadow-lg shadow-[#4ecde6]/20">
            <span className="text-white font-extrabold text-[10px]">PP</span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Player Portal</h1>
        </div>
        <p className="text-white/40 text-sm">Set up your academy in minutes</p>
      </div>

      {/* Progress Steps */}
      <div className="flex justify-center px-4 mb-8">
        <div className="flex items-center gap-0 max-w-xl w-full">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-shrink-0">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                    i < step
                      ? 'bg-accent text-primary'
                      : i === step
                        ? 'bg-accent text-primary ring-4 ring-accent/30'
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
        <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 sm:p-8">
          {/* Error */}
          {error && (
            <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Step 1: Academy Details */}
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-primary mb-1">Academy Details</h2>
                <p className="text-text-light text-sm">Tell us about your football academy</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-primary mb-1">
                  Academy Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={academyName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Elite Football Academy"
                  className="w-full px-4 py-2.5 border border-border rounded-xl text-primary bg-white focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-primary mb-1">
                  Academy Slug <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  placeholder="elite-football-academy"
                  className="w-full px-4 py-2.5 border border-border rounded-xl text-primary bg-white focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition"
                />
                {slug && (
                  <p className="mt-1.5 text-xs text-text-light">
                    Your booking page:{' '}
                    <span className="font-medium text-accent">playerportal.com/book/{slug}</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-primary mb-1">
                  Contact Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="info@youracademy.com"
                  className="w-full px-4 py-2.5 border border-border rounded-xl text-primary bg-white focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-primary mb-1">Contact Phone</label>
                <input
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+44 7700 900000"
                  className="w-full px-4 py-2.5 border border-border rounded-xl text-primary bg-white focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-primary mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Tell parents about your academy..."
                  className="w-full px-4 py-2.5 border border-border rounded-xl text-primary bg-white focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-primary mb-1">Location / City</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. London, UK"
                  className="w-full px-4 py-2.5 border border-border rounded-xl text-primary bg-white focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition"
                />
              </div>
            </div>
          )}

          {/* Step 2: Branding */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-primary mb-1">Branding</h2>
                <p className="text-text-light text-sm">Customise the look of your booking page</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-primary mb-1">Primary Colour</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-12 h-10 rounded-lg border border-border cursor-pointer"
                  />
                  <input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="flex-1 px-4 py-2.5 border border-border rounded-xl text-primary bg-white focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition font-mono text-sm"
                  />
                </div>
                <div className="mt-3 rounded-xl p-4" style={{ backgroundColor: primaryColor }}>
                  <p className="text-white text-sm font-medium">Preview: This is how your accent colour looks</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-primary mb-1">Logo URL</label>
                <input
                  type="url"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://example.com/logo.png"
                  className="w-full px-4 py-2.5 border border-border rounded-xl text-primary bg-white focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition"
                />
                <p className="mt-1 text-xs text-text-light">Optional. You can add this later from settings.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-primary mb-1">Hero Image URL</label>
                <input
                  type="url"
                  value={heroImageUrl}
                  onChange={(e) => setHeroImageUrl(e.target.value)}
                  placeholder="https://example.com/hero.jpg"
                  className="w-full px-4 py-2.5 border border-border rounded-xl text-primary bg-white focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition"
                />
                <p className="mt-1 text-xs text-text-light">Optional. Shown at the top of your booking page.</p>
              </div>
            </div>
          )}

          {/* Step 3: Your Account */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-primary mb-1">Your Account</h2>
                <p className="text-text-light text-sm">Create your admin account to manage everything</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-primary mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Smith"
                  className="w-full px-4 py-2.5 border border-border rounded-xl text-primary bg-white focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-primary mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="you@youracademy.com"
                  className="w-full px-4 py-2.5 border border-border rounded-xl text-primary bg-white focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-primary mb-1">
                  Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full px-4 py-2.5 border border-border rounded-xl text-primary bg-white focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition"
                />
              </div>

              <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-3">
                <p className="text-sm text-cyan-800">
                  <span className="font-semibold">Admin role</span> will be assigned automatically.
                  You&apos;ll be able to invite coaches and manage everything from the dashboard.
                </p>
              </div>
            </div>
          )}

          {/* Step 4: Pricing */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-primary mb-1">Set Your Pricing</h2>
                <p className="text-sm text-text-light">Create subscription plans for parents. You can change these anytime.</p>
              </div>

              <div className="space-y-4">
                {plans.map((plan, i) => (
                  <div key={i} className="relative bg-surface rounded-xl p-4 border border-border">
                    {plans.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removePlan(i)}
                        className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center rounded-full text-text-light hover:text-red-500 hover:bg-red-50 transition-colors text-sm"
                      >
                        &times;
                      </button>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-text-light mb-1">Plan Name</label>
                        <input
                          type="text"
                          value={plan.name}
                          onChange={(e) => updatePlan(i, 'name', e.target.value)}
                          placeholder="e.g. 1 Session / Week"
                          className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-text-light mb-1">Price (£/month)</label>
                        <input
                          type="number"
                          value={plan.amount}
                          onChange={(e) => updatePlan(i, 'amount', e.target.value)}
                          placeholder="30"
                          min="0"
                          step="0.01"
                          className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-text-light mb-1">Sessions / Week</label>
                        <select
                          value={plan.sessions}
                          onChange={(e) => updatePlan(i, 'sessions', e.target.value)}
                          className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 bg-white"
                        >
                          <option value="1">1 session</option>
                          <option value="2">2 sessions</option>
                          <option value="3">3 sessions</option>
                          <option value="4">4 sessions</option>
                          <option value="5">5 sessions</option>
                          <option value="7">Unlimited</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {plans.length < 5 && (
                <button
                  type="button"
                  onClick={addPlan}
                  className="w-full py-2.5 border-2 border-dashed border-border rounded-xl text-sm font-medium text-text-light hover:border-accent hover:text-accent transition-colors"
                >
                  + Add Another Plan
                </button>
              )}

              <div className="bg-accent/5 border border-accent/20 rounded-xl p-4">
                <p className="text-xs text-text-light">
                  <strong className="text-text">Tip:</strong> Parents can also pay quarterly (3 months upfront) and get 10% off. This is handled automatically.
                </p>
              </div>
            </div>
          )}

          {/* Step 5: First Class */}
          {step === 4 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-primary mb-1">First Class</h2>
                <p className="text-text-light text-sm">Optionally set up your first training group</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-primary mb-1">Class Name</label>
                <input
                  type="text"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  placeholder="e.g. Under 10s Training"
                  className="w-full px-4 py-2.5 border border-border rounded-xl text-primary bg-white focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-primary mb-1">Day of Week</label>
                <select
                  value={classDay}
                  onChange={(e) => setClassDay(e.target.value)}
                  className="w-full px-4 py-2.5 border border-border rounded-xl text-primary bg-white focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition"
                >
                  <option value="">Select a day</option>
                  <option value="Monday">Monday</option>
                  <option value="Tuesday">Tuesday</option>
                  <option value="Wednesday">Wednesday</option>
                  <option value="Thursday">Thursday</option>
                  <option value="Friday">Friday</option>
                  <option value="Saturday">Saturday</option>
                  <option value="Sunday">Sunday</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-primary mb-1">Start Time</label>
                <input
                  type="text"
                  placeholder="e.g. 17:00 or 5pm"
                  value={classTime}
                  onChange={(e) => setClassTime(e.target.value)}
                  className="w-full px-4 py-2.5 border border-border rounded-xl text-primary bg-white focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-primary mb-1">Max Capacity</label>
                <input
                  type="number"
                  value={classCapacity}
                  onChange={(e) => setClassCapacity(e.target.value)}
                  min="1"
                  max="100"
                  className="w-full px-4 py-2.5 border border-border rounded-xl text-primary bg-white focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition"
                />
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
            {step > 0 ? (
              <button
                type="button"
                onClick={prevStep}
                disabled={loading}
                className="px-5 py-2.5 text-sm font-medium text-text-light hover:text-primary transition-colors disabled:opacity-50"
              >
                Back
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-3">
              {step === 4 && (
                <button
                  type="button"
                  onClick={() => handleSubmit(true)}
                  disabled={loading}
                  className="px-5 py-2.5 text-sm font-medium text-text-light hover:text-primary transition-colors disabled:opacity-50"
                >
                  Skip &mdash; I&apos;ll set this up later
                </button>
              )}

              {step < STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={nextStep}
                  className="px-6 py-2.5 bg-accent text-primary rounded-xl text-sm font-bold hover:bg-accent-light transition-colors"
                >
                  Continue
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSubmit(false)}
                  disabled={loading}
                  className="px-6 py-2.5 bg-accent text-primary rounded-xl text-sm font-bold hover:bg-accent-light transition-colors disabled:opacity-50 flex items-center gap-2"
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
