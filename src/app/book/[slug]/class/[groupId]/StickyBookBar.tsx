'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function StickyBookBar({
  href,
  label,
  price,
  primaryColor,
  isFull,
}: {
  href: string
  label: string
  price: string | null
  primaryColor: string
  isFull: boolean
}) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => {
      // Show bar after scrolling past 300px
      setVisible(window.scrollY > 300)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 md:hidden transition-transform duration-300 ${
        visible ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      <div className="backdrop-blur-xl bg-[#060606]/95 border-t border-white/10 px-4 py-3 safe-area-pb">
        <div className="flex items-center gap-3">
          {price && (
            <div className="shrink-0">
              <span className="text-xl font-extrabold text-white">{price}</span>
              <span className="text-xs text-white/40 block">per month</span>
            </div>
          )}
          <Link
            href={href}
            className="flex-1 text-center py-3.5 rounded-xl font-bold text-base transition-all active:scale-[0.97]"
            style={{
              backgroundColor: isFull ? '#1e293b' : primaryColor,
              color: isFull ? '#94a3b8' : '#0a0a0a',
            }}
          >
            {label} &rarr;
          </Link>
        </div>
      </div>
    </div>
  )
}
