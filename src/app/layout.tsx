import { Suspense } from 'react'
import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister'
import InstallPrompt from '@/components/InstallPrompt'
import CookieConsent from '@/components/CookieConsent'
import NavigationProgress from '@/components/NavigationProgress'

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
    icon: '/icon.svg',
    apple: '/icon.svg',
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

export const viewport: Viewport = {
  themeColor: '#4ecde6',
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
        <ServiceWorkerRegister />
        <InstallPrompt />
        <CookieConsent />
      </body>
    </html>
  )
}
