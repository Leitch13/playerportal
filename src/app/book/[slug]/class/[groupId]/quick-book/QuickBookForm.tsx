'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

/* ────────────────────────────────────────────── */
/*  Types                                         */
/* ────────────────────────────────────────────── */

interface Plan {
  id: string
  name: string
  description: string | null
  amount: number
  sessions_per_week: number
  interval: string
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
}

/* ────────────────────────────────────────────── */
/*  Helpers                                       */
/* ────────────────────────────────────────────── */

const STEPS = ['Details', 'Child', 'Plan', 'Confirm'] as const

function getQuarterlyPrice(monthlyAmount: number) {
  const total = monthlyAmount * 3
  const discounted = total * 0.9
  return { total, discounted, saving: total - discounted }
}

function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg
      className="animate-spin"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}

/* ────────────────────────────────────────────── */
/*  Component                                     */
/* ────────────────────────────────────────────── */

export function QuickBookForm({
  isLoggedIn,
  existingChildren,
  plans,
  orgSlug,
  orgId,
  orgName,
  groupId,
  groupName,
  primaryColor,
}: QuickBookFormProps) {
  /* ── State: parent details (section 1) ── */
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [agreedToTerms, setAgreedToTerms] = useState(false)

  /* ── State: child details (section 2) ── */
  const [selectedChildId, setSelectedChildId] = useState<string | ''>('')
  const [childFirstName, setChildFirstName] = useState('')
  const [childLastName, setChildLastName] = useState('')
  const [childDob, setChildDob] = useState('')

  /* ── State: plan (section 3) ── */
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(
    plans.length === 1 ? plans[0].id : null
  )
  const [billingOption, setBillingOption] = useState<'monthly' | 'quarterly'>(
    'monthly'
  )

  /* ── State: global ── */
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeSection, setActiveSection] = useState(0)

  const isNewChild = selectedChildId === '' || selectedChildId === 'new'
  const selectedPlan = plans.find((p) => p.id === selectedPlanId) || null

  /* ── Derived: which step is the furthest completed ── */
  function getCompletedStep(): number {
    // Step 0: Details
    if (!isLoggedIn && (!fullName || !email || !password || !agreedToTerms))
      return 0
    // Step 1: Child
    if (isNewChild && (!childFirstName || !childLastName)) return 1
    if (!isNewChild && !selectedChildId) return 1
    // Step 2: Plan
    if (!selectedPlanId) return 2
    return 3
  }

  const completedStep = getCompletedStep()

  /* ── Scroll to section ── */
  function scrollToSection(index: number) {
    setActiveSection(index)
    const el = document.getElementById(`section-${index}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  /* ── Submit handler ── */
  async function handleBookAndPay() {
    setError('')
    setLoading(true)

    try {
      const supabase = createClient()
      let userId: string | null = null

      /* ── Step A: Sign up if not logged in ── */
      if (!isLoggedIn) {
        const { data: signUpData, error: signUpError } =
          await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                full_name: fullName,
                phone,
                role: 'parent',
                org_slug: orgSlug.trim().toLowerCase(),
              },
            },
          })

        if (signUpError) {
          setError(signUpError.message)
          setLoading(false)
          return
        }

        userId = signUpData.user?.id || null

        // Fire-and-forget welcome email
        fetch('/api/email/welcome', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            parentName: fullName,
            parentEmail: email,
            academyName: orgName,
          }),
        }).catch(() => {})
      } else {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        userId = user?.id || null
      }

      if (!userId) {
        setError('Could not authenticate. Please try again.')
        setLoading(false)
        return
      }

      /* ── Step B: Create or select child ── */
      let playerId: string

      if (isNewChild) {
        // Get profile for org id
        const { data: profile } = await supabase
          .from('profiles')
          .select('organisation_id')
          .eq('id', userId)
          .single()

        const { data: child, error: childError } = await supabase
          .from('players')
          .insert({
            organisation_id: profile?.organisation_id || orgId,
            parent_id: userId,
            first_name: childFirstName,
            last_name: childLastName,
            date_of_birth: childDob || null,
          })
          .select('id')
          .single()

        if (childError || !child) {
          setError(childError?.message || 'Failed to add child')
          setLoading(false)
          return
        }

        playerId = child.id
      } else {
        playerId = selectedChildId
      }

      /* ── Step C: Create enrolment ── */
      const { error: enrolError } = await supabase.from('enrolments').insert({
        player_id: playerId,
        group_id: groupId,
        organisation_id: orgId,
        status: 'active',
        enrolled_at: new Date().toISOString(),
      })

      if (enrolError) {
        // If already enrolled, that's OK — continue to payment
        if (!enrolError.message.includes('duplicate')) {
          setError(enrolError.message)
          setLoading(false)
          return
        }
      }

      /* ── Step D: Create Stripe checkout ── */
      if (selectedPlanId) {
        const res = await fetch('/api/stripe/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            planId: selectedPlanId,
            playerId,
            billingOption,
          }),
        })
        const data = await res.json()

        if (data.url) {
          window.location.href = data.url
          return
        } else {
          setError(data.error || 'Failed to start payment')
          setLoading(false)
          return
        }
      }
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  /* ── Can submit? ── */
  const canSubmit =
    (isLoggedIn || (fullName && email && password && agreedToTerms)) &&
    (isNewChild ? childFirstName && childLastName : !!selectedChildId) &&
    !!selectedPlanId

  /* ── Selected child name for summary ── */
  const childDisplayName = isNewChild
    ? `${childFirstName} ${childLastName}`.trim()
    : existingChildren.find((c) => c.id === selectedChildId)
      ? `${existingChildren.find((c) => c.id === selectedChildId)!.first_name} ${existingChildren.find((c) => c.id === selectedChildId)!.last_name}`
      : ''

  /* ── Price display ── */
  const displayPrice =
    selectedPlan && billingOption === 'monthly'
      ? `\u00A3${selectedPlan.amount.toFixed(2)}/mo`
      : selectedPlan
        ? `\u00A3${getQuarterlyPrice(selectedPlan.amount).discounted.toFixed(2)} for 3 months`
        : ''

  /* ────────────────────────────────────────────── */
  /*  Render                                        */
  /* ────────────────────────────────────────────── */

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 pb-12">
      {/* ── Progress indicator ── */}
      <div className="flex items-center gap-1 mb-8">
        {STEPS.map((label, i) => {
          if (isLoggedIn && i === 0) return null
          const isCompleted = i < completedStep || (i === completedStep && completedStep === 3)
          const isCurrent = i === activeSection
          return (
            <button
              key={label}
              type="button"
              onClick={() => scrollToSection(i)}
              className="flex-1 group"
            >
              <div
                className="h-1 rounded-full transition-all duration-300"
                style={{
                  backgroundColor: isCompleted || isCurrent
                    ? primaryColor
                    : 'rgba(255,255,255,0.08)',
                }}
              />
              <p
                className={`text-[10px] mt-1.5 transition-colors ${
                  isCurrent
                    ? 'font-semibold'
                    : isCompleted
                      ? 'text-white/50'
                      : 'text-white/25'
                }`}
                style={isCurrent ? { color: primaryColor } : undefined}
              >
                {i + 1}. {label}
              </p>
            </button>
          )
        })}
      </div>

      {/* ── SECTION 1: Your Details (guests only) ── */}
      {!isLoggedIn && (
        <section
          id="section-0"
          className="mb-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-6"
          onFocus={() => setActiveSection(0)}
        >
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <span
              className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold"
              style={{
                backgroundColor: `${primaryColor}20`,
                color: primaryColor,
              }}
            >
              1
            </span>
            Your Details
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs text-white/50 mb-1.5">
                Full Name *
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="John Smith"
                required
                className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-white/25 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1.5">
                Email *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                required
                className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-white/25 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1.5">
                Phone
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="07xxx xxxxxx"
                className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-white/25 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10 transition-all"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-white/50 mb-1.5">
                Password *
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 6 characters"
                required
                minLength={6}
                className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-white/25 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10 transition-all"
              />
            </div>
          </div>

          {/* Terms */}
          <div className="flex items-start gap-3 mt-4">
            <input
              type="checkbox"
              id="quick-terms"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-white/20 bg-transparent cursor-pointer accent-current"
              style={{ accentColor: primaryColor }}
            />
            <label
              htmlFor="quick-terms"
              className="text-xs text-white/40 cursor-pointer leading-relaxed"
            >
              I agree to the{' '}
              <Link
                href="/terms"
                target="_blank"
                className="underline hover:text-white/60"
                style={{ color: primaryColor }}
              >
                Terms &amp; Conditions
              </Link>{' '}
              and confirm I am the parent or legal guardian of the child being
              registered.
            </label>
          </div>
        </section>
      )}

      {/* ── SECTION 2: Your Child ── */}
      <section
        id="section-1"
        className="mb-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-6"
        onFocus={() => setActiveSection(1)}
      >
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <span
            className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold"
            style={{
              backgroundColor: `${primaryColor}20`,
              color: primaryColor,
            }}
          >
            {isLoggedIn ? '1' : '2'}
          </span>
          Your Child
        </h2>

        {/* Existing children selector */}
        {isLoggedIn && existingChildren.length > 0 && (
          <div className="mb-4">
            <label className="block text-xs text-white/50 mb-1.5">
              Select a child or add a new one
            </label>
            <select
              value={selectedChildId}
              onChange={(e) => setSelectedChildId(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10 transition-all appearance-none"
            >
              <option value="" className="bg-[#111]">
                -- Add a new child --
              </option>
              {existingChildren.map((c) => (
                <option key={c.id} value={c.id} className="bg-[#111]">
                  {c.first_name} {c.last_name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* New child form */}
        {isNewChild && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-white/50 mb-1.5">
                First Name *
              </label>
              <input
                type="text"
                value={childFirstName}
                onChange={(e) => setChildFirstName(e.target.value)}
                placeholder="First name"
                required
                className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-white/25 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1.5">
                Last Name *
              </label>
              <input
                type="text"
                value={childLastName}
                onChange={(e) => setChildLastName(e.target.value)}
                placeholder="Last name"
                required
                className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-white/25 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10 transition-all"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-white/50 mb-1.5">
                Date of Birth
              </label>
              <input
                type="date"
                value={childDob}
                onChange={(e) => setChildDob(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10 transition-all [color-scheme:dark]"
              />
            </div>
          </div>
        )}
      </section>

      {/* ── SECTION 3: Choose Plan ── */}
      <section
        id="section-2"
        className="mb-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-6"
        onFocus={() => setActiveSection(2)}
      >
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <span
            className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold"
            style={{
              backgroundColor: `${primaryColor}20`,
              color: primaryColor,
            }}
          >
            {isLoggedIn ? '2' : '3'}
          </span>
          Choose Plan
        </h2>

        {plans.length === 0 ? (
          <p className="text-sm text-white/40">
            No plans available yet. Please contact the academy.
          </p>
        ) : (
          <>
            {/* Billing toggle */}
            <div className="bg-white/[0.04] rounded-xl p-1 flex mb-5">
              <button
                type="button"
                onClick={() => setBillingOption('monthly')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  billingOption === 'monthly'
                    ? 'bg-white/[0.08] text-white shadow-sm'
                    : 'text-white/40 hover:text-white/60'
                }`}
              >
                Pay Monthly
              </button>
              <button
                type="button"
                onClick={() => setBillingOption('quarterly')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all relative ${
                  billingOption === 'quarterly'
                    ? 'bg-white/[0.08] text-white shadow-sm'
                    : 'text-white/40 hover:text-white/60'
                }`}
              >
                Pay 3 Months
                <span className="absolute -top-2 -right-1 bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  -10%
                </span>
              </button>
            </div>

            {/* Plan cards */}
            <div className="space-y-3">
              {plans.map((plan) => {
                const monthly = plan.amount
                const quarterly = getQuarterlyPrice(monthly)
                const isSelected = selectedPlanId === plan.id

                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => {
                      setSelectedPlanId(plan.id)
                      setActiveSection(2)
                    }}
                    className={`w-full text-left rounded-xl border-2 p-4 transition-all ${
                      isSelected
                        ? 'bg-white/[0.04]'
                        : 'border-white/[0.06] hover:border-white/[0.12]'
                    }`}
                    style={
                      isSelected
                        ? {
                            borderColor: `${primaryColor}60`,
                            boxShadow: `0 0 20px ${primaryColor}10`,
                          }
                        : undefined
                    }
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-white">{plan.name}</div>
                        {plan.description && (
                          <div className="text-xs text-white/40 mt-0.5">
                            {plan.description}
                          </div>
                        )}
                        <div className="text-xs text-white/30 mt-1">
                          {plan.sessions_per_week} session
                          {plan.sessions_per_week !== 1 ? 's' : ''} per week
                        </div>
                      </div>
                      <div className="text-right">
                        {billingOption === 'monthly' ? (
                          <>
                            <div
                              className="text-2xl font-bold"
                              style={{ color: isSelected ? primaryColor : 'white' }}
                            >
                              &pound;{monthly.toFixed(0)}
                            </div>
                            <div className="text-xs text-white/40">/month</div>
                          </>
                        ) : (
                          <>
                            <div
                              className="text-2xl font-bold text-green-400"
                            >
                              &pound;{quarterly.discounted.toFixed(0)}
                            </div>
                            <div className="text-xs text-white/30 line-through">
                              &pound;{quarterly.total.toFixed(0)}
                            </div>
                            <div className="text-[10px] font-semibold text-green-400 mt-0.5">
                              Save &pound;{quarterly.saving.toFixed(0)}
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Selection indicator */}
                    {isSelected && (
                      <div
                        className="mt-3 pt-3 border-t text-xs font-medium"
                        style={{
                          borderColor: `${primaryColor}30`,
                          color: primaryColor,
                        }}
                      >
                        {billingOption === 'monthly'
                          ? 'Auto-renews monthly, cancel anytime'
                          : '3 months upfront, 10% off'}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </>
        )}
      </section>

      {/* ── SECTION 4: Confirm & Pay ── */}
      <section
        id="section-3"
        className="mb-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-6"
        onFocus={() => setActiveSection(3)}
      >
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <span
            className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold"
            style={{
              backgroundColor: `${primaryColor}20`,
              color: primaryColor,
            }}
          >
            {isLoggedIn ? '3' : '4'}
          </span>
          Confirm &amp; Pay
        </h2>

        {/* Summary */}
        <div className="space-y-3 mb-6">
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/50">Class</span>
            <span className="font-semibold text-white">{groupName}</span>
          </div>
          {childDisplayName && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/50">Child</span>
              <span className="font-semibold text-white">
                {childDisplayName}
              </span>
            </div>
          )}
          {selectedPlan && (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/50">Plan</span>
                <span className="font-semibold text-white">
                  {selectedPlan.name}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/50">Price</span>
                <span className="font-bold" style={{ color: primaryColor }}>
                  {displayPrice}
                </span>
              </div>
            </>
          )}
          <div className="border-t border-white/[0.06]" />
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="button"
          onClick={handleBookAndPay}
          disabled={!canSubmit || loading}
          className="w-full py-4 rounded-2xl font-bold text-lg transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:hover:scale-100 flex items-center justify-center gap-2"
          style={{
            backgroundColor: canSubmit ? primaryColor : 'rgba(255,255,255,0.06)',
            color: canSubmit ? '#0a0a0a' : 'rgba(255,255,255,0.3)',
          }}
        >
          {loading ? (
            <>
              <Spinner size={20} />
              Setting up your booking...
            </>
          ) : (
            <>Book &amp; Pay &rarr;</>
          )}
        </button>

        {!canSubmit && !loading && (
          <p className="text-xs text-white/30 text-center mt-3">
            Complete all sections above to continue
          </p>
        )}

        {canSubmit && !loading && (
          <p className="text-xs text-white/30 text-center mt-3">
            You&apos;ll be redirected to our secure payment page
          </p>
        )}
      </section>

      {/* Already have an account? */}
      {!isLoggedIn && (
        <p className="text-center text-sm text-white/40">
          Already have an account?{' '}
          <Link
            href={`/auth/signin?redirect=/book/${orgSlug}/class/${groupId}/quick-book`}
            className="underline hover:text-white/60"
            style={{ color: primaryColor }}
          >
            Sign in
          </Link>
        </p>
      )}
    </div>
  )
}
