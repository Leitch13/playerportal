// Growth Phase 1B — reusable BreadcrumbList JSON-LD.
//
// Emits Google-compliant BreadcrumbList schema. Rendered server-side
// as a plain <script> tag; no client JS.
//
// Google's rich-result requirement is ≥2 items, so this component is
// applied on landing pages (Home → Landing), not on the homepage.

interface BreadcrumbItem {
  name: string
  url: string
}

export default function BreadcrumbSchema({ items }: { items: BreadcrumbItem[] }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}
