import { Suspense } from 'react'
import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister'
import InstallPrompt from '@/components/InstallPrompt'
import CookieConsent from '@/components/CookieConsent'
import NavigationProgress from '@/components/NavigationProgress'
import KeyboardAwareBottomNav from '@/components/KeyboardAwareBottomNav'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://www.theplayerportal.net'),
  title: {
    default: 'Player Portal — The Operating System for Football Academies',
    template: '%s | Player Portal',
  },
  description: 'Player Portal replaces the six or seven tools you use to run your academy — bookings, memberships, payments, attendance, camps, and the parent hub — with one platform built by someone who runs an academy.',
  keywords: ['football academy software', 'football academy management', 'academy management platform', 'ClassForKids alternative', 'sports academy software', 'football coaching app', 'academy bookings', 'academy memberships', 'academy payments', 'parent portal'],
  authors: [{ name: 'Player Portal' }],
  creator: 'Player Portal',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Player Portal',
  },
  icons: {
    icon: [
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-touch-icon.png',
    shortcut: '/favicon-32.png',
  },
  openGraph: {
    type: 'website',
    locale: 'en_GB',
    url: 'https://www.theplayerportal.net',
    siteName: 'Player Portal',
    title: 'Player Portal — The Operating System for Football Academies',
    description: 'Bookings, memberships, payments, attendance, camps, and the parent hub — one platform, built by someone who runs an academy.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Player Portal — the operating system for football academies' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Player Portal — The Operating System for Football Academies',
    description: 'Bookings, memberships, payments, attendance, camps, and the parent hub — one platform, built by someone who runs an academy.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
}

// PWA Phase 1a — mobile viewport foundation.
// `viewportFit: 'cover'` lets iOS Safari render edge-to-edge (into the notch
// and home-indicator zones). Content near those edges must use CSS
// `env(safe-area-inset-*)` (see globals.css) to avoid collision.
// `userScalable` is deliberately NOT disabled — pinch-to-zoom stays enabled
// for accessibility.
//
// PWA Phase 1c — `interactiveWidget: 'resizes-content'` tells modern
// mobile browsers (Chrome 108+, Safari 17+) to shrink the layout viewport
// when the soft keyboard opens, so fixed-bottom elements stay above it
// naturally. Older browsers ignore the directive; a JS fallback in
// KeyboardAwareBottomNav handles them (see globals.css).
export const viewport: Viewport = {
  themeColor: '#4ecde6',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen antialiased">
        <Suspense fallback={null}>
          <NavigationProgress />
        </Suspense>
        {children}
        <KeyboardAwareBottomNav />
        <ServiceWorkerRegister />
        <InstallPrompt />
        <CookieConsent />
      </body>
    </html>
  )
}
