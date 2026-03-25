'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUp />
    </Suspense>
  )
}

function SignUp() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Multi-step: 1 = account, 2 = add child, 3 = choose plan, 4 = done
  const [step, setStep] = useState(1)

  // Step 1: Account
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [orgSlug, setOrgSlug] = useState('')
  const [orgName, setOrgName] = useState<string | null>(null)
  const [orgError, setOrgError] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)

  // Step 2: Child details
  const [childFirstName, setChildFirstName] = useState('')
  const [childLastName, setChildLastName] = useState('')
  const [childDob, setChildDob] = useState('')
  const [childMedical, setChildMedical] = useState('')
  const [emergencyName, setEmergencyName] = useState('')
  const [emergencyPhone, setEmergencyPhone] = useState('')
  const [addedChildId, setAddedChildId] = useState<string | null>(null)

  // Step 3: Plans
  const [plans, setPlans] = useState<{id: string; name: string; description: string | null; amount: number; sessions_per_week: number; interval: string}[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [billingOption, setBillingOption] = useState<'monthly' | 'quarterly'>('monthly')
  const [subscribing, setSubscribing] = useState(false)

  // Pre-fill org slug, plan, billing, and referral from URL
  const preSelectedPlan = searchParams.get('plan')
  const isTrial = searchParams.get('trial') === '1'
  const preSelectedBilling = searchParams.get('billing')
  const refCode = searchParams.get('ref') || ''
  const [referrerName, setReferrerName] = useState<string | null>(null)

  // Auto-set billing option from URL
  useEffect(() => {
    if (preSelectedBilling === 'quarterly') {
      setBillingOption('quarterly')
    }
  }, [preSelectedBilling])

  // Look up who referred them
  useEffect(() => {
    if (refCode) {
      const supabase = createClient()
      supabase
        .from('profiles')
        .select('full_name')
        .eq('referral_code', refCode)
        .single()
        .then(({ data }) => {
          if (data?.full_name) {
            setReferrerName(data.full_name.split(' ')[0]) // first name only
          }
        })
    }
  }, [refCode])

  useEffect(() => {
    const org = searchParams.get('org')
    if (org) {
      setOrgSlug(org)
      lookupOrg(org)
    }
  }, [searchParams])

  async function lookupOrg(slug: string) {
    if (!slug.trim()) {
      setOrgName(null)
      setOrgError('')
      return
    }
    const supabase = createClient()
    const { data } = await supabase
      .from('organisations')
      .select('name')
      .ilike('slug', slug.trim())
      .single()

    if (data) {
      setOrgName(data.name)
      setOrgError('')
    } else {
      setOrgName(null)
      setOrgError('Organisation not found')
    }
  }

  // Step 1: Create account
  async function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault()
    if (!orgSlug.trim()) {
      setOrgError('Please enter your organisation code')
      return
    }
    if (!orgName) {
      setOrgError('Invalid organisation code')
      return
    }

    setLoading(true)
    setError('')

    const supabase = createClient()
    const metadata: Record<string, string> = {
      full_name: fullName,
      phone,
      role: 'parent',
      org_slug: orgSlug.trim().toLowerCase(),
    }
    // Pass referral code to the DB trigger for automatic tracking
    if (refCode) {
      metadata.ref_code = refCode
    }

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
    } else {
      // Send welcome email (fire and forget)
      fetch('/api/email/welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentName: fullName,
          parentEmail: email,
          academyName: orgName || 'Player Portal',
        }),
      }).catch(() => {})

      // Pre-fill child last name from parent
      const parts = fullName.trim().split(' ')
      if (parts.length > 1) setChildLastName(parts[parts.length - 1])
      setStep(2)
      setLoading(false)
    }
  }

  // Step 2: Add child
  async function handleAddChild(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not signed in'); setLoading(false); return }

    // Get org ID
    const { data: profile } = await supabase
      .from('profiles')
      .select('organisation_id')
      .eq('id', user.id)
      .single()

    const { data: child, error: childError } = await supabase
      .from('players')
      .insert({
        organisation_id: profile?.organisation_id,
        parent_id: user.id,
        first_name: childFirstName,
        last_name: childLastName,
        date_of_birth: childDob || null,
        medical_info: childMedical || null,
        emergency_contact_name: emergencyName || null,
        emergency_contact_phone: emergencyPhone || null,
      })
      .select('id')
      .single()

    if (childError) {
      setError(childError.message)
      setLoading(false)
      return
    }

    setAddedChildId(child.id)

    // Fetch available plans
    const { data: plansData } = await supabase
      .from('subscription_plans')
      .select('id, name, description, amount, sessions_per_week, interval')
      .eq('active', true)
      .order('sort_order')

    setPlans(plansData || [])
    // Auto-select plan if passed from booking page
    if (preSelectedPlan) {
      const match = (plansData || []).find(p => p.id === preSelectedPlan)
      if (match) setSelectedPlanId(match.id)
    }
    setStep(3)
    setLoading(false)
  }

  // Step 3: Subscribe to plan
  async function handleSubscribe() {
    if (!selectedPlanId || !addedChildId) return
    setSubscribing(true)

    try {
      const res = await fetch('/api/stripe/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: selectedPlanId, playerId: addedChildId, billingOption }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setError(data.error || 'Failed to start subscription')
        setSubscribing(false)
      }
    } catch {
      setError('Something went wrong')
      setSubscribing(false)
    }
  }

  // Calculate quarterly pricing (10% off 3 months)
  function getQuarterlyPrice(monthlyAmount: number) {
    const total = monthlyAmount * 3
    const discounted = total * 0.9
    return { total, discounted, saving: total - discounted }
  }

  // Skip plan selection
  function handleSkipPlan() {
    router.push('/dashboard')
    router.refresh()
  }

  const stepLabels = ['Account', 'Child Details', 'Choose Plan']

  return (
    <div className="min-h-screen flex items-center justify-center bg-primary px-4 py-8">
      <div className="bg-white rounded-xl border border-border p-8 w-full max-w-lg">
        <h1 className="text-2xl font-bold text-accent mb-1">Player Portal</h1>
        {orgName && (
          <p className="text-sm font-medium text-accent/70 mb-1">Joining {orgName}</p>
        )}
        {isTrial && (
          <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 mt-2">
            <p className="text-sm font-medium text-green-700">🎉 Free Trial — try a class with no commitment!</p>
          </div>
        )}
        {referrerName && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 mt-2 flex items-center gap-2">
            <span className="text-lg">🎁</span>
            <p className="text-sm font-medium text-purple-700">Referred by {referrerName}!</p>
          </div>
        )}

        {/* Progress bar */}
        <div className="flex items-center gap-1 mb-6 mt-4">
          {stepLabels.map((label, i) => (
            <div key={label} className="flex-1">
              <div className={`h-1.5 rounded-full transition-all ${
                i + 1 <= step ? 'bg-accent' : 'bg-gray-200'
              }`} />
              <p className={`text-[10px] mt-1 ${
                i + 1 === step ? 'text-accent font-semibold' : 'text-gray-400'
              }`}>
                {label}
              </p>
            </div>
          ))}
        </div>

        {/* ═══ Step 1: Create Account ═══ */}
        {step === 1 && (
          <form onSubmit={handleCreateAccount} className="space-y-4">
            {!searchParams.get('org') && (
              <div>
                <label className="block text-sm font-medium text-text mb-1">
                  Organisation Code *
                </label>
                <input
                  type="text"
                  value={orgSlug}
                  onChange={(e) => {
                    setOrgSlug(e.target.value)
                    setOrgError('')
                    setOrgName(null)
                  }}
                  onBlur={() => lookupOrg(orgSlug)}
                  required
                  placeholder="e.g. jsl"
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                />
                {orgName && (
                  <p className="text-xs text-accent font-medium mt-1">
                    ✓ {orgName}
                  </p>
                )}
                {orgError && (
                  <p className="text-xs text-danger mt-1">{orgError}</p>
                )}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-text mb-1">Your Full Name *</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                placeholder="John Smith"
                className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text mb-1">Email *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@email.com"
                className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text mb-1">Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="07xxx xxxxxx"
                className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text mb-1">Password *</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="Min 6 characters"
                className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
              />
            </div>
            {/* T&Cs checkbox */}
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="terms"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-border text-accent focus:ring-accent/20 cursor-pointer"
              />
              <label htmlFor="terms" className="text-sm text-text-light cursor-pointer leading-snug">
                I agree to the{' '}
                <Link href="/terms" target="_blank" className="text-accent font-medium hover:underline">
                  Terms &amp; Conditions
                </Link>
                {' '}and confirm I am the parent or legal guardian of the child being registered.
              </label>
            </div>

            {error && <p className="text-sm text-danger">{error}</p>}
            <button
              type="submit"
              disabled={loading || !agreedToTerms}
              className="w-full py-3 bg-accent text-primary rounded-lg font-bold hover:bg-accent-light disabled:opacity-50 transition-colors text-lg"
            >
              {loading ? 'Creating account...' : 'Next →'}
            </button>
            <p className="text-sm text-text-light text-center">
              Already have an account?{' '}
              <Link href="/auth/signin" className="text-accent hover:underline">Sign in</Link>
            </p>
          </form>
        )}

        {/* ═══ Step 2: Add Child ═══ */}
        {step === 2 && (
          <form onSubmit={handleAddChild} className="space-y-4">
            <div className="bg-accent/5 border border-accent/20 rounded-lg px-4 py-3 mb-2">
              <p className="text-sm font-medium text-accent">Account created! Now add your child&apos;s details.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-text mb-1">Child&apos;s First Name *</label>
                <input
                  type="text"
                  value={childFirstName}
                  onChange={(e) => setChildFirstName(e.target.value)}
                  required
                  placeholder="First name"
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text mb-1">Last Name *</label>
                <input
                  type="text"
                  value={childLastName}
                  onChange={(e) => setChildLastName(e.target.value)}
                  required
                  placeholder="Last name"
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-text mb-1">Date of Birth</label>
              <input
                type="date"
                value={childDob}
                onChange={(e) => setChildDob(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text mb-1">Medical / Allergies</label>
              <input
                type="text"
                value={childMedical}
                onChange={(e) => setChildMedical(e.target.value)}
                placeholder="Any medical conditions or allergies"
                className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-text mb-1">Emergency Contact</label>
                <input
                  type="text"
                  value={emergencyName}
                  onChange={(e) => setEmergencyName(e.target.value)}
                  placeholder="Contact name"
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text mb-1">Emergency Phone</label>
                <input
                  type="tel"
                  value={emergencyPhone}
                  onChange={(e) => setEmergencyPhone(e.target.value)}
                  placeholder="Phone number"
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                />
              </div>
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-accent text-primary rounded-lg font-bold hover:bg-accent-light disabled:opacity-50 transition-colors text-lg"
            >
              {loading ? 'Saving...' : 'Next → Choose Plan'}
            </button>
          </form>
        )}

        {/* ═══ Step 3: Choose Plan ═══ */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="bg-accent/5 border border-accent/20 rounded-lg px-4 py-3 mb-2">
              <p className="text-sm font-medium text-accent">
                {childFirstName} is registered! Choose a subscription plan below.
              </p>
              <p className="text-xs text-text-light mt-1">
                You&apos;ll only be charged from today — no backdated fees.
              </p>
            </div>

            {plans.length > 0 ? (
              <div className="space-y-4">
                {/* ── Billing Toggle ── */}
                <div className="bg-gray-50 rounded-xl p-1 flex">
                  <button
                    type="button"
                    onClick={() => setBillingOption('monthly')}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                      billingOption === 'monthly'
                        ? 'bg-white shadow-sm text-text'
                        : 'text-text-light hover:text-text'
                    }`}
                  >
                    Pay Monthly
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingOption('quarterly')}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all relative ${
                      billingOption === 'quarterly'
                        ? 'bg-white shadow-sm text-text'
                        : 'text-text-light hover:text-text'
                    }`}
                  >
                    Pay 3 Months
                    <span className="absolute -top-2 -right-1 bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                      Save 10%
                    </span>
                  </button>
                </div>

                {/* ── Plan Cards ── */}
                {plans.map((plan) => {
                  const monthly = Number(plan.amount)
                  const quarterly = getQuarterlyPrice(monthly)
                  const isSelected = selectedPlanId === plan.id

                  return (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => setSelectedPlanId(plan.id)}
                      className={`w-full text-left rounded-xl border-2 p-4 transition-all ${
                        isSelected
                          ? 'border-accent bg-accent/5 ring-1 ring-accent/20'
                          : 'border-border hover:border-accent/30'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-bold">{plan.name}</div>
                          {plan.description && (
                            <div className="text-xs text-text-light mt-0.5">{plan.description}</div>
                          )}
                          <div className="text-xs text-text-light mt-1">
                            {plan.sessions_per_week} session{plan.sessions_per_week !== 1 ? 's' : ''} per week
                          </div>
                        </div>
                        <div className="text-right">
                          {billingOption === 'monthly' ? (
                            <>
                              <div className="text-2xl font-bold">&pound;{monthly.toFixed(0)}</div>
                              <div className="text-xs text-text-light">/month</div>
                            </>
                          ) : (
                            <>
                              <div className="text-2xl font-bold text-green-600">
                                &pound;{quarterly.discounted.toFixed(0)}
                              </div>
                              <div className="text-xs text-text-light line-through">
                                &pound;{quarterly.total.toFixed(0)}
                              </div>
                              <div className="text-[10px] font-semibold text-green-600 mt-0.5">
                                Save &pound;{quarterly.saving.toFixed(0)}
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {isSelected && billingOption === 'monthly' && (
                        <div className="mt-2 pt-2 border-t border-accent/20 text-xs text-accent font-medium">
                          ✓ Selected — auto-renews monthly, cancel anytime
                        </div>
                      )}
                      {isSelected && billingOption === 'quarterly' && (
                        <div className="mt-2 pt-2 border-t border-green-200 text-xs text-green-600 font-medium">
                          ✓ Selected — 3 months upfront, 10% off! Covers you for the full quarter
                        </div>
                      )}
                    </button>
                  )
                })}

                <button
                  onClick={handleSubscribe}
                  disabled={!selectedPlanId || subscribing}
                  className={`w-full py-3 rounded-lg font-bold disabled:opacity-50 transition-colors text-lg ${
                    billingOption === 'quarterly'
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-accent text-primary hover:bg-accent-light'
                  }`}
                >
                  {subscribing
                    ? 'Setting up payment...'
                    : billingOption === 'quarterly'
                      ? 'Pay 3 Months & Save 10% →'
                      : 'Subscribe & Pay →'}
                </button>

                {billingOption === 'quarterly' && selectedPlanId && (
                  <p className="text-xs text-center text-green-600 font-medium">
                    One payment of &pound;{getQuarterlyPrice(Number(plans.find(p => p.id === selectedPlanId)?.amount || 0)).discounted.toFixed(2)} covers 3 full months
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-sm text-text-light">No plans available yet. Your coach will set these up.</p>
              </div>
            )}

            {error && <p className="text-sm text-danger">{error}</p>}

            <button
              onClick={handleSkipPlan}
              className="w-full py-2 text-sm text-text-light hover:text-text font-medium transition-colors"
            >
              Skip for now — I&apos;ll choose later
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
