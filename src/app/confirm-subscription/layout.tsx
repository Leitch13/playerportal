import type { Metadata } from 'next'

// Growth Phase 1B — SEO hygiene: post-payment token-gated confirmation
// screens must not be indexed. Every route under
// /confirm-subscription/[token]/… inherits this noindex.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function ConfirmSubscriptionLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
