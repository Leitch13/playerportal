import { redirect } from 'next/navigation'

// Legacy route. Nothing links here any more, but it still rendered a
// "Book a Free Trial" form for every academy — priced trials or not. The
// quick-trial page knows whether this academy actually offers a free one
// and sends the parent to the class list if it doesn't. Hand off to it,
// keeping any UTM params so trial-source attribution survives.
export default async function TrialBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const { slug } = await params
  const sp = await searchParams
  const qs = new URLSearchParams()
  for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'class']) {
    if (sp[k]) qs.set(k, sp[k] as string)
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  redirect(`/book/${slug}/trial/quick${suffix}`)
}
