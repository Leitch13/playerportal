'use client'

import { useState } from 'react'
import Link from 'next/link'

// Mobile menu for the marketing TopNav (homepage + SEO landing pages).
// Replaces the orphaned LandingMobileMenu, which nothing imported — its
// absence meant phones saw no "Log in" or "Book a demo" at all.
// variant='light' (default): white hamburger on the cyan hero, white dropdown
// panel with dark text. variant='dark': the original dark-theme dropdown.
export default function MobileNav({ variant = 'light' }: { variant?: 'light' | 'dark' }) {
  const [open, setOpen] = useState(false)
  const dark = variant === 'dark'

  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen(!open)}
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        className={`p-2 -mr-2 ${dark ? 'text-white/70 hover:text-white' : 'text-white/85 hover:text-white'}`}
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
        <div className={`absolute top-16 left-0 right-0 p-4 space-y-1 z-50 shadow-2xl border-b ${
          dark ? 'bg-[#0a0a0a] border-white/10' : 'bg-white border-[#e3ebf0]'
        }`}>
          <a href="#product" onClick={() => setOpen(false)} className={`block py-2.5 text-sm font-medium ${dark ? 'text-white/70 hover:text-white' : 'text-[#5a6b7c] hover:text-[#0d1b2b]'}`}>Product</a>
          <a href="#solutions" onClick={() => setOpen(false)} className={`block py-2.5 text-sm font-medium ${dark ? 'text-white/70 hover:text-white' : 'text-[#5a6b7c] hover:text-[#0d1b2b]'}`}>Solutions</a>
          <a href="#pricing" onClick={() => setOpen(false)} className={`block py-2.5 text-sm font-medium ${dark ? 'text-white/70 hover:text-white' : 'text-[#5a6b7c] hover:text-[#0d1b2b]'}`}>Pricing</a>
          <a href="#why" onClick={() => setOpen(false)} className={`block py-2.5 text-sm font-medium ${dark ? 'text-white/70 hover:text-white' : 'text-[#5a6b7c] hover:text-[#0d1b2b]'}`}>Why</a>
          <div className={`pt-3 mt-2 border-t flex gap-3 ${dark ? 'border-white/10' : 'border-[#e3ebf0]'}`}>
            <Link
              href="/auth/signin"
              onClick={() => setOpen(false)}
              className={`flex-1 py-2.5 text-center text-sm rounded-full border transition-colors ${
                dark
                  ? 'text-white/80 border-white/15 hover:border-white/30'
                  : 'text-[#0d1b2b] border-[#d3dfe6] hover:border-[#0a97b6]'
              }`}
            >
              Log in
            </Link>
            <Link
              href="/book-demo"
              onClick={() => setOpen(false)}
              className={`flex-1 py-2.5 text-center text-sm font-semibold rounded-full transition-colors ${
                dark
                  ? 'text-white/90 border border-white/15 hover:border-white/30'
                  : 'text-white bg-[#0b0f15] hover:bg-[#1a2230]'
              }`}
            >
              Book a demo
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
