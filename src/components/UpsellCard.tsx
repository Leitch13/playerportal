'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { UpsellType } from './UpsellBanner'

interface UpsellCardProps {
  type: UpsellType
  className?: string
  childName?: string
  planName?: string
  slug?: string
}

const CARD_CONFIG: Record<
  UpsellType,
  {
    icon: string
    title: string
    description: string
    cta: string
    href: string
    accentColor: string
    iconBg: string
    ctaColor: string
  }
> = {
  trial_to_class: {
    icon: '⚽',
    title: 'Book regular classes',
    description: 'Keep {child} progressing with weekly sessions.',
    cta: 'View Classes',
    href: '/dashboard/book',
    accentColor: 'border-accent/30',
    iconBg: 'bg-accent/10',
    ctaColor: 'text-accent hover:text-accent-dark',
  },
  single_to_package: {
    icon: '📦',
    title: 'Save with a package',
    description: 'Get 15% off with multi-class bundles.',
    cta: 'See Packages',
    href: '/dashboard/upgrade',
    accentColor: 'border-emerald-200',
    iconBg: 'bg-emerald-50',
    ctaColor: 'text-emerald-600 hover:text-emerald-700',
  },
  package_to_subscription: {
    icon: '🔄',
    title: 'Go monthly',
    description: 'Hassle-free subscription. Cancel anytime.',
    cta: 'View Plans',
    href: '/dashboard/payments?tab=subscribe',
    accentColor: 'border-violet-200',
    iconBg: 'bg-violet-50',
    ctaColor: 'text-violet-600 hover:text-violet-700',
  },
  add_second_child: {
    icon: '👦👧',
    title: 'Add a sibling',
    description: '10% sibling discount available.',
    cta: 'Add Child',
    href: '/dashboard/children?add=1',
    accentColor: 'border-amber-200',
    iconBg: 'bg-amber-50',
    ctaColor: 'text-amber-600 hover:text-amber-700',
  },
  refer_friend: {
    icon: '🎁',
    title: 'Refer a friend',
    description: 'Both get a free session.',
    cta: 'Share Link',
    href: '/dashboard/referrals',
    accentColor: 'border-rose-200',
    iconBg: 'bg-rose-50',
    ctaColor: 'text-rose-600 hover:text-rose-700',
  },
}

function getDismissKey(type: UpsellType): string {
  return `upsell_card_dismissed_${type}`
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
  else result = result.replace("{child}'s ", 'your child\'s ').replace('{child} ', 'your child ')
  if (planName) result = result.replace('{plan}', planName)
  return result
}

export default function UpsellCard({ type, className = '', childName, planName, slug }: UpsellCardProps) {
  const [visible, setVisible] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    if (!isDismissed(type)) {
      const timer = setTimeout(() => setVisible(true), 150)
      return () => clearTimeout(timer)
    }
  }, [type])

  if (!mounted || isDismissed(type)) return null

  const config = CARD_CONFIG[type]
  const title = interpolate(config.title, childName, planName)
  const description = interpolate(config.description, childName, planName)
  const href = slug ? config.href.replace('/dashboard/book', `/book/${slug}`) : config.href

  function handleDismiss() {
    setVisible(false)
    setTimeout(() => dismiss(type), 300)
  }

  return (
    <div
      className={`
        transform transition-all duration-400 ease-out
        ${visible ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-2 opacity-0 scale-[0.98]'}
        ${className}
      `}
    >
      <div className={`relative bg-white rounded-xl border ${config.accentColor} p-4 hover:shadow-sm transition-shadow group`}>
        {/* Dismiss */}
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-text-light/40 hover:text-text-light hover:bg-black/5 transition-colors opacity-0 group-hover:opacity-100"
          aria-label="Dismiss"
        >
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10.5 3.5L3.5 10.5M3.5 3.5L10.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={`flex-shrink-0 w-10 h-10 rounded-lg ${config.iconBg} flex items-center justify-center text-xl`}>
            {config.icon}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-text">{title}</h4>
            <p className="text-[11px] text-text-light mt-0.5">{description}</p>
            <Link
              href={href}
              className={`inline-flex items-center gap-1 text-xs font-semibold mt-2 ${config.ctaColor} transition-colors`}
            >
              {config.cta}
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="translate-x-0 group-hover:translate-x-0.5 transition-transform">
                <path d="M4.5 2.5L8 6L4.5 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
