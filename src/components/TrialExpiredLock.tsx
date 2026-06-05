'use client'

import { useEffect, useState } from 'react'

/**
 * Full-screen lock shown to academy ADMINS when their 14-day platform trial
 * has ended and no paid plan is active. Rendered in place of the dashboard
 * by DashboardLayout. Their public booking page + parents are unaffected —
 * only the admin's own dashboard is gated until they choose a plan.
 */

interface PlatformPlan {
  id: string
  slug: string
  name: string
  price_monthly: number | null
  description: string | null
  feature_keys: string[] | null
}

export default function TrialExpiredLock({
  orgName,
  primaryColor,
  reason = 'trial_ended',
}: {
  orgName: string
  primaryColor: string
  reason?: 'trial_ended' | 'lapsed'
}) {
  const [plans, setPlans] = useState<PlatformPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [subscribing, setSubscribing] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/platform/status')
      .then((r) => r.json())
      .then((json) => setPlans((json.allPlans || []) as PlatformPlan[]))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleSubscribe(planSlug: string) {
    setSubscribing(planSlug)
    try {
      const res = await fetch('/api/platform/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planSlug }),
      })
      const json = await res.json()
      if (json.url) {
        window.location.href = json.url
      } else {
        setSubscribing(null)
      }
    } catch {
      setSubscribing(null)
    }
  }

  return (
    <div className="min-h-screen bg-[#060606] text-white flex items-center justify-center px-4 py-10">
      {/* Ambient brand glow */}
      <div
        className="fixed inset-x-0 top-0 h-72 opacity-30 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at top, ${primaryColor}40 0%, transparent 60%)` }}
      />

      <div className="relative w-full max-w-3xl">
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] sm:text-xs font-bold uppercase tracking-wider mb-4"
            style={{ backgroundColor: `${primaryColor}15`, color: primaryColor, border: `1px solid ${primaryColor}30` }}
          >
            {reason === 'lapsed' ? 'Subscription ended' : 'Free trial ended'}
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold mb-2">
            {reason === 'lapsed'
              ? `Reactivate ${orgName} to unlock your dashboard`
              : `Choose a plan to keep ${orgName} live`}
          </h1>
          <p className="text-sm sm:text-base text-white/50 max-w-xl mx-auto">
            {reason === 'lapsed'
              ? 'Your plan has lapsed. Pick a plan to unlock your dashboard again — '
              // Sprint 14b.1 (QW5) — unified copy "Free Trial — …" across
              // every surface. Was: "Your 14-day free trial has finished."
              : 'Your Free Trial has ended. Pick a plan to unlock your dashboard again — '}
            your booking page and parents stay live the whole time.
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-64 rounded-2xl bg-white/[0.04] animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className="rounded-2xl border border-white/[0.08] bg-[#141414] p-4 sm:p-6 flex flex-col"
              >
                <h3 className="text-base sm:text-lg font-bold">{plan.name}</h3>
                {plan.price_monthly != null && (
                  <div className="mt-1 mb-3">
                    <span className="text-2xl sm:text-3xl font-extrabold" style={{ color: primaryColor }}>
                      &pound;{Number(plan.price_monthly).toFixed(0)}
                    </span>
                    <span className="text-xs text-white/40">/mo</span>
                  </div>
                )}
                {plan.description && (
                  <p className="text-xs sm:text-sm text-white/50 mb-4 flex-1">{plan.description}</p>
                )}
                <button
                  onClick={() => handleSubscribe(plan.slug)}
                  disabled={!!subscribing}
                  className="w-full py-3 rounded-xl font-bold text-sm transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:hover:scale-100"
                  style={{ backgroundColor: primaryColor, color: '#0a0a0a' }}
                >
                  {subscribing === plan.slug ? 'Redirecting…' : `Choose ${plan.name}`}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Sprint 14b.1 (QW4) — explicit "need more time?" support
            escape valve. Renders as a softer second card under the
            plan picker so an overwhelmed owner has a clear path
            other than "pay now". The existing support-email line is
            retained below as the secondary touchpoint. */}
        <div className="mt-8 mx-auto max-w-md rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 sm:p-5 text-center">
          <p className="text-sm text-white/70 font-semibold mb-1">Need more time?</p>
          <p className="text-xs text-white/40 mb-3 leading-snug">
            We&apos;re happy to extend your trial — just tell us where you&apos;re at.
          </p>
          <a
            href={`mailto:support@theplayerportal.net?subject=${encodeURIComponent(`${orgName} — trial extension`)}&body=${encodeURIComponent(`Hi, I'd like a bit more time on my Player Portal trial for ${orgName}.`)}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.10] border border-white/10 text-xs font-semibold text-white/80 transition-colors"
          >
            Contact support
            <span aria-hidden>→</span>
          </a>
        </div>

        <p className="text-center text-xs text-white/30 mt-6">
          Questions? Email{' '}
          <a href="mailto:support@theplayerportal.net" className="underline hover:text-white/50">
            support@theplayerportal.net
          </a>
        </p>
      </div>
    </div>
  )
}
