'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export type UpsellType =
  | 'trial_to_class'
  | 'single_to_package'
  | 'package_to_subscription'
  | 'add_second_child'
  | 'refer_friend'

interface UpsellBannerProps {
  type: UpsellType
  className?: string
  childName?: string
  planName?: string
  slug?: string
  groupId?: string
  groupName?: string
}

const UPSELL_CONFIG: Record<
  UpsellType,
  {
    icon: string
    heading: string
    description: string
    cta: string
    href: string
    gradient: string
    borderColor: string
    bgColor: string
    ctaColor: string
  }
> = {
  trial_to_class: {
    icon: '⚽',
    heading: 'Loved the trial?',
    description: "Book {child}'s regular spot and keep the momentum going.",
    cta: 'View Classes',
    href: '/dashboard/book',
    gradient: 'from-accent/10 via-accent/5 to-transparent',
    borderColor: 'border-l-accent',
    bgColor: 'bg-white',
    ctaColor: 'bg-accent hover:bg-accent-dark text-white',
  },
  single_to_package: {
    icon: '📦',
    heading: '{child} is doing great!',
    description: 'Save 15% with a multi-class package — fewer payments, same great sessions.',
    cta: 'See Packages',
    href: '/dashboard/upgrade',
    gradient: 'from-emerald-50 via-emerald-50/50 to-transparent',
    borderColor: 'border-l-emerald-500',
    bgColor: 'bg-white',
    ctaColor: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  },
  package_to_subscription: {
    icon: '🔄',
    heading: 'Upgrade to monthly',
    description: 'Never miss a session with a hassle-free monthly subscription. Cancel anytime.',
    cta: 'View Plans',
    href: '/dashboard/payments?tab=subscribe',
    gradient: 'from-violet-50 via-violet-50/50 to-transparent',
    borderColor: 'border-l-violet-500',
    bgColor: 'bg-white',
    ctaColor: 'bg-violet-600 hover:bg-violet-700 text-white',
  },
  add_second_child: {
    icon: '👦👧',
    heading: 'Got a sibling?',
    description: 'Get 10% off when you add a second child — they can train together!',
    cta: 'Add Child',
    href: '/dashboard/children?add=1',
    gradient: 'from-amber-50 via-amber-50/50 to-transparent',
    borderColor: 'border-l-amber-500',
    bgColor: 'bg-white',
    ctaColor: 'bg-amber-600 hover:bg-amber-700 text-white',
  },
  refer_friend: {
    icon: '🎁',
    heading: 'Love Player Portal?',
    description: 'Refer a friend and you both get a free session. Everybody wins!',
    cta: 'Share Link',
    href: '/dashboard/referrals',
    gradient: 'from-rose-50 via-rose-50/50 to-transparent',
    borderColor: 'border-l-rose-500',
    bgColor: 'bg-white',
    ctaColor: 'bg-rose-600 hover:bg-rose-700 text-white',
  },
}

function getDismissKey(type: UpsellType): string {
  return `upsell_dismissed_${type}`
}

function isDismissed(type: UpsellType): boolean {
  if (typeof window === 'undefined') return false
  try {
    const raw = localStorage.getItem(getDismissKey(type))
    if (!raw) return false
    const dismissedAt = Number(raw)
    const sevenDays = 7 * 24 * 60 * 60 * 1000
    return Date.now() - dismissedAt < sevenDays
  } catch {
    return false
  }
}

function dismiss(type: UpsellType): void {
  try {
    localStorage.setItem(getDismissKey(type), String(Date.now()))
  } catch {
    // localStorage unavailable
  }
}

function interpolate(text: string, childName?: string, planName?: string): string {
  let result = text
  if (childName) result = result.replace('{child}', childName)
  else result = result.replace("{child}'s ", 'a ').replace('{child} ', 'Your child ')
  if (planName) result = result.replace('{plan}', planName)
  return result
}

export default function UpsellBanner({ type, className = '', childName, planName, slug, groupId, groupName }: UpsellBannerProps) {
  const [visible, setVisible] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    if (!isDismissed(type)) {
      // Small delay for slide-in animation
      const timer = setTimeout(() => setVisible(true), 100)
      return () => clearTimeout(timer)
    }
  }, [type])

  if (!mounted || isDismissed(type)) return null

  const config = UPSELL_CONFIG[type]
  const heading = groupName
    ? interpolate(config.heading, childName, planName).replace('regular spot', `spot in ${groupName}`)
    : interpolate(config.heading, childName, planName)
  const description = groupName
    ? interpolate(config.description, childName, planName).replace('momentum going', `momentum going in ${groupName}`)
    : interpolate(config.description, childName, planName)

  // Build smart href — link directly to class quick-book if we have groupId
  let href = config.href
  if (type === 'trial_to_class' && slug && groupId) {
    href = `/book/${slug}/class/${groupId}/quick-book`
  } else if (slug) {
    href = config.href.replace('/dashboard/book', `/book/${slug}`)
  }

  function handleDismiss() {
    setVisible(false)
    setTimeout(() => dismiss(type), 300)
  }

  return (
    <div
      className={`
        transform transition-all duration-500 ease-out
        ${visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}
        ${className}
      `}
    >
      <div
        className={`
          relative overflow-hidden rounded-2xl border border-border/60
          ${config.bgColor} border-l-4 ${config.borderColor}
          shadow-sm hover:shadow-md transition-shadow duration-300
        `}
      >
        {/* Gradient background */}
        <div className={`absolute inset-0 bg-gradient-to-r ${config.gradient} pointer-events-none`} />

        <div className="relative flex items-center gap-4 px-5 py-4">
          {/* Icon */}
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-white/80 backdrop-blur-sm border border-border/40 flex items-center justify-center text-2xl shadow-sm">
            {config.icon}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-text">{heading}</h3>
            <p className="text-xs text-text-light mt-0.5 leading-relaxed">{description}</p>
          </div>

          {/* CTA */}
          <Link
            href={href}
            className={`
              flex-shrink-0 px-4 py-2 rounded-lg text-xs font-semibold
              ${config.ctaColor}
              transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]
              shadow-sm
            `}
          >
            {config.cta}
          </Link>

          {/* Dismiss */}
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-text-light/50 hover:text-text-light hover:bg-black/5 transition-colors"
            aria-label="Dismiss"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10.5 3.5L3.5 10.5M3.5 3.5L10.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
