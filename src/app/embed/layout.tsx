import type { Metadata } from 'next'

// Growth Phase 1B — SEO hygiene: the embeddable booking widget host
// serves per-academy content designed for third-party iframes and
// should not be indexed as standalone pages.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
