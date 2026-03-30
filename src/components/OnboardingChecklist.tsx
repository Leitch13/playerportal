'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface OnboardingChecklistProps {
  hasClasses: boolean
  hasPlans: boolean
  hasCoach: boolean
  hasStripe: boolean
  hasPlayers: boolean
  bookingUrl: string
}

const DISMISS_KEY = 'onboarding-checklist-dismissed'
const COPIED_KEY = 'onboarding-booking-copied'

export default function OnboardingChecklist({
  hasClasses,
  hasPlans,
  hasCoach,
  hasStripe,
  hasPlayers,
  bookingUrl,
}: OnboardingChecklistProps) {
  const [dismissed, setDismissed] = useState(true) // start hidden to avoid flash
  const [hasCopied, setHasCopied] = useState(false)
  const [copyFeedback, setCopyFeedback] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === 'true')
    setHasCopied(localStorage.getItem(COPIED_KEY) === 'true')
    // Trigger mount animation after a tick
    requestAnimationFrame(() => setMounted(true))
  }, [])

  const handleDismiss = () => {
    setDismissed(true)
    localStorage.setItem(DISMISS_KEY, 'true')
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(bookingUrl)
      setHasCopied(true)
      setCopyFeedback(true)
      localStorage.setItem(COPIED_KEY, 'true')
      setTimeout(() => setCopyFeedback(false), 2000)
    } catch {
      // Fallback
      const input = document.createElement('input')
      input.value = bookingUrl
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setHasCopied(true)
      setCopyFeedback(true)
      localStorage.setItem(COPIED_KEY, 'true')
      setTimeout(() => setCopyFeedback(false), 2000)
    }
  }

  if (dismissed) return null

  const items = [
    {
      label: 'Create your first class',
      checked: hasClasses,
      href: '/dashboard/groups',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      ),
    },
    {
      label: 'Set up pricing plans',
      checked: hasPlans,
      href: '/dashboard/plans',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      ),
    },
    {
      label: 'Add a coach',
      checked: hasCoach,
      href: '/dashboard/settings?tab=team',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <line x1="19" y1="8" x2="19" y2="14" />
          <line x1="22" y1="11" x2="16" y2="11" />
        </svg>
      ),
    },
    {
      label: 'Share your booking page',
      checked: hasCopied,
      href: undefined,
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
          <polyline points="16 6 12 2 8 6" />
          <line x1="12" y1="2" x2="12" y2="15" />
        </svg>
      ),
    },
    {
      label: 'Connect Stripe for payments',
      checked: hasStripe,
      href: '/dashboard/settings?tab=billing',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="4" width="22" height="16" rx="2" />
          <line x1="1" y1="10" x2="23" y2="10" />
        </svg>
      ),
    },
    {
      label: 'Add your first player',
      checked: hasPlayers,
      href: '/dashboard/players',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
    },
  ]

  const completedCount = items.filter((i) => i.checked).length
  const totalCount = items.length
  const percentage = Math.round((completedCount / totalCount) * 100)

  return (
    <div
      className={`bg-[#141414] border border-[#1e1e1e] rounded-2xl p-5 transition-all duration-500 ${
        mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#4ecde6]/10 rounded-xl flex items-center justify-center border border-[#4ecde6]/20">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4ecde6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Get Your Academy Ready</h3>
            <p className="text-[11px] text-white/40">
              {completedCount} of {totalCount} complete
            </p>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="text-[11px] text-white/30 hover:text-white/60 transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
        >
          Dismiss
        </button>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-white/5 rounded-full mb-5 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[#4ecde6] to-[#4ecde6]/60 rounded-full transition-all duration-700 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Checklist */}
      <div className="space-y-1">
        {items.map((item, idx) => (
          <div
            key={item.label}
            className={`transition-all duration-500 ${
              mounted ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'
            }`}
            style={{ transitionDelay: `${(idx + 1) * 80}ms` }}
          >
            {item.href ? (
              <Link
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl group transition-colors ${
                  item.checked
                    ? 'opacity-60'
                    : 'hover:bg-white/[0.03]'
                }`}
              >
                <CheckIcon checked={item.checked} />
                <span className={`text-white/50 ${!item.checked ? 'group-hover:text-white/70' : ''} transition-colors`}>
                  {item.icon}
                </span>
                <span
                  className={`text-sm flex-1 ${
                    item.checked
                      ? 'text-white/40 line-through'
                      : 'text-white/70 group-hover:text-white'
                  } transition-colors`}
                >
                  {item.label}
                </span>
                {!item.checked && (
                  <svg
                    className="w-4 h-4 text-white/20 group-hover:text-white/40 transition-colors"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    viewBox="0 0 24 24"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                )}
              </Link>
            ) : (
              /* Share booking page — inline copy */
              <div
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${
                  item.checked ? 'opacity-60' : ''
                }`}
              >
                <CheckIcon checked={item.checked} />
                <span className={`text-white/50 transition-colors`}>
                  {item.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <span
                    className={`text-sm block ${
                      item.checked ? 'text-white/40 line-through' : 'text-white/70'
                    }`}
                  >
                    {item.label}
                  </span>
                  <div className="flex items-center gap-2 mt-1.5">
                    <code className="text-[11px] text-[#4ecde6]/70 bg-[#4ecde6]/5 border border-[#4ecde6]/10 rounded-lg px-2 py-1 truncate block max-w-[200px]">
                      {bookingUrl}
                    </code>
                    <button
                      onClick={handleCopy}
                      className={`shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-lg border transition-all ${
                        copyFeedback
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                          : 'bg-[#4ecde6]/10 border-[#4ecde6]/20 text-[#4ecde6] hover:bg-[#4ecde6]/20'
                      }`}
                    >
                      {copyFeedback ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function CheckIcon({ checked }: { checked: boolean }) {
  return (
    <div
      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-300 ${
        checked
          ? 'bg-[#4ecde6] border-[#4ecde6]'
          : 'border-white/15 bg-transparent'
      }`}
    >
      {checked && (
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="animate-[checkmark_0.3s_ease-out]"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </div>
  )
}
