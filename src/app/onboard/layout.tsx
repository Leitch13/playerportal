import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Set Up Your Academy',
  description: 'Create your football academy on Player Portal in under 2 minutes.',
}

export default function OnboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
