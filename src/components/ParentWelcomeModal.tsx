'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Props {
  parentName: string
  academyName: string
  primaryColor?: string
  firstChildName?: string | null
  hasSubscription: boolean
  isMigrated?: boolean
  nextSession?: { day: string; time: string; group: string } | null
}

const STORAGE_KEY = 'pp-parent-welcome-seen'

/**
 * First-run welcome overlay for parents. Shown once per device. Dismissable.
 *
 * Especially important for migrated parents (e.g. from ClassForKids) who land
 * on the dashboard for the first time after confirming their subscription —
 * first impressions matter for retention.
 */
export default function ParentWelcomeModal({
  parentName,
  academyName,
  primaryColor = '#4ecde6',
  firstChildName,
  hasSubscription,
  isMigrated = false,
  nextSession,
}: Props) {
  const [show, setShow] = useState(false)
  const [step, setStep] = useState(0)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const seen = localStorage.getItem(STORAGE_KEY)
    if (!seen) {
      // Small delay so the page doesn't feel jarring
      setTimeout(() => setShow(true), 400)
    }
  }, [])

  function handleDismiss() {
    localStorage.setItem(STORAGE_KEY, new Date().toISOString())
    setShow(false)
  }

  if (!mounted || !show) return null

  const firstName = parentName.split(' ')[0] || parentName
  const childName = firstChildName || 'your child'

  // Migration-specific slides — for parents who came from ClassForKids / other systems
  const migrationSlides = [
    {
      icon: '🎉',
      title: `Welcome back, ${firstName}!`,
      body: `${academyName} has moved to Player Portal — a much better way to manage ${childName}'s training. Your subscription is set up and ${childName}'s spot is confirmed. Nothing has changed about training itself.`,
      cta: 'Tell me more',
    },
    {
      icon: '✅',
      title: `Nothing changes for ${childName}`,
      body: `Same coaches. Same classes. Same time. Same price. The only difference is YOU now get a proper parent app — schedule, payments, progress, messaging, all in one place. No more searching through WhatsApp or emails.`,
      cta: 'Sounds good',
    },
    {
      icon: '📅',
      title: 'Everything in one place',
      body: nextSession
        ? `${childName}'s next session: ${nextSession.day} at ${nextSession.time} (${nextSession.group}). Always visible on your dashboard.`
        : `Upcoming sessions, times, locations and your coach are all visible on the dashboard. No more digging through emails for times.`,
      cta: 'Brilliant',
    },
    {
      icon: '📊',
      title: `See ${childName} improve over time`,
      body: `Coaches share progress updates with scores across skills, photos from sessions, and milestone awards. Watch ${childName}'s development month by month — not just an occasional report.`,
      cta: 'Love that',
    },
    {
      icon: '📱',
      title: 'Add it to your phone',
      body: `Install Player Portal as an app on your phone home screen — works exactly like a native app, with notifications for session reminders, payment receipts, and coach messages.`,
      cta: `Let's go`,
    },
  ]

  // Fresh-signup slides — for parents who chose Player Portal directly
  const freshSlides = [
    {
      icon: '👋',
      title: `Welcome ${firstName}!`,
      body: `Welcome to ${academyName}'s parent portal. Let's get you set up in 2 minutes.`,
      cta: 'Show me around',
    },
    {
      icon: '📅',
      title: 'See every session at a glance',
      body: nextSession
        ? `${childName}'s next session: ${nextSession.day} at ${nextSession.time} (${nextSession.group}). Your schedule is always on the dashboard.`
        : `When ${childName} is enrolled, you'll see upcoming sessions, times, and locations right on the dashboard.`,
      cta: 'Got it',
    },
    {
      icon: '📊',
      title: 'Watch them improve',
      body: `Coaches share progress updates with scores across skills, photos from sessions, and milestones. You'll see ${childName}'s development over time.`,
      cta: 'Brilliant',
    },
    {
      icon: '💬',
      title: 'Message the coach directly',
      body: `Need to flag an absence or ask a question? Send a quick message to the coach. Replies come straight to your dashboard.`,
      cta: `Let's get started`,
    },
  ]

  const slides = isMigrated ? migrationSlides : freshSlides
  void hasSubscription // signal to the future migration logic; kept available for fallback copy

  const current = slides[step]
  const isLast = step === slides.length - 1

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300"
      onClick={handleDismiss}
    >
      <div
        className="w-full max-w-md bg-[#141414] border border-[#1e1e1e] rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top accent bar */}
        <div className="h-1.5" style={{ backgroundColor: primaryColor }} />

        {/* Close button */}
        <div className="absolute top-3 right-3 z-10">
          <button
            onClick={handleDismiss}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white flex items-center justify-center transition-colors"
            aria-label="Close welcome"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-7 pt-8 pb-6 text-center">
          <div className="text-5xl mb-4">{current.icon}</div>
          <h2 className="text-xl font-bold text-white mb-3">{current.title}</h2>
          <p className="text-sm text-white/60 leading-relaxed mb-6">{current.body}</p>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-1.5 mb-6">
            {slides.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? 'w-6' : 'w-1.5 bg-white/15'
                }`}
                style={i === step ? { backgroundColor: primaryColor } : undefined}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-white/60 hover:text-white border border-white/10 hover:border-white/20 transition-colors"
              >
                Back
              </button>
            )}
            <button
              onClick={() => (isLast ? handleDismiss() : setStep(step + 1))}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-transform hover:scale-[1.02]"
              style={{ backgroundColor: primaryColor, color: '#0a0a0a' }}
            >
              {current.cta} {isLast ? '✨' : '→'}
            </button>
          </div>

          <button
            onClick={handleDismiss}
            className="mt-3 text-xs text-white/30 hover:text-white/60 transition-colors"
          >
            Skip the tour
          </button>
        </div>
      </div>
    </div>
  )
}
