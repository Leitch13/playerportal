import type { Metadata } from 'next'

// Growth Phase 1B — SEO hygiene: keep the PWA offline fallback out of
// search indexes. The page itself is a client component and can't
// export metadata directly, so we scope the noindex here at the
// route-segment layout.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function OfflineLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
