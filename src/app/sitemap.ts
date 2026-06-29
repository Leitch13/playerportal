import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  // Use the canonical www host so sitemap entries don't 308-redirect when
  // a crawler hits them. The apex (theplayerportal.net) 308-redirects to www
  // at the Vercel alias layer; emitting the apex form here wastes crawl budget.
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.theplayerportal.net'
  return [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${baseUrl}/how-it-works`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/terms`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    { url: `${baseUrl}/privacy`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    { url: `${baseUrl}/onboard`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
  ]
}
