'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Props {
  hasChild: boolean
  hasSubscription: boolean
  hasMessage: boolean
  hasViewedProgress: boolean
  isMigrated?: boolean
  primaryColor?: string
}

const DISMISS_KEY = 'pp-parent-checklist-dismissed'
const PWA_INSTALLED_KEY = 'pp-pwa-installed'
const NOTIFS_KEY = 'pp-notifs-asked'

/**
 * Parent-side onboarding checklist. Lives on the dashboard until parent
 * either completes it or dismisses it. Each item is data-driven where
 * possible, with local-storage fallback for things we can't detect server-side
 * (notifications permission, PWA install).
 */
export default function ParentOnboardingChecklist({
  hasChild,
  hasSubscription,
  hasMessage,
  hasViewedProgress,
  isMigrated = false,
  primaryColor = '#4ecde6',
}: Props) {
  const [dismissed, setDismissed] = useState(true)
  const [notifsEnabled, setNotifsEnabled] = useState(false)
  const [pwaInstalled, setPwaInstalled] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [askingNotifs, setAskingNotifs] = useState(false)

  useEffect(() => {
    setMounted(true)
    setDismissed(localStorage.getItem(DISMISS_KEY) === 'true')
    setPwaInstalled(localStorage.getItem(PWA_INSTALLED_KEY) === 'true' || isPwaInstalled())
    setNotifsEnabled(typeof Notification !== 'undefined' && Notification.permission === 'granted')
  }, [])

  function isPwaInstalled(): boolean {
    if (typeof window === 'undefined') return false
    return window.matchMedia?.('(display-mode: standalone)').matches
      || (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  }

  async function handleEnableNotifs() {
    if (typeof Notification === 'undefined') return
    setAskingNotifs(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission === 'granted') {
        setNotifsEnabled(true)
        localStorage.setItem(NOTIFS_KEY, 'granted')
      } else {
        localStorage.setItem(NOTIFS_KEY, permission)
      }
    } catch {
      // ignore
    }
    setAskingNotifs(false)
  }

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, 'true')
    setDismissed(true)
  }

  if (!mounted || dismissed) return null

  // Define every possible item, then filter based on migration state
  type Item = {
    key: string
    label: string
    done: boolean
    showWhenMigrated: boolean
    action: { type: 'link'; href: string; cta: string } | { type: 'button'; onClick: () => void; cta: string }
  }

  const allItems: Item[] = [
    {
      key: 'child',
      label: 'Add your child',
      done: hasChild,
      showWhenMigrated: false, // Migrated parents already have their child added
      action: { type: 'link', href: '/dashboard/children', cta: 'Add child' },
    },
    {
      key: 'subscription',
      label: 'Confirm your subscription',
      done: hasSubscription,
      showWhenMigrated: false, // Migrated parents already confirmed via Stripe Checkout
      action: { type: 'link', href: '/dashboard/payments', cta: 'Set up' },
    },
    {
      key: 'notifs',
      label: 'Turn on notifications for class reminders',
      done: notifsEnabled,
      showWhenMigrated: true,
      action: { type: 'button', onClick: handleEnableNotifs, cta: askingNotifs ? 'Asking…' : 'Enable' },
    },
    {
      key: 'pwa',
      label: 'Install the app on your phone',
      done: pwaInstalled,
      showWhenMigrated: true,
      action: { type: 'link', href: '/dashboard/account?install=1', cta: 'How to' },
    },
    {
      key: 'progress',
      label: 'See your child’s progress',
      done: hasViewedProgress,
      showWhenMigrated: true,
      action: { type: 'link', href: '/dashboard/feedback', cta: 'View' },
    },
    {
      key: 'message',
      label: 'Send a hello to your coach',
      done: hasMessage,
      showWhenMigrated: true,
      action: { type: 'link', href: '/dashboard/messages', cta: 'Message' },
    },
  ]

  // For migrated parents, skip the items they already completed during migration
  const items = isMigrated
    ? allItems.filter((i) => i.showWhenMigrated)
    : allItems

  const completed = items.filter((i) => i.done).length
  const total = items.length
  const allDone = completed === total

  return (
    <div className="bg-[#141414] border border-[#1e1e1e] rounded-2xl p-5 mb-6 relative">
      {/* Header */}
      <div className="flex items-start justify-between mb-4 gap-3">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            {allDone
              ? <>🎉 You're all set!</>
              : isMigrated
                ? <>4 quick wins from the new portal</>
                : <>Get the most out of Player Portal</>}
          </h2>
          <p className="text-xs text-white/40 mt-0.5">
            {allDone
              ? 'Thanks for setting everything up — you can dismiss this now.'
              : `${completed} of ${total} complete — takes 2 minutes`}
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="w-7 h-7 rounded-full text-white/40 hover:text-white hover:bg-white/5 flex items-center justify-center flex-shrink-0 transition-colors"
          aria-label="Dismiss checklist"
          title="Dismiss"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-[#0a0a0a] rounded-full h-1.5 mb-4">
        <div
          className="h-1.5 rounded-full transition-all duration-500"
          style={{ width: `${(completed / total) * 100}%`, backgroundColor: primaryColor }}
        />
      </div>

      {/* Items */}
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.key}
            className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border transition-colors ${
              item.done
                ? 'bg-emerald-500/5 border-emerald-500/15'
                : 'bg-[#0a0a0a] border-[#1e1e1e]'
            }`}
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                  item.done ? 'bg-emerald-500/20' : 'bg-white/5 border border-white/10'
                }`}
              >
                {item.done && (
                  <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span className={`text-sm ${item.done ? 'text-white/40 line-through' : 'text-white/80'}`}>
                {item.label}
              </span>
            </div>
            {!item.done && (
              item.action.type === 'link' ? (
                <Link
                  href={item.action.href}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex-shrink-0"
                  style={{ backgroundColor: `${primaryColor}1a`, color: primaryColor }}
                >
                  {item.action.cta}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={item.action.onClick}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex-shrink-0"
                  style={{ backgroundColor: `${primaryColor}1a`, color: primaryColor }}
                  disabled={askingNotifs}
                >
                  {item.action.cta}
                </button>
              )
            )}
          </div>
        ))}
      </div>

      {allDone && (
        <button
          onClick={handleDismiss}
          className="mt-4 w-full py-2 rounded-xl text-xs font-semibold bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors"
        >
          Hide checklist
        </button>
      )}
    </div>
  )
}
