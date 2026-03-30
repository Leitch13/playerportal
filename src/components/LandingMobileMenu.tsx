'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function LandingMobileMenu() {
  const [open, setOpen] = useState(false)

  return (
    <div className="md:hidden">
      <button onClick={() => setOpen(!open)} className="text-white/60 hover:text-white p-2">
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
        <div className="absolute top-16 left-0 right-0 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-white/[0.06] p-4 space-y-3 animate-slide-down z-50">
          <a href="#features" onClick={() => setOpen(false)} className="block py-2 text-white/60 hover:text-white text-sm font-medium">Features</a>
          <Link href="/how-it-works" onClick={() => setOpen(false)} className="block py-2 text-white/60 hover:text-white text-sm font-medium">How It Works</Link>
          <a href="#pricing" onClick={() => setOpen(false)} className="block py-2 text-white/60 hover:text-white text-sm font-medium">Pricing</a>
          <a href="#testimonials" onClick={() => setOpen(false)} className="block py-2 text-white/60 hover:text-white text-sm font-medium">Testimonials</a>
          <Link href="/demo" onClick={() => setOpen(false)} className="block py-2 text-white/60 hover:text-white text-sm font-medium">Try Demo</Link>
          <div className="pt-3 border-t border-white/[0.06] flex gap-3">
            <Link href="/auth/signin" className="flex-1 py-2.5 text-center text-sm text-white/60 border border-white/[0.1] rounded-xl hover:bg-white/[0.05]">Log in</Link>
            <Link href="/onboard" className="flex-1 py-2.5 text-center text-sm font-semibold bg-white text-[#0a0a0a] rounded-xl">Get Started</Link>
          </div>
        </div>
      )}
    </div>
  )
}
