/**
 * Sprint 11a — Live / Report / Blank tab strip.
 *
 * Lives on all three register routes so coaches can switch between
 * the live taking UI, the printable monthly report, and the paper
 * blank without losing the class context.
 *
 * Pure client component (uses usePathname); zero data fetches.
 */
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type TabKey = 'live' | 'report' | 'blank'

function classify(pathname: string | null): TabKey {
  if (!pathname) return 'live'
  if (pathname.endsWith('/report')) return 'report'
  if (pathname.endsWith('/blank')) return 'blank'
  return 'live'
}

export default function RegisterTabs({ groupId }: { groupId: string }) {
  const active = classify(usePathname())
  const tabs: { key: TabKey; label: string; href: string; hint: string }[] = [
    { key: 'live',   label: 'Live',   href: `/dashboard/attendance/register/${groupId}`,         hint: 'Take attendance now' },
    { key: 'report', label: 'Report', href: `/dashboard/attendance/register/${groupId}/report`, hint: 'Printable monthly history' },
    { key: 'blank',  label: 'Blank',  href: `/dashboard/attendance/register/${groupId}/blank`,  hint: 'Paper sign-in sheet' },
  ]

  return (
    <div
      className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#0a0a0a] border border-[#1e1e1e]"
      data-testid="register-tabs"
    >
      {tabs.map((t) => {
        const isActive = active === t.key
        return (
          <Link
            key={t.key}
            href={t.href}
            data-testid={`register-tab-${t.key}`}
            data-active={isActive}
            aria-current={isActive ? 'page' : undefined}
            title={t.hint}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              isActive
                ? 'bg-[#4ecde6] text-black'
                : 'text-white/55 hover:text-white hover:bg-white/[0.05]'
            }`}
          >
            {t.label}
          </Link>
        )
      })}
    </div>
  )
}
