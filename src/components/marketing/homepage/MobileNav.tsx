'use client'

import { useState } from 'react'
import Link from 'next/link'

// Mobile menu for the marketing TopNav (homepage + SEO landing pages).
// Replaces the orphaned LandingMobileMenu, which nothing imported — its
// absence meant phones saw no "Log in" or "Book a demo" at all.
export default function MobileNav() {
  const [open, setOpen] = useState(false)

  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen(!open)}
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        className="text-white/70 hover:text-white p-2 -mr-2"
      >
        {open ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {open && (
        <div className="absolute top-16 left-0 right-0 bg-[#0a0a0a] border-b border-white/10 p-4 space-y-1 z-50 shadow-2xl">
          <a href="#product" onClick={() => setOpen(false)} className="block py-2.5 text-white/70 hover:text-white text-sm font-medium">Product</a>
          <a href="#solutions" onClick={() => setOpen(false)} className="block py-2.5 text-white/70 hover:text-white text-sm font-medium">Solutions</a>
          <a href="#pricing" onClick={() => setOpen(false)} className="block py-2.5 text-white/70 hover:text-white text-sm font-medium">Pricing</a>
          <a href="#why" onClick={() => setOpen(false)} className="block py-2.5 text-white/70 hover:text-white text-sm font-medium">Why</a>
          <div className="pt-3 mt-2 border-t border-white/10 flex gap-3">
            <Link
              href="/auth/signin"
              onClick={() => setOpen(false)}
              className="flex-1 py-2.5 text-center text-sm text-white/80 border border-white/15 rounded-full hover:border-white/30 transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/book-demo"
              onClick={() => setOpen(false)}
              className="flex-1 py-2.5 text-center text-sm font-semibold text-white/90 border border-white/15 rounded-full hover:border-white/30 transition-colors"
            >
              Book a demo
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
