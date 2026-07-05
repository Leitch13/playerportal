import type { MetadataRoute } from 'next'

// Canonical URL is fixed to the www subdomain so every entry in the sitemap
// matches the canonical alias Google should index. Do NOT read this from an
// env var — env drift would let Google discover non-canonical hosts.
const CANONICAL_BASE = 'https://www.theplayerportal.net'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return [
    { url: CANONICAL_BASE,                                              lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${CANONICAL_BASE}/onboard`,                                 lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${CANONICAL_BASE}/how-it-works`,                            lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    // P1 topical-authority landing pages (Hotfix A). P2 slugs added once shipped.
    { url: `${CANONICAL_BASE}/football-academy-management-software`,    lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${CANONICAL_BASE}/football-booking-system`,                 lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${CANONICAL_BASE}/academy-payment-collection`,              lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${CANONICAL_BASE}/demo`,                                    lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${CANONICAL_BASE}/terms`,                                   lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${CANONICAL_BASE}/privacy`,                                 lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${CANONICAL_BASE}/dpa`,                                     lastModified: now, changeFrequency: 'yearly',  priority: 0.2 },
    { url: `${CANONICAL_BASE}/cookies`,                                 lastModified: now, changeFrequency: 'yearly',  priority: 0.2 },
  ]
}
