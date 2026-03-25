import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister'
import InstallPrompt from '@/components/InstallPrompt'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: {
    default: 'Player Portal — The All-in-One Platform for Football Academies',
    template: '%s | Player Portal',
  },
  description: 'Manage players, track progress, handle payments, and keep parents engaged. The complete football academy management platform.',
  keywords: ['football academy', 'player management', 'coaching platform', 'sports academy software', 'football coaching app', 'parent portal', 'player progress', 'academy management'],
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
    url: 'https://playerportal.app',
    siteName: 'Player Portal',
    title: 'Player Portal — Run Your Academy Like a Pro',
    description: 'Players. Progress. Payments. Parents. One platform that handles it all.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Player Portal' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Player Portal — Run Your Academy Like a Pro',
    description: 'The all-in-one platform for football academies.',
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
        {children}
        <ServiceWorkerRegister />
        <InstallPrompt />
      </body>
    </html>
  )
}
