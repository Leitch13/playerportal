'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/dashboard/one-to-one', label: 'Needs attention' },
  { href: '/dashboard/one-to-one/timetable', label: 'Timetable' },
  { href: '/dashboard/one-to-one/regulars', label: 'Regulars' },
  { href: '/dashboard/one-to-one/coaches', label: 'Coaches & venues' },
  { href: '/dashboard/one-to-one/settings', label: 'Settings' },
]

export default function Tabs() {
  const path = usePathname()
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-white/[0.08]" aria-label="1-2-1 sections">
      {TABS.map((t) => {
        const on = t.href === '/dashboard/one-to-one' ? path === t.href : path.startsWith(t.href)
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium ${on ? 'border-[#4ecde6] text-white' : 'border-transparent text-white/55 hover:text-white'}`}
          >
            {t.label}
          </Link>
        )
      })}
    </nav>
  )
}
